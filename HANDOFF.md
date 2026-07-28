# HANDOFF.md – Rezo

## איך משתמשים בקובץ הזה:

* הקובץ הזה חי בשורש הריפו שלך ב-GitHub Codespaces.
* בסוף שיחת קוד, בקשי מקלוד: "תעדכן לי את ה-handoff על השיחה הזו" – קלוד יכתוב גרסה מעודכנת.
* מעתיקים ומדביקים ישירות לתוך `HANDOFF.md` בעורך הקוד של הקודספייס.
* Commit + Push כמו כל שינוי אחר.
* בתחילת שיחת קוד חדשה עם קלוד: מעתיקים את התוכן העדכני של הקובץ ומדביקים כהודעה ראשונה.
* אין צורך בהורדה למחשב בשום שלב.
* קטע הקוד (סעיף 11) בפורמט JSON קומפקטי - חוסך טוקנים בקריאה ובכתיבה. אם צריך את הקוד המלא של קובץ ספציפי, מבקשים מקלוד לפתוח אותו מהריפו.

---

## 0. סיכום יומי - 28.7.2026 (יום שלישי) - סגירת כל פערי האבטחה + מחיקת חשבון + השהיית חשבון

יום עבודה שני ברצף שמוקדש לאבטחה, בהמשך ישיר לסשן ה-RLS המלא של ה-26.7. המטרה: לסגור את כל 4 הפערים שנשארו פתוחים מהסשן הקודם, ולהוסיף שני פיצ'רים חדשים שנדרשים לפי חוק הגנת הפרטיות ומאגרי מידע: מחיקת חשבון והשהיית חשבון.

**מה נסגר היום, לפי הסדר:**

1. **הגדרות Auth נבדקו ותוקנו:** התגלה שהפורט של ה-Codespace השתנה (מ-5173 ל-5174) ולא היה מסונכרן מול Site URL/Redirect URLs ב-Supabase. עודכן. **לקח קבוע:** לבדוק את הפורט הנוכחי בתחילת כל יום עבודה - זה משתנה בין הפעלות.
2. **Rate Limits נסקרו** - כל ברירות המחדל של Supabase נמצאו סבירות. הערה לעתיד: 2 מיילים/שעה (ברירת מחדל של מייל Supabase המובנה) יצריך חיבור SMTP חיצוני (SendGrid/Resend) לפני שיהיו משתמשים אמיתיים.
3. **File size limit הועבר לרמת ה-bucket:** `file_size_limit = 52428800` (50MB) על `sketch-files`, כך שגם קריאת API ישירה נחסמת, לא רק בדיקת JS בצד לקוח.
4. **Allowed MIME types הוגדרו ברמת ה-bucket:** רשימה מלאה של פורמטי אודיו (mp3, wav, aiff, flac, ogg, m4a, webm), וידאו (mp4, mov, webm, avi), ומסמכים (pdf, doc, docx, txt) - כדי לכסות את כל הדרכים שמוזיקאים עובדים בהן, בלי לצמצם.
5. **RoomInvite - תוקן פער ה-"burn by anyone":** פוליסי UPDATE חדשה מגבילה שינוי לעמודת `used` בלבד (`false` → `true`), חד-פעמי. לא מונע ניחוש UUID (סיכון נמוך שכבר היה מתועד), אבל מונע שינוי שדות אחרים.
6. **Edge Function `extract-pdf-text` - נמצא ותוקן פער אמיתי:** ה-toggle "Verify JWT" היה כבוי **בלי שום בדיקת הרשאה בקוד** - כל אחד, גם לא מחובר, יכול היה לקרוא לפונקציה. נוספה בדיקת JWT ידנית בקוד (`supabase.auth.getUser(jwt)`) לפני כל עיבוד קובץ.
7. **מחיקת חשבון - פיצ'ר חדש מלא (דרישת חוק):**
   - פונקציית SQL חדשה `delete_account_data(target_uid uuid)` - SECURITY DEFINER, הרשאת הרצה רק ל-`service_role`. מוחקת לגמרי מה שבבעלות בלעדית (Profile, ProfessionalProfile, Sketch + הפידבק תחתן, LiveRoom שהמשתמש אירח + כל מה שתלוי בו). מאנונמת (משאירה תוכן, מוחקת זיהוי) מה שאחרים תלויים בו: פידבק שהמשתמש נתן על סקיצה של אחר, הודעות פרטיות (DM) - עם ניקוי נוסף אם שני הצדדים כבר מאונונמים.
   - **מגבלה מתועדת:** `Room_Participant` ו-`room_messages` אין להן `user_id` (רק `username` טקסט חופשי) - הזיהוי לצורך אנונימיזציה הוא best-effort לפי `display_name` שנשמר לפני המחיקה. לא מושלם (לא יזהה רשומות מלפני שינוי שם תצוגה), אבל המקסימום האפשרי בלי שינוי סכמה.
   - Edge Function חדשה `delete-account`: מאמתת JWT, אוספת נתיבי קבצים מה-Storage (סקיצות + פידבק תחתן), מוחקת אותם בפועל, קוראת ל-RPC של פונקציית ה-SQL, ולבסוף מוחקת את המשתמש מ-`auth.users` דרך Admin API.
   - Frontend: כפתור "מחיקת חשבון לצמיתות" בתפריט הפרופיל (`App.jsx`), פותח מודל ייעודי `DeleteAccountConfirmModal.jsx` שדורש הקלדת "מחק לצמיתות" במדויק לפני שהכפתור פעיל.
