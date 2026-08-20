// supabase/functions/media-presigned-url/index.ts
//
// פונקציה זו מחליפה חלקית את מנגנון ה-Signed URLs הקיים של Supabase Storage,
// עבור קבצי אודיו/וידאו/מסמכים שעברו לאחסון ב-Backblaze B2.
// עודכן 20.08.2026 - תומכת גם בתמונות נושא (cover images) לסקיצות.
//
// שלוש צורות אפשריות ב-body של הבקשה (JSON):
//   { action: 'upload', fileName: 'original-name.mp3', contentType: 'audio/mpeg', declaredSizeBytes: 123 }
//   { action: 'download', table: 'Sketch' | 'SketchFeedback', recordId: 'uuid-כלשהו' }                       // הקובץ הראשי (ברירת מחדל, field='file')
//   { action: 'download', table: 'Sketch', recordId: 'uuid-כלשהו', field: 'cover' }                          // חדש - תמונת נושא
//
// עקרון אבטחה מרכזי: בפעולת download, אנחנו לעולם לא סומכות על מפתח קובץ
// שנשלח מהלקוח. במקום זאת, שולפות את הרשומה מה-DB באמצעות client שמחובר
// עם ה-JWT של המשתמשת עצמה (או client אנונימי אם אין התחברות בכלל) - כך
// ש-RLS מסננת אוטומטית: קטעים ציבוריים ייחשפו גם למי שלא מחוברת בכלל
// (בדיוק כמו שזה עבד עד היום מול Supabase Storage), וקטעים פרטיים רק
// למי שה-RLS מרשה לה.
//
// פעולת upload, לעומת זאת, דורשת התחברות תמיד - רק משתמשת מחוברת יכולה
// להעלות קובץ חדש. היא כללית (לא קשורה ל-table/recordId) - הקריאה מחזירה
// רק uploadUrl+objectKey, והלקוח בעצמו מחליט לאיזו עמודה לשמור את המפתח
// (file_url עבור הקובץ הראשי, cover_image_url עבור תמונת נושא).

import { AwsClient } from 'npm:aws4fetch@1.0.20'

// --- הגדרות קבועות, תואמות למה שכבר קיים היום ב-bucket sketch-files של Supabase ---
var MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024 // 50MB - סאונד/וידאו/מסמכים
var MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024 // 5MB - חדש 20.08.2026, תמונות נושא בלבד
var SIGNED_URL_EXPIRY_SECONDS = 3600 // שעה, בדיוק כמו היום

var ALLOWED_CONTENT_TYPE_PREFIXES = ['audio/', 'video/', 'image/'] // 'image/' נוסף 20.08.2026
var ALLOWED_EXACT_CONTENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]

// --- CORS: אותו דפוס דינמי לפי Origin שכבר קיים ב-extract-pdf-text וב-delete-account ---
var ALLOWED_ORIGIN_PATTERN = /^https:\/\/[a-z0-9-]+\.app\.github\.dev$/

function getCorsHeaders(req) {
  var origin = req.headers.get('Origin') || ''
  var isAllowed = ALLOWED_ORIGIN_PATTERN.test(origin)

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : 'null',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  }
}

function isContentTypeAllowed(contentType) {
  if (!contentType) return false
  for (var i = 0; i < ALLOWED_CONTENT_TYPE_PREFIXES.length; i++) {
    if (contentType.indexOf(ALLOWED_CONTENT_TYPE_PREFIXES[i]) === 0) return true
  }
  return ALLOWED_EXACT_CONTENT_TYPES.indexOf(contentType) !== -1
}

// חדש 20.08.2026 - תמונות מוגבלות ל-5MB, כל שאר סוגי הקבצים נשארים ב-50MB
function getMaxSizeForContentType(contentType) {
  if (contentType && contentType.indexOf('image/') === 0) return MAX_IMAGE_SIZE_BYTES
  return MAX_FILE_SIZE_BYTES
}

function getSafeFileExtension(fileName) {
  var parts = (fileName || '').split('.')
  if (parts.length < 2) return 'bin'
  var ext = parts[parts.length - 1]
  var cleanExt = ext.replace(/[^a-zA-Z0-9]/g, '')
  if (!cleanExt) return 'bin'
  return cleanExt.toLowerCase()
}

