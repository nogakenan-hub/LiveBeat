// Edge Function: admin-set-subscription
// עדכון סטטוס מנוי למקצוען/ית - זמין **רק** למשתמשת האדמין (נגה), נאכף בשרת.
// הטריגר trg_restrict_subscription_update חוסם עדכון של השדות האלה מכל
// משתמש/ת עם auth.role()='authenticated' (כולל המקצוען עצמו/ה) - כדי לעקוף
// אותו כאן, נעשה שימוש ב-Service Role Key (auth.role() הופך ל-'service_role',
// שהטריגר לא בודק אותו), ובודקים זהות אדמין בעצמנו קודם.

var ALLOWED_ORIGIN_PATTERN = /^https:\/\/[a-z0-9-]+\.app\.github\.dev$/

// user_id קבוע של נגה (auth.users) - היחידה שמורשית להשתמש בפונקציה הזו.
var ADMIN_USER_ID = 'b10531e5-2115-43d4-99f2-3205c697b01e'

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
    // --- שלב 0: אימות זהות הקוראה ---
    var authHeader = req.headers.get('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'נדרשת התחברות' }),
        { status: 401, headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }) }
      )
    }

    var jwt = authHeader.replace('Bearer ', '')

    var supabaseModule = await import('npm:@supabase/supabase-js@2')
    var createClient = supabaseModule.createClient

    var supabaseUrl = Deno.env.get('SUPABASE_URL')
    var anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    var serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    var supabaseUser = createClient(supabaseUrl, anonKey)
    var userResult = await supabaseUser.auth.getUser(jwt)
    var user = userResult.data ? userResult.data.user : null

    if (userResult.error || !user) {
      return new Response(
        JSON.stringify({ error: 'הרשאה לא תקינה' }),
        { status: 401, headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }) }
      )
    }

    // --- שלב 1: בדיקת הרשאת אדמין - זו הפונקציה שאוכפת "רק נגה" ---
    if (user.id !== ADMIN_USER_ID) {
      return new Response(
        JSON.stringify({ error: 'אין הרשאה - פעולה זו זמינה רק לאדמין' }),
        { status: 403, headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }) }
      )
    }

    // --- שלב 2: קריאת הפרמטרים מהבקשה ---
    var body = await req.json()
    var professionalUserId = body.professional_user_id
    var subscriptionStatus = body.subscription_status
    var subscriptionExpiresAt = body.subscription_expires_at || null

    if (!professionalUserId) {
      return new Response(
        JSON.stringify({ error: 'חסר professional_user_id' }),
        { status: 400, headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }) }
      )
    }

    if (subscriptionStatus !== 'active' && subscriptionStatus !== 'inactive') {
      return new Response(
        JSON.stringify({ error: 'subscription_status חייב להיות active או inactive' }),
        { status: 400, headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }) }
      )
    }

    // --- שלב 3: העדכון עצמו, עם Service Role - עוקף את הטריגר ---
    var supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    var updateResult = await supabaseAdmin
      .from('ProfessionalProfile')
      .update({
        subscription_status: subscriptionStatus,
        subscription_expires_at: subscriptionExpiresAt,
      })
      .eq('id', professionalUserId)
      .select()
      .single()

    if (updateResult.error) {
      throw new Error(updateResult.error.message)
    }

    return new Response(
      JSON.stringify({ success: true, profile: updateResult.data }),
      { headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }) }
    )
  } catch (error) {
    var message = error && error.message ? error.message : String(error)
    console.error('admin-set-subscription error:', message)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }) }
    )
  }
})