8. **השהיית חשבון - פיצ'ר חדש (הפיך, ללא הגבלת זמן):**
   - הוחלט מפורשות: זה **לא** מחיקה עם "תקופת חסד" - זו הפרדה לגמרי בין שני מסלולים (בדיוק כמו אינסטגרם/טוויטר): "השהיה" הפיכה בכל שלב (גם אחרי שנתיים), ו"מחיקה לצמיתות" בלתי הפיכה מהסעיף הקודם.
   - עמודה חדשה `Profile.deactivated_at` (timestamptz, NULL = פעיל).
   - **מנגנון "קוד במייל" לביטול השהיה נפתר בלי תשתית חדשה:** ה-Magic Link הקיים *הוא עצמו* מנגנון האימות (קישור מאובטח שרק בעלת החשבון יכולה לגשת אליו) - אין צורך בטבלת קודים/שליחת מייל מותאם/Edge Function נוסף.
   - RLS עודכן ב-3 טבלאות כדי להסתיר חשבון מושהה מכולם חוץ מהבעלים: `Profile`, `Sketch`, ו-`ProfessionalProfile` (האחרונה נתפסה כפער בבדיקה חוזרת - תוקנה באותו סשן). כנ"ל `LiveRoom` (חדרים של מארחת מושהית מוסתרים מרשימת החדרים הכללית; פוליסי ההזמנה הישירה של אורח לא נגעה בכוונה - תרחיש שולי מדי).
   - Frontend: כפתור "השהיית חשבון" בתפריט הפרופיל - פועל ישירות עם `window.confirm`, בלי מודל נפרד. `App.jsx` בודק `profile.deactivated_at` בתחילת הרינדור ומציג מסך חסימה ייעודי (`DeactivatedAccountScreen`) במקום כל שאר האתר, עם כפתור "בטלי השהיה".
9. **הידוק CORS על שתי ה-Edge Functions:** הוחלף `Access-Control-Allow-Origin: '*'` בקריאה ממשתנה סביבה `ALLOWED_ORIGIN` (Secret), כדי שהדומיין המורשה יהיה ניתן לעדכון בלי לפרוס קוד מחדש כשפורט הקודספייס משתנה.

**מבנה קבצים חדש שהתגבש תוך כדי (בעקבות משוב באמצע הסשן):** בהתחלה כל לוגיקת ניהול החשבון נכתבה בתוך `EditProfileModal.jsx`, ואז הועברה למודל נפרד `AccountManagementModal.jsx`, ולבסוף פוצלה לשני מסלולים נפרדים בתפריט עצמו (לא מודל ביניים): "מחיקת חשבון לצמיתות" ו"השהיית חשבון" כשתי שורות ישירות בתפריט, בין "עדכון פרטים" ל"התנתקות". `AccountManagementModal.jsx` בוטל לגמרי והוחלף ב-`DeleteAccountConfirmModal.jsx` (רק לוגיקת המחיקה; ההשהיה פועלת ישירות בלי מודל).

**סוגיות אבטחה שנותרו פתוחות במודע (הוחלט לא לטפל היום):**
- **זיוף MIME type ברמת ה-API הישיר:** הגבלת סוגי הקבצים פועלת רק מול Content-Type שהלקוח מצהיר עליו בהעלאה - מי שפונה ישירות ל-API יכול "לשקר". תיקון אמיתי (בדיקת magic bytes בפועל) דורש Edge Function ביניים ושינוי זרימת ההעלאה כולה - **הוחלט במודע לא לבנות זאת כרגע**. הערכת סיכון: נמוך בפועל, כי קבצים מוצגים רק בתוך `<audio>`/`<video>` מדומיין ה-Storage הנפרד, לא כ-HTML/iframe בדומיין הראשי של האתר - כך שאין נתיב XSS ישיר באתר עצמו.
- **השהיה נאכפת רק ב-UI, לא ב-RLS:** משתמשת מושהית לא נחסמת ב-Auth (לא "banned") - אם תעקוף את מסך החסימה ותפנה ישירות ל-API, היא עדיין תוכל לפעול בחשבון שלה. הנזק הפוטנציאלי מוגבל אליה בלבד (לא חושף מידע של אחרים), ולכן הוגדר כסיכון מקובל.
- **RoomInvite ניחוש UUID** ו-**Auth settings** - נותרו מתועדים מה-26.7, סיכון נמוך, לא טופלו.

---

## 0.1 סיכום יומי - 26.7.2026 (יום ראשון) - סשן אבטחה מלא

יום עבודה ממוקד לגמרי באבטחה מול Supabase, 09:47-כ-12:00, לפי תוכנית שהוכנה מראש (RLS_PLAN.md). התוצאה: **RLS פעיל על כל 10 הטבלאות**, ו-**Storage bucket עבר מפורמט ציבורי לפרטי עם Signed URLs**.

