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

Deno.serve(async function (req) {
  var corsHeaders = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // --- בדיקת הרשאה: חובה JWT תקין של משתמש מחובר לפני כל עיבוד ---
    var authHeader = req.headers.get('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'נדרשת התחברות כדי להשתמש בפונקציה זו' }),
        {
          status: 401,
          headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }),
        }
      )
    }

    var jwt = authHeader.replace('Bearer ', '')

    var supabaseModule = await import('npm:@supabase/supabase-js@2')
    var createClient = supabaseModule.createClient

    var supabaseUrl = Deno.env.get('SUPABASE_URL')
    var supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')

    var supabase = createClient(supabaseUrl, supabaseAnonKey)

    var userResult = await supabase.auth.getUser(jwt)
    var user = userResult.data ? userResult.data.user : null
    var authError = userResult.error

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'הרשאה לא תקינה' }),
        {
          status: 401,
          headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }),
        }
      )
    }
    // --- סוף בדיקת הרשאה ---

    var body = await req.json()
    var base64 = body.fileBase64
    var fileType = body.fileType

    if (!base64) {
      return new Response(
        JSON.stringify({ error: 'חסר שדה fileBase64' }),
        {
          status: 400,
          headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }),
        }
      )
    }

    var bufferModule = await import('node:buffer')
    var Buffer = bufferModule.Buffer
    var buffer = Buffer.from(base64, 'base64')
    var extractedText = ''

    if (fileType === 'word') {
      var wordModule = await import('npm:word-extractor@1.0.4')
      var WordExtractor = wordModule.default
      var extractor = new WordExtractor()
      var doc = await extractor.extract(buffer)
      extractedText = doc.getBody()
    } else {
      var pdfModule = await import('npm:pdf-parse@1.1.1')
      var pdfParse = pdfModule.default
      var data = await pdfParse(buffer)
      extractedText = data.text
    }

    return new Response(
      JSON.stringify({ text: extractedText }),
      {
        headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }),
      }
    )
  } catch (error) {
    var message = error && error.message ? error.message : String(error)
    console.error('extract-pdf-text error:', message)
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }),
      }
    )
  }
})