function buildSafeObjectKey(fileName) {
  var randomId = crypto.randomUUID()
  var ext = getSafeFileExtension(fileName)
  return randomId + '.' + ext
}

// ה-B2_ENDPOINT נראה כך: s3.eu-central-003.backblazeb2.com
// ה-region הנדרש לחתימה הוא המקטע האמצעי: eu-central-003
function extractRegionFromEndpoint(endpoint) {
  var parts = endpoint.split('.')
  if (parts.length < 2) return 'auto'
  return parts[1]
}

async function buildPresignedUrl(method, objectKey, contentType) {
  var accessKeyId = Deno.env.get('B2_KEY_ID')
  var secretAccessKey = Deno.env.get('B2_APPLICATION_KEY')
  var bucketName = Deno.env.get('B2_BUCKET_NAME')
  var endpoint = Deno.env.get('B2_ENDPOINT')

  if (!accessKeyId || !secretAccessKey || !bucketName || !endpoint) {
    throw new Error('חסרים משתני סביבה של Backblaze B2 בצד השרת')
  }

  var region = extractRegionFromEndpoint(endpoint)

  var client = new AwsClient({
    accessKeyId: accessKeyId,
    secretAccessKey: secretAccessKey,
    service: 's3',
    region: region,
  })

  var url = new URL('https://' + endpoint + '/' + bucketName + '/' + objectKey)
  url.searchParams.set('X-Amz-Expires', String(SIGNED_URL_EXPIRY_SECONDS))

  var requestInit = { method: method, aws: { signQuery: true } }

  if (method === 'PUT' && contentType) {
    // חתימת ה-Content-Type בבקשת ה-PUT מבטיחה שהלקוח לא יוכל לשלוח קובץ
    // עם סוג תוכן שונה מזה שאושר כאן, בלי לשבור את החתימה הקריפטוגרפית
    requestInit.headers = { 'Content-Type': contentType }
  }

  var signedRequest = await client.sign(url.toString(), requestInit)
  return signedRequest.url
}

// בונות client של Supabase שמדבר "בשם" מי ששלחה את הבקשה - עם ה-JWT שלה אם
// יש (RLS יחול לפי המשתמשת המחוברת), או בלי Authorization בכלל אם אין
// (RLS יחול לפי הרשאות 'anon' - בדיוק כמו גולשת לא מחוברת באתר עצמו).
async function buildScopedSupabaseClient(req, supabaseModule) {
  var createClient = supabaseModule.createClient
  var supabaseUrl = Deno.env.get('SUPABASE_URL')
  var supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  var authHeader = req.headers.get('Authorization')

  if (authHeader && authHeader.indexOf('Bearer ') === 0) {
    var jwt = authHeader.replace('Bearer ', '')
    var scopedClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    var userResult = await scopedClient.auth.getUser(jwt)
    var user = userResult.data ? userResult.data.user : null
    return { supabase: scopedClient, user: user }
  }

  // אין התחברות בכלל - client רגיל עם מפתח anon, בדיוק כמו גולשת אנונימית
  var anonClient = createClient(supabaseUrl, supabaseAnonKey)
  return { supabase: anonClient, user: null }
}