**מה נסגר באותו יום, לפי הסדר:**

1. **RLS על כל הטבלאות** (טבלה-טבלה, עם בדיקה בין כל שלב) - ראו JSON מפורט בסעיף 11 למטה למצב מדויק לכל טבלה (מעודכן ל-28.7). בקצרה: Profile, ProfessionalProfile, Sketch, SketchFeedback, LiveRoom, Room_Participant, RoomJoinRequest, RoomInvite - כולן עם policies מלאות ונבדקות. room_messages - RLS מודלק אך **בלי אף policy** (חסימה מוחלטת), כי לסכמה הקיימת אין זיהוי משתמש אמין (`sender` הוא username טקסט חופשי, לא user_id). DirectMessage - policies + **טריגר נוסף** (`restrict_direct_message_updates`) שאוכף ברמת עמודה בדיוק מי מותר לו לגעת ב-read_at/archived_by_sender/archived_by_recipient, ומונע משני הצדדים לשנות content/sender_id/recipient_id בכלל.

2. **Storage (sketch-files) - מיגרציה מ-bucket ציבורי ל-Signed URLs:** התגלה שה-bucket היה Public לגמרי (גם INSERT וגם SELECT פתוחים ל-`public`, כולל לא-מחוברים) - open relay להעלאות זרות, ודליפת קבצים של קטעים "פרטיים" (RLS על הטבלה לא מגן על הקובץ עצמו ב-Storage). תוקן: ה-bucket הפך לפרטי, נוספה policy על `storage.objects` שמשקפת בדיוק את הרשאות ה-Sketch/SketchFeedback המקושרים, וקוד ה-frontend עודכן לשמור נתיב גולמי בלבד (לא `getPublicUrl`) וליצור Signed URL (תקף לשעה) "לפי דרישה" בכל פתיחת מודל. פורט לשני קבצים: UploadSketchModal.jsx ו-SketchDetailModal.jsx (ראו JSON).

3. **תיקוני אגב שהתגלו תוך כדי:**
   - LiveRoom SELECT היה חסום לגמרי לאורח לא-מחובר → שבר את זרימת ה-invite link הקיימת (guest נכנס לפני התחברות). נוספה policy ייעודית: אורח רואה חדר **רק** אם קיימת עבורו הזמנה (`RoomInvite`) פעילה.
   - `room_messages` - `room_id` הוא `text` (לא uuid), ואין עמודת `sender_user_id`/user_id בכלל - רק `username` חופשי. לכן RLS על הטבלה הזו הוא deny-by-default זמני, עד שהסכמה תיבנה מחדש כשהצ'אט בפועל ייבנה.
   - טריגר ישן ושבור בשם `trg_Sketch_set_updated_date` (שריד מ-Base44, מנסה לעדכן עמודה `updated_date` שכבר נמחקה ב-23.7) חסם כל UPDATE על טבלת Sketch, כולל את הניקוי החד-פעמי של ה-Storage migration. **נמחק.**
   - קטע סאונד בפורמט WAV לא מתנגן בדפדפן (MP3 עובד תקין) - **לא קשור לאבטחה**, שגיאת קודק/פענוח מדיה בצד הדפדפן. נרשם כבאג נפרד ל-TODO.
   - העלאת קובץ אודיו איטית מאוד - נצפה באותו יום, סיבה לא אובחנה, TODO לסשן הבא.

**באג אמיתי לעומת false positive שנבדק ב-26.7:** תג "👑 את מנהלת את החדר" הופיע לשתי המשתמשות על אותו חדר - התברר שזה חדר **ישן** (17.07, לפני התיקון של ה-23.7 לזיהוי בעלות לפי `host_user_id`), בלי `host_user_id` בכלל, שנפל לfallback של `host_client_id` (שהוא per-דפדפן ולא per-חשבון). בדיקה עם חדר חדש (עם `host_user_id` תקין) אישרה שהזיהוי עובד נכון. **לא רגרסיה** - זו התנהגות ידועה ומתועדת לחדרים "יתומים" ישנים.

**הוחלט מפורשות:** הצפנה מקצה-לקצה (E2E) להודעות/חדרי לייב היא **נושא נפרד ומיועד לסשן מוקדש משלו** - לא המשך ישיר של עבודת ה-RLS. יש בו שאלות מוצר (למשל ויתור על יכולת מודרציה עתידית) שדורשות דיון נפרד לפני קוד.

---

## 1. רקע כללי (קבוע, לא משתנה בכל עדכון)

* שם הפרויקט: **Rezo** (שם הריפו ב-GitHub עדיין `LiveBeat` - טרם שונה, לא דחוף)
* קונספט: פלטפורמת קהילה-שיתוף לסקיצות מוזיקליות. שני אזורים:
   1. **אזור אסינכרוני** (כמו XPlace) – מוזיקאים מעלים סקיצה/קטע + מקבלים פידבק בדיון עם שרשראות תגובות.
   2. **אזור לייב** – משתמש פותח חדר וידאו/שמע בלייב בתוך הפלטפורמה, מורים ומשתמשים אחרים יכולים להצטרף ולדסקס.
