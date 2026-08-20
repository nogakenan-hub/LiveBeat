// supabase/functions/delete-account/index.ts

import { AwsClient } from 'npm:aws4fetch@1.0.20'

// תבנית מותרת: כל כתובת קודספייס (משתנה לפי פורט) + אפשרות להוסיף כאן בעתיד דומיין ייצור קבוע
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

// ה-B2_ENDPOINT נראה כך: s3.eu-central-003.backblazeb2.com
// ה-region הנדרש לחתימה הוא המקטע האמצעי: eu-central-003
function extractRegionFromEndpoint(endpoint) {
  var parts = endpoint.split('.')
  if (parts.length < 2) return 'auto'
  return parts[1]
}

// --- מחיקת קבצים מ-Backblaze B2 ---
// בדיוק כמו ב-media-presigned-url: Presigned URL (signQuery), בלי headers
// נוספים בחתימה - לקח מהניסיון בסקריפט המיגרציה, ש-headers בחתימה עלולים
// לגרום ל-SignatureDoesNotMatch כתלות בסביבת ההרצה.
async function deleteFromB2(fileNames) {
  var accessKeyId = Deno.env.get('B2_KEY_ID')
  var secretAccessKey = Deno.env.get('B2_APPLICATION_KEY')
  var bucketName = Deno.env.get('B2_BUCKET_NAME')
  var endpoint = Deno.env.get('B2_ENDPOINT')

  if (!accessKeyId || !secretAccessKey || !bucketName || !endpoint) {
    console.error('חסרים משתני סביבה של Backblaze B2 - מדלגה על מחיקת קבצי B2')
    return
  }

  var region = extractRegionFromEndpoint(endpoint)
  var client = new AwsClient({
    accessKeyId: accessKeyId,
    secretAccessKey: secretAccessKey,
    service: 's3',
    region: region,
  })

  for (var i = 0; i < fileNames.length; i++) {
    var fileName = fileNames[i]
    try {
      var url = new URL('https://' + endpoint + '/' + bucketName + '/' + fileName)
      url.searchParams.set('X-Amz-Expires', '3600')

      var signedRequest = await client.sign(url.toString(), {
        method: 'DELETE',
        aws: { signQuery: true },
      })

      var response = await fetch(signedRequest.url, { method: 'DELETE' })

      if (!response.ok && response.status !== 404) {
        var errorText = await response.text()
        console.error('מחיקה מ-B2 נכשלה עבור ' + fileName + ' (סטטוס ' + response.status + '): ' + errorText)
        // ממשיכה בכל זאת - אותו עיקרון כמו מחיקת Supabase: עדיף חשבון מחוק
        // עם קובץ יתום מאשר לתקוע את כל התהליך
      }
    } catch (error) {
      console.error('מחיקה מ-B2 נכשלה עבור ' + fileName + ': ' + error.message)
    }
  }
}

Deno.serve(async function (req) {
  var corsHeaders = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // --- שלב 0: אימות זהות המשתמש שמבקש למחוק את עצמו ---
    var authHeader = req.headers.get('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'נדרשת התחברות כדי למחוק חשבון' }),
        { status: 401, headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }) }
      )
    }

    var jwt = authHeader.replace('Bearer ', '')

    var supabaseModule = await import('npm:@supabase/supabase-js@2')
    var createClient = supabaseModule.createClient

    var supabaseUrl = Deno.env.get('SUPABASE_URL')
    var anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    var serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    // לקוח עם הרשאת המשתמש בלבד - רק כדי לוודא מי הוא בפועל
    var supabaseUser = createClient(supabaseUrl, anonKey)
    var userResult = await supabaseUser.auth.getUser(jwt)
    var user = userResult.data ? userResult.data.user : null

    if (userResult.error || !user) {
      return new Response(
        JSON.stringify({ error: 'הרשאה לא תקינה' }),
        { status: 401, headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }) }
      )
    }

    var targetUid = user.id

    // לקוח עם הרשאת מנהל - לביצוע המחיקה בפועל (קבצים, נתונים, auth.users)
    var supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    // --- שלב 1: איסוף נתיבי הקבצים שצריך למחוק, מפוצל לפי ספק האחסון ---
    // רק סקיצות בבעלות המשתמש + כל הפידבק שתחתן (כי הן יורדות לגמרי בשלב הבא)
    var ownSketchesResult = await supabaseAdmin
      .from('Sketch')
      .select('id, file_url, storage_provider')
      .eq('uploader_user_id', targetUid)

    var ownSketches = ownSketchesResult.data || []
    var sketchIds = ownSketches.map(function (s) { return s.id })

    var supabasePaths = []
    var backblazeFileNames = []

    function sortFileByProvider(row) {
      if (!row.file_url) return
      if (row.storage_provider === 'backblaze') {
        backblazeFileNames.push(row.file_url)
      } else {
        supabasePaths.push(row.file_url)
      }
    }

    ownSketches.forEach(sortFileByProvider)

    if (sketchIds.length > 0) {
      var feedbackFilesResult = await supabaseAdmin
        .from('SketchFeedback')
        .select('file_url, storage_provider')
        .in('sketch_id', sketchIds)

      var feedbackFiles = feedbackFilesResult.data || []
      feedbackFiles.forEach(sortFileByProvider)
    }

    // --- שלב 2: מחיקת הקבצים בפועל, כל אחד מהמקום שלו ---
    if (supabasePaths.length > 0) {
      var storageRemoveResult = await supabaseAdmin.storage.from('sketch-files').remove(supabasePaths)
      if (storageRemoveResult.error) {
        console.error('storage remove error:', storageRemoveResult.error.message)
        // ממשיכה בכל זאת - עדיף חשבון מחוק עם קובץ יתום מאשר לתקוע את כל התהליך
      }
    }

    if (backblazeFileNames.length > 0) {
      await deleteFromB2(backblazeFileNames)
    }

    // --- שלב 3: מחיקה/אנונימיזציה של כל השורות בבסיס הנתונים ---
    var rpcResult = await supabaseAdmin.rpc('delete_account_data', { target_uid: targetUid })

    if (rpcResult.error) {
      throw new Error(rpcResult.error.message)
    }

    // --- שלב 4: מחיקת המשתמש עצמו מ-auth.users - לא ניתן יותר להתחבר בשום צורה ---
    var deleteUserResult = await supabaseAdmin.auth.admin.deleteUser(targetUid)

    if (deleteUserResult.error) {
      throw new Error(deleteUserResult.error.message)
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }) }
    )
  } catch (error) {
    var message = error && error.message ? error.message : String(error)
    console.error('delete-account error:', message)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }) }
    )
  }
})