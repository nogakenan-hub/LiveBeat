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

    // --- שלב 1: איסוף נתיבי הקבצים שצריך למחוק מה-Storage ---
    // רק סקיצות בבעלות המשתמש + כל הפידבק שתחתן (כי הן יורדות לגמרי בשלב הבא)
    var ownSketchesResult = await supabaseAdmin
      .from('Sketch')
      .select('id, file_url')
      .eq('uploader_user_id', targetUid)

    var ownSketches = ownSketchesResult.data || []
    var sketchIds = ownSketches.map(function (s) { return s.id })
    var filePaths = ownSketches
      .map(function (s) { return s.file_url })
      .filter(function (p) { return !!p })

    if (sketchIds.length > 0) {
      var feedbackFilesResult = await supabaseAdmin
        .from('SketchFeedback')
        .select('file_url')
        .in('sketch_id', sketchIds)

      var feedbackFiles = feedbackFilesResult.data || []
      feedbackFiles.forEach(function (f) {
        if (f.file_url) filePaths.push(f.file_url)
      })
    }

    // --- שלב 2: מחיקת הקבצים בפועל מה-Storage ---
    if (filePaths.length > 0) {
      var storageRemoveResult = await supabaseAdmin.storage.from('sketch-files').remove(filePaths)
      if (storageRemoveResult.error) {
        console.error('storage remove error:', storageRemoveResult.error.message)
        // ממשיכה בכל זאת - עדיף חשבון מחוק עם קובץ יתום מאשר לתקוע את כל התהליך
      }
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