* מודל עסקי: המוזיקאים החינמיים = התוכן/הטראפיק. המורים/מפיקים/אנשי מקצוע משלמים מנוי חודשי קבוע (לא עמלה מהעסקה) כדי לקבל גישה לפרטי קשר / יכולת לפנות למוזיקאים. **טרם מומש בקוד (המנוי/תשלום).**
* יתרון תחרותי מרכזי מול מתחרים כמו Muse: מודל מנוי קבוע ולא עמלה על עסקה.
* **מודל פרופילים: "גם וגם"** – משתמש יכול להיות גם יוצר וגם איש/אשת מקצוע במקביל. לא נכפית בחירת זהות יחידה.
* **הודעות אישיות (DM):** קיימות כפיצ'ר מלא - שיחה 1:1, תיבת דואר נכנס, ארכיון לפי צד. עדיין אין push notifications/מייל על הודעה חדשה. מוגנות RLS + טריגר הקשחה ברמת עמודה, ומאנונמות (לא נמחקות) בעת מחיקת חשבון של אחד הצדדים.
* **חשבון: שני מסלולים נפרדים** - השהיה (הפיכה, ללא הגבלת זמן, דרך התפריט) ומחיקה לצמיתות (בלתי הפיכה, דורשת הקלדת אישור). ראו סעיף 0 לפרטים המלאים.
* **תוכנית עתידית (לא בסשן קרוב):** הצפנה מקצה-לקצה ל-DM ואולי לחדרי לייב - דורשת סשן תכנון נפרד.

## 2. סביבת הפיתוח

* פיתוח בפועל: **GitHub Codespaces** (הכתובת הפעילה **כוללת פורט משתנה** - נצפה שינוי מ-5173 ל-5174 ב-28.7. **חובה לבדוק בתחילת כל יום עבודה**: את כתובת ה-URL הפעילה מול Site URL/Redirect URLs ב-Supabase Authentication, וגם מול ה-Secret `ALLOWED_ORIGIN` של שתי ה-Edge Functions - שלושתם חייבים להיות מסונכרנים.)
* בסיס נתונים + Auth + Storage + Edge Functions: **Supabase** (Project ref: `djygajgvpzdqddexyrgn`, region eu-central)
* **תוכנית Free - אין גיבויים אוטומטיים.** הוחלט ב-26.7 שזה בסדר כרגע כי אין עדיין משתמשים/דאטה אמיתיים - להעריך מחדש לפני השקה בפועל.
* Base44: שימש רק לעיצוב ראשוני - לא חלק מסביבת הפיתוח בפועל.
* וידאו/שמע אמיתי בחדרי לייב: **לא קיים** - כרגע רק Presence + כרטיסיות עיצוביות.
* Stack טכני: React + Vite, Tailwind CSS, `@supabase/supabase-js`
* Supabase CLI: `npm install supabase --save-dev`, מופעל דרך `npx supabase ...`. **הטוקן פג תוקף מדי פעם** - להריץ `npx supabase login` לפני כל פעולת CLI.
* **כלל ברזל להעתקת קוד/SQL בין הצ'אט לעורך:** תמיד כפתור ה-Copy שבפינת תיבת הקוד, אף פעם לא סימון ידני.
* **טיפ SQL Editor:** מריץ כמה פקודות ברצף (מופרדות ב-`;`) **כטרנזקציה אחת** - אם פקודה אחת נכשלת באמצע, כל הבלוק עלול להתבטל. פתרון: לכתוב policies בצורה idempotent עם `DROP POLICY IF EXISTS` לפני כל `CREATE POLICY`.
* **טיפ קריטי מ-28.7:** לפני `DROP POLICY`/`CREATE POLICY` על טבלה, **חובה** לבדוק קודם את שם הפוליסי המדויק הקיים עם:
  ```sql
  SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'שם_הטבלה' AND cmd = 'סוג_הפעולה';
  ```
  ניחוש שם גורם לכך שהפוליסי הישנה נשארת **לצד** החדשה (לא מוחלפת), ומכיוון שכמה policies מאותו סוג פעולה מתחברות ב-OR ב-Postgres, הישנה עלולה "לנצח" ולבטל את ההגבלה החדשה בלי שגיאה גלויה.
* **טיפ לבדיקת תרחישי "משתמש אחר":** תמיד לוודא דרך Supabase Dashboard → Authentication → Users → "Last sign in at" שבאמת התחלפת בין חשבונות. שימוש בחלונות Incognito נפרדים (לא רק טאבים) מומלץ.
* **Edge Functions - ניהול Secrets:** `ALLOWED_ORIGIN` (הדומיין המורשה ל-CORS) מוגדר דרך `npx supabase secrets set ALLOWED_ORIGIN=<כתובת>` - מתעדכן בלי לפרוס קוד מחדש. חובה לעדכן כשהפורט של הקודספייס משתנה.
* **הבדלה בין שתי Edge Functions בשם קובץ זהה (index.ts):** שם הקובץ תמיד `index.ts` (דרישת Supabase) - ההבדל הוא **שם התיקייה** (`supabase/functions/extract-pdf-text/` מול `supabase/functions/delete-account/`), לא שם הקובץ. לזיהוי איזה תוכן שייך לאיזו פונקציה: extract-pdf-text מכיל `pdf-parse`/`word-extractor`; delete-account מכיל `ownSketchesResult`/`auth.admin.deleteUser`.