Deno.serve(async function (req) {
  var corsHeaders = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    var supabaseModule = await import('npm:@supabase/supabase-js@2')
    var scoped = await buildScopedSupabaseClient(req, supabaseModule)

    var body = await req.json()
    var action = body.action

    if (action === 'upload') {
      // העלאה דורשת התחברות תמיד - בשונה מהורדה, שיכולה להיות ציבורית
      if (!scoped.user) {
        return new Response(
          JSON.stringify({ error: 'נדרשת התחברות כדי להעלות קובץ' }),
          {
            status: 401,
            headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }),
          }
        )
      }

      var fileName = body.fileName || ''
      var contentType = body.contentType || ''
      var declaredSizeBytes = body.declaredSizeBytes || 0

      if (!isContentTypeAllowed(contentType)) {
        return new Response(
          JSON.stringify({ error: 'סוג קובץ לא נתמך' }),
          {
            status: 400,
            headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }),
          }
        )
      }

      // הערה: זו בדיקה על סמך מה שהלקוח מצהיר, לא אכיפה אמיתית - בדיוק
      // אותו סיכון מקובל שכבר קיים היום מול Supabase Storage (ראו STATE.md,
      // "known residual risk"). אכיפה אמיתית של גודל קובץ בפועל ב-PUT דורשת
      // מנגנון נפרד (POST Policy) שלא נבנה כרגע במודע.
      // עודכן 20.08.2026 - המגבלה עכשיו תלוית-סוג-קובץ (5MB לתמונות, 50MB לשאר).
      var maxSizeForThisUpload = getMaxSizeForContentType(contentType)
      if (declaredSizeBytes > maxSizeForThisUpload) {
        var sizeLabel = maxSizeForThisUpload === MAX_IMAGE_SIZE_BYTES ? '5MB' : '50MB'
        return new Response(
          JSON.stringify({ error: 'הקובץ חורג מהגודל המותר (' + sizeLabel + ')' }),
          {
            status: 400,
            headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }),
          }
        )
      }

      var objectKey = buildSafeObjectKey(fileName)
      var uploadUrl = await buildPresignedUrl('PUT', objectKey, contentType)

      return new Response(
        JSON.stringify({ uploadUrl: uploadUrl, objectKey: objectKey }),
        { headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }) }
      )
    }

    if (action === 'download') {
      var table = body.table
      var recordId = body.recordId
      // חדש 20.08.2026 - 'file' (ברירת מחדל, התנהגות קיימת) או 'cover' (תמונת נושא)
      var field = body.field || 'file'

      if (table !== 'Sketch' && table !== 'SketchFeedback') {
        return new Response(
          JSON.stringify({ error: 'טבלה לא נתמכת' }),
          {
            status: 400,
            headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }),
          }
        )
      }

      if (field === 'cover' && table !== 'Sketch') {
        return new Response(
          JSON.stringify({ error: 'תמונת נושא נתמכת רק לסקיצות' }),
          {
            status: 400,
            headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }),
          }
        )
      }

      // שאילתה עם client שמכבד RLS לפי מי ששלחה את הבקשה (מחוברת או לא).
      // אם השורה לא חוזרת - RLS לא הרשתה, ואין URL.
      var selectColumns = field === 'cover' ? 'cover_image_url' : 'file_url, storage_provider'

      var recordResult = await scoped.supabase
        .from(table)
        .select(selectColumns)
        .eq('id', recordId)
        .maybeSingle()

      if (recordResult.error || !recordResult.data) {
        return new Response(
          JSON.stringify({ error: 'אין הרשאה לצפות בקובץ זה, או שהוא לא קיים' }),
          {
            status: 403,
            headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }),
          }
        )
      }

      var row = recordResult.data
      var objectKeyToFetch

      if (field === 'cover') {
        // תמונות נושא הן תמיד B2 - לא קיים מצב 'supabase' עבורן, אין צורך בבדיקת storage_provider
        if (!row.cover_image_url) {
          return new Response(
            JSON.stringify({ error: 'אין תמונת נושא לסקיצה זו' }),
            {
              status: 400,
              headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }),
            }
          )
        }
        objectKeyToFetch = row.cover_image_url
      } else {
        if (row.storage_provider !== 'backblaze' || !row.file_url) {
          return new Response(
            JSON.stringify({ error: 'הרשומה הזו לא מאוחסנת ב-Backblaze' }),
            {
              status: 400,
              headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }),
            }
          )
        }
        objectKeyToFetch = row.file_url
      }

      var downloadUrl = await buildPresignedUrl('GET', objectKeyToFetch, null)

      return new Response(
        JSON.stringify({ downloadUrl: downloadUrl }),
        { headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }) }
      )
    }

    return new Response(
      JSON.stringify({ error: 'action לא מוכר' }),
      {
        status: 400,
        headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }),
      }
    )
  } catch (error) {
    var message = error && error.message ? error.message : String(error)
    console.error('media-presigned-url error:', message)
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }),
      }
    )
  }
})