## 3. מבנה הפרויקט (קבצים עיקריים)

```
src/
  main.jsx                       # עודכן 28.7 - state/handlers לניהול חשבון
  App.jsx                        # עודכן 28.7 - מסך חסימה להשהיה + תפריט פרופיל
  RoomPage.jsx
  index.css
  lib/
    supabaseClient.js
    clientId.js
    guestAccess.js
  components/
    CreateRoomModal.jsx
    JoinRoomModal.jsx
    AuthModal.jsx
    ProfileSetupModal.jsx
    EditProfileModal.jsx          # חזר למקור אחרי ניסוי קצר - ראו סעיף 0
    DeleteAccountConfirmModal.jsx # חדש 28.7 - רק לוגיקת מחיקה לצמיתות
    PendingRequestsBanner.jsx
    GuestJoinModal.jsx
    UploadSketchModal.jsx
    SketchDetailModal.jsx
    SketchCard.jsx
    InboxModal.jsx
    DirectMessageModal.jsx
    PublicProfileModal.jsx

supabase/
  functions/
    extract-pdf-text/
      index.ts                    # עודכן 28.7 - JWT check + CORS מהודק
    delete-account/
      index.ts                    # חדש 28.7 - מחיקת חשבון מלאה
```

## 4. טבלאות ב-Supabase (עמודות מרכזיות)

ראו HANDOFF-ים קודמים לרשימת עמודות מלאה. **שינוי סכמה מ-28.7:** `Profile` קיבלה עמודה חדשה `deactivated_at timestamptz DEFAULT NULL`.

RLS פעיל על כל הטבלאות מאז ה-26.7 - ראו סעיף 11 למצב מדויק ומעודכן לכל טבלה.

הערה שנותרה רלוונטית: `room_messages` בפועל שונה ממה שהיה מתועד במקור - `room_id` הוא `text` לא `uuid`, ואין `sender_user_id`/`user_id`, רק `username` טקסט חופשי. יידרש שכתוב סכמה לפני חיווט הצ'אט בפועל.

## 5. Storage

* Bucket `sketch-files` - **פרטי** (מ-26.7).
* **מ-28.7:** `file_size_limit = 52428800` (50MB) ו-`allowed_mime_types` (רשימה מלאה של אודיו/וידאו/מסמכים) מוגדרים ברמת ה-bucket עצמו - אוכפים גם מול קריאת API ישירה, לא רק בדיקת JS בצד לקוח.
* **מגבלה מתועדת ומודעת (28.7):** ההגבלה על סוג הקובץ מסתמכת על ה-Content-Type שהלקוח מצהיר עליו בהעלאה - זיוף API ישיר אפשרי טכנית. הוחלט לא לבנות שכבת בדיקת magic-bytes (תדרוש Edge Function ביניים ושינוי זרימת ההעלאה) כי הסיכון בפועל נמוך - קבצים מוצגים רק בתוך `<audio>`/`<video>` מדומיין Storage נפרד, לא כ-HTML בדומיין הראשי.
* Policies על `storage.objects`: INSERT ל-`authenticated` בלבד; SELECT מבוסס-הרשאות (owner או Sketch/SketchFeedback מקושר עם הרשאה מתאימה).
* URL strategy: Signed URLs (תקף לשעה), נוצרים "לפי דרישה" בצד לקוח.
* עיקרון "טקסט בלבד" לקבצי מסמך - ללא שינוי, עדיין בתוקף.
* קבצי סקיצה של משתמש שנמחק לצמיתות (Sketch + SketchFeedback תחתן) נמחקים בפועל מה-Storage כחלק מתהליך מחיקת החשבון (ראו סעיף 0).

## 6. Edge Functions

* **`extract-pdf-text`** - עודכן 28.7: נוספה בדיקת JWT ידנית בקוד (ה-toggle "Verify JWT" נשאר כבוי במכוון, כמומלץ ע"י Supabase, אבל הקוד עצמו עכשיו אוכף הרשאה). CORS מהודק דרך `ALLOWED_ORIGIN` secret.
* **`delete-account`** (חדש 28.7) - מאמתת JWT, מוחקת קבצי Storage רלוונטיים, קוראת ל-RPC `delete_account_data`, מוחקת את המשתמש מ-`auth.users`. גם כאן CORS מהודק דרך `ALLOWED_ORIGIN`.

## 7. מה עובד ונבדק כרגע

כל הפיצ'רים המתועדים ב-HANDOFF-ים קודמים עדיין עובדים (אימות, פרופילים כולל "גם מקצוען", חדרי לייב, פיד היצירה, הודעות אישיות, קטעים פרטיים/ציבוריים עם Signed URLs).

**חדש ונבדק ב-28.7:**
- מחיקת חשבון: כפתור בתפריט → מודל דורש הקלדת "מחק לצמיתות" → הכפתור נדלק רק בהקלדה מדויקת (נבדק ויזואלית, טרם נבדק end-to-end בפועל - TODO לסשן הבא).
- השהיית חשבון: כפתור בתפריט → `window.confirm` מוצג כמצופה (נבדק). ביטול/מסך חסימה בפועל - טרם נבדק end-to-end (TODO לסשן הבא).
- RLS: ProfessionalProfile ו-LiveRoom מוסתרים כשהבעלים מושהה (SQL הורץ ואושר).
- CORS מהודק על שתי ה-Edge Functions (הקוד עודכן והוטמע, secret הוגדר).

## 8. מה בתהליך / שבור / לא גמור

**פיצ'רים לא גמורים (ללא שינוי):** הפרדת פרופילים המלאה, כלי פידבק מתקדמים, מונטיזציה, וידאו/מיקרופון אמיתיים, צ'אט בחדר לייב, שכתוב סכמת `room_messages`.

**נותר מ-26.7, טרם טופל:**
- קטעי WAV לא מתנגנים בדפדפן (MP3 עובד) - שגיאת קודק, לא אבטחתי.
- העלאת קובץ אודיו איטית - לא אובחן.
- חדר חדש לא מופיע בלי רענון ידני - חסר Realtime subscription ל-LiveRoom.
- אין גיבוי אוטומטי (Free plan) - מקובל זמנית.

**TODO מיידי לסשן הבא (28.7):**
- בדיקת end-to-end בפועל: יצירת משתמש בדיקה, מחיקה לצמיתות, ואימות שהכל נמחק/מאונונם נכון בטבלאות + ב-Storage + ב-auth.users.
- בדיקת end-to-end בפועל: השהיה → מסך חסימה מיד גם אחרי logout+login מחדש → ביטול → חזרה לאתר.
- לוודא ש-`onProfileUpdated` ב-`main.jsx` באמת מזרים את השינוי (`deactivated_at`) ל-`App.jsx` בפועל (ההנחה הייתה נכונה בקוד, אבל לא אומת בדפדפן בפועל).

**סגור לגמרי (הוסר מרשימת TODO ב-28.7):**
- RLS על כל הטבלאות (הושלם 26.7)
- Auth URL config, Rate limits, File size + MIME whitelist, RoomInvite burn, extract-pdf-text JWT, CORS - כולם נסגרו היום.
- מחיקת חשבון + השהיית חשבון - נבנו היום (בדיקת end-to-end בפועל נותרה, ראו למעלה).

## 9. החלטות טכניות שכבר התקבלו (לא לפתוח מחדש דיון)

כל ההחלטות הקודמות עדיין בתוקף. **נוספו ב-28.7:**
- **מחיקת חשבון = אנונימיזציה, לא מחיקה מוחלטת של הכל.** מה שבבעלות בלעדית נמחק; מה שאחרים תלויים בו (פידבק על סקיצה של מישהו אחר, DM) מאונונם. זה תואם את הדרישה החוקית (הסרת זיהוי אישי, לא השמדה פיזית מוחלטת של כל שורה).
- **השהיה ומחיקה הם שני מסלולים נפרדים לגמרי**, לא "תקופת חסד" לפני מחיקה סופית. השהיה הפיכה תמיד, מחיקה בלתי הפיכה תמיד. לא לערבב בין השניים בעתיד.
- **ביטול השהיה נעשה דרך ה-Magic Link הקיים**, לא מנגנון קוד/מייל מותאם נפרד - שיקול יעילות מכוון.
- **ניהול חשבון (השהיה/מחיקה) חי כשתי שורות ישירות בתפריט הפרופיל**, לא בתוך מודל עריכת פרטים ולא מאוחד במודל "ניהול חשבון" אחד - הוחלט אחרי כמה איטרציות באותו סשן.
- **CORS על Edge Functions דרך `ALLOWED_ORIGIN` secret**, לא hardcoded ולא wildcard קבוע - מאפשר עדכון בלי redeploy כשהפורט משתנה.
- **זיוף MIME type ברמת ה-API לא ייסגר בקרוב הקרוב** - סיכון מקובל במודע, ראו סעיף 5.
- הצפנה מקצה-לקצה (E2E) - עדיין נושא נפרד, סשן תכנון ייעודי.

## 10. שאלות/החלטות פתוחות לשיחה הבאה

**ממשיכות מסשנים קודמים (עדיין פתוחות):**
- השלב הבא באיפיון הפרופילים (Feed/Showcase נפרד, Portfolio, CTA שונה בין Creator ל-Professional)?
- להוסיף בחירת "גם מקצוען" גם ל-ProfileSetupModal הראשוני?
- מתי לגשת להבדלי חדרי הלייב (Stage מול Peer-to-Peer, תור מובנה)?
- מתי לגשת לכלי הפידבק המתקדמים (Waveform annotation, Rubric)?
- מתי לגשת למונטיזציה?
- מתי לגשת לווידאו/מיקרופון אמיתי ולצ'אט החי בחדר?
- הודעות אישיות: push/מייל על הודעה חדשה? ארכוב שיחה שלמה בלחיצה אחת?

**חדש מ-28.7:**
- לבצע את בדיקות ה-end-to-end שנרשמו בסעיף 8 (מחיקה, השהיה) לפני שממשיכים לפיצ'רים אחרים.
- אם בעתיד ירצו לכסות גם את התרחיש השולי של הזמנת אורח לחדר של מארחת שהשהתה חשבון תוך כדי (כרגע לא מטופל בכוונה).
- להחליט אם/מתי בכל זאת להשקיע בשכבת בדיקת magic-bytes לקבצים (כרגע דחוי במודע).

---

## 11. קוד ומצב טכני - פורמט JSON קומפקטי

```json
{
  "last_updated": "2026-07-28",
  "session_focus": "closing all remaining security gaps + account deletion + account deactivation",
  "files_changed_today": [
    {
      "path": "supabase/functions/extract-pdf-text/index.ts",
      "change": "Added manual JWT verification (supabase.auth.getUser) before any file processing. Tightened CORS to read ALLOWED_ORIGIN from env instead of wildcard.",
      "status": "delivered, deployed, confirmed working (document upload still works when authenticated)"
    },
    {
      "path": "supabase/functions/delete-account/index.ts",
      "change": "New function. Verifies JWT, collects Storage file paths (own sketches + feedback under them), deletes those files, calls delete_account_data RPC, deletes the user via auth.admin.deleteUser. CORS tightened via ALLOWED_ORIGIN.",
      "status": "delivered, deployed. End-to-end test with a real test account still pending."
    },
    {
      "path": "src/App.jsx",
      "change": "Added DeactivatedAccountScreen (blocks entire app UI when profile.deactivated_at is set, offers reactivation). Added two menu items directly in profile dropdown: 'מחיקת חשבון לצמיתות' (opens modal via onOpenDeleteAccount) and 'השהיית חשבון' (direct action via onDeactivateAccount, with window.confirm).",
      "status": "delivered as full file, pasted, confirmed menu renders correctly. Full end-to-end (deactivate -> block screen -> reactivate) not yet tested."
    },
    {
      "path": "src/main.jsx",
      "change": "Added isDeleteAccountModalOpen state, handleOpenDeleteAccount, handleDeactivateAccount (direct supabase update to Profile.deactivated_at). Renders DeleteAccountConfirmModal instead of old combined AccountManagementModal. Passes onOpenDeleteAccount/onDeactivateAccount to App.",
      "status": "delivered as full file, pasted, confirmed working"
    },
    {
      "path": "src/components/DeleteAccountConfirmModal.jsx",
      "change": "New file, replacing the short-lived AccountManagementModal.jsx. Only handles permanent deletion: requires typing exact confirmation phrase before enabling delete button, calls supabase.functions.invoke('delete-account'), then signs out and reloads.",
      "status": "delivered, confirmed rendering (button lights up correctly on exact match)"
    },
    {
      "path": "src/components/EditProfileModal.jsx",
      "change": "Reverted to original content - account management logic was tried here first, then moved out entirely per user feedback (should live in profile menu, not inside edit-details modal).",
      "status": "reverted to pre-session-start content, confirmed"
    }
  ],
  "files_deleted_today": [
    { "path": "src/components/AccountManagementModal.jsx", "reason": "superseded - split into direct menu actions + DeleteAccountConfirmModal.jsx per user preference" }
  ],
  "sql_run_today": [
    { "purpose": "50MB file size limit at bucket level", "target": "storage.buckets.sketch-files.file_size_limit", "status": "confirmed" },
    { "purpose": "Full allowed MIME types whitelist at bucket level (audio/video/document formats)", "target": "storage.buckets.sketch-files.allowed_mime_types", "status": "confirmed" },
    { "purpose": "RoomInvite UPDATE policy restricted to used:false->true only", "target": "RoomInvite policy", "status": "confirmed" },
    { "purpose": "delete_account_data(uuid) SECURITY DEFINER function - deletes own content, anonymizes dependent content, execute granted to service_role only", "target": "public.delete_account_data", "status": "confirmed" },
    { "purpose": "Profile.deactivated_at column added", "target": "Profile table", "status": "confirmed" },
    { "purpose": "Profile SELECT policy updated to hide deactivated accounts from others", "target": "'Profiles are viewable by authenticated users'", "status": "confirmed" },
    { "purpose": "Sketch SELECT policy updated to hide sketches of deactivated uploaders from others", "target": "'Sketches are viewable if public or owned'", "status": "confirmed" },
    { "purpose": "ProfessionalProfile SELECT policy updated to hide deactivated accounts from others (gap found during same-session review)", "target": "'Professional profiles are viewable by authenticated users'", "status": "confirmed" },
    { "purpose": "LiveRoom general SELECT policy updated to hide rooms of deactivated hosts from others (invite-based policy intentionally left untouched)", "target": "'Rooms are viewable by authenticated users'", "status": "confirmed" }
  ],
  "rls_status": {
    "Profile": { "enabled": true, "policies": ["select: authenticated read-all UNLESS deactivated_at IS NOT NULL (then only owner) - updated 2026-07-28", "insert: own id only", "update: own id only"] },
    "ProfessionalProfile": { "enabled": true, "policies": ["select: authenticated read-all UNLESS linked Profile is deactivated (then only owner) - updated 2026-07-28", "insert/update/delete: own id only"] },
    "Sketch": { "enabled": true, "policies": ["select: is_public=true AND uploader not deactivated, OR own - updated 2026-07-28", "insert: own uploader_user_id only", "update/delete: own only"] },
    "SketchFeedback": { "enabled": true, "policies": ["select/insert: tied to related Sketch visibility", "update/delete: own author_user_id only"] },
    "LiveRoom": { "enabled": true, "policies": ["select (general): authenticated read-all UNLESS host is deactivated (then only host sees it) - updated 2026-07-28", "select (extra): public/anon if a matching RoomInvite exists - unchanged, does not check host deactivation", "insert/update/delete: own host_user_id only"] },
    "Room_Participant": { "enabled": true, "policies": ["select: authenticated read-all (historical log, low sensitivity)", "insert: any authenticated user (no user_id column exists to restrict further)"], "known_gap": "no user_id column, can't enforce 'insert only your own record'; account deletion anonymizes by matching stored display_name, best-effort only" },
    "RoomJoinRequest": { "enabled": true, "policies": ["select/update/delete: requester or host of related room", "insert: own requester_user_id only"] },
    "RoomInvite": { "enabled": true, "policies": ["select: public (needed for pre-auth guest flow)", "insert/delete: host of related room only", "update: public, only if used=false -> used=true, no other field changeable - tightened 2026-07-28"], "known_gap": "anyone can still mark any unused invite as used without actually joining (low risk, random UUID) - unchanged" },
    "room_messages": { "enabled": true, "policies": [], "note": "DENY-BY-DEFAULT, unchanged. Needs schema rework (sender_user_id uuid) before real policies can be written." },
    "DirectMessage": { "enabled": true, "policies": ["select: sender or recipient only", "insert: own sender_id only", "update: sender or recipient (row-level)"], "extra_protection": "BEFORE UPDATE trigger 'restrict_direct_message_updates' unchanged", "account_deletion_behavior": "sender_id/recipient_id set NULL and username set to 'משתמש שנמחק' on deletion; row itself deleted only if both sides already anonymized" }
  },
  "storage": {
    "bucket": "sketch-files",
    "public": false,
    "file_size_limit_bytes": 52428800,
    "allowed_mime_types_set": true,
    "url_strategy": "signed URLs, 3600s expiry, generated on demand client-side via createSignedUrl",
    "known_residual_risk": "MIME type enforcement relies on client-declared Content-Type; a direct API call could spoof it. Deliberately not building magic-byte verification layer today - risk assessed as low since files are only rendered inside <audio>/<video> tags from the separate Storage domain, not as HTML in the main app origin.",
    "account_deletion_cleanup": "files under user's own Sketch rows (and SketchFeedback rows attached to those sketches, regardless of author) are actually removed from Storage during account deletion, before the DB rows are deleted"
  },
  "edge_functions": {
    "extract-pdf-text": { "verify_jwt_toggle": false, "manual_jwt_check_in_code": true, "cors": "reads ALLOWED_ORIGIN env var, falls back to '*' if unset" },
    "delete-account": { "verify_jwt_toggle": false, "manual_jwt_check_in_code": true, "cors": "reads ALLOWED_ORIGIN env var, falls back to '*' if unset", "flow": ["verify JWT -> get target_uid", "collect Storage paths: own Sketch.file_url + SketchFeedback.file_url under own sketches", "storage.remove(paths)", "rpc('delete_account_data', {target_uid})", "auth.admin.deleteUser(target_uid)"] }
  },
  "account_lifecycle_design": {
    "deactivation": {
      "reversible": true,
      "no_time_limit": true,
      "mechanism": "Profile.deactivated_at timestamp set/cleared via direct client-side supabase update (allowed by existing owner-only UPDATE policy)",
      "hiding": "RLS-level, hides Profile/Sketch/ProfessionalProfile/LiveRoom(hosted) from everyone except the owner",
      "login_still_works": true,
      "reactivation_mechanism": "reuses existing Magic Link login itself as the identity-verification step; app then shows a dedicated block screen with a reactivate button that clears deactivated_at",
      "known_limitation": "enforcement is UI-layer + RLS-for-others only; the deactivated user's own API calls to their own rows are not blocked at the RLS layer, since they still hold a valid, non-banned JWT. Impact limited to the user themselves, not third parties."
    },
    "permanent_deletion": {
      "reversible": false,
      "requires_typed_confirmation": "מחק לצמיתות",
      "legal_basis": "anonymization of dependent third-party content + full deletion of exclusively-owned content satisfies erasure requirement under privacy law (equivalent to GDPR Article 17 approach), without breaking other users' threads/conversations"
    }
  },
  "pending_verification": [
    "end-to-end test of permanent deletion with a disposable test account (verify Storage files gone, DB rows deleted/anonymized correctly, auth.users entry gone, login impossible afterward)",
    "end-to-end test of deactivation (block screen appears immediately, persists across logout+login, reactivation restores full access)",
    "confirm that handleProfileUpdated in main.jsx correctly propagates deactivated_at changes down to App.jsx in the live browser (logic assumed correct from code review, not yet observed running)"
  ]
}
```