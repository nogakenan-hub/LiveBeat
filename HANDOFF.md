# HANDOFF.md – Rezo

## איך משתמשים בקובץ הזה:

* הקובץ הזה חי בשורש הריפו שלך ב-GitHub Codespaces.
* בסוף שיחת קוד, בקשי מקלוד: "תעדכן לי את ה-handoff על השיחה הזו" – קלוד יכתוב גרסה מעודכנת.
* מעתיקים ומדביקים ישירות לתוך `HANDOFF.md` בעורך הקוד של הקודספייס.
* Commit + Push כמו כל שינוי אחר.
* בתחילת שיחת קוד חדשה עם קלוד: מעתיקים את התוכן העדכני של הקובץ ומדביקים כהודעה ראשונה.
* אין צורך בהורדה למחשב בשום שלב.
* **הערה חדשה מה-26.7:** קטע הקוד (סעיף 11) עכשיו בפורמט JSON קומפקטי במקום פרוזה/קוד מלא - חוסך טוקנים בקריאה ובכתיבה. אם צריך את הקוד המלא של קובץ ספציפי, מבקשים מקלוד לפתוח אותו מהריפו.

---

## 0. סיכום יומי - 26.7.2026 (יום ראשון) - סשן אבטחה מלא

יום עבודה ממוקד לגמרי באבטחה מול Supabase, 09:47-כ-12:00, לפי תוכנית שהוכנה מראש (RLS_PLAN.md). התוצאה: **RLS פעיל על כל 10 הטבלאות**, ו-**Storage bucket עבר מפורמט ציבורי לפרטי עם Signed URLs**.

**מה נסגר היום, לפי הסדר:**

1. **RLS על כל הטבלאות** (טבלה-טבלה, עם בדיקה בין כל שלב) - ראו JSON מפורט בסעיף 11 למטה למצב מדויק לכל טבלה. בקצרה: Profile, ProfessionalProfile, Sketch, SketchFeedback, LiveRoom, Room_Participant, RoomJoinRequest, RoomInvite - כולן עם policies מלאות ונבדקות. room_messages - RLS מודלק אך **בלי אף policy** (חסימה מוחלטת), כי לסכמה הקיימת אין זיהוי משתמש אמין (`sender` הוא username טקסט חופשי, לא user_id). DirectMessage - policies + **טריגר נוסף** (`restrict_direct_message_updates`) שאוכף ברמת עמודה בדיוק מי מותר לו לגעת ב-read_at/archived_by_sender/archived_by_recipient, ומונע משני הצדדים לשנות content/sender_id/recipient_id בכלל.

2. **Storage (sketch-files) - מיגרציה מ-bucket ציבורי ל-Signed URLs:** התגלה שה-bucket היה Public לגמרי (גם INSERT וגם SELECT פתוחים ל-`public`, כולל לא-מחוברים) - open relay להעלאות זרות, ודליפת קבצים של קטעים "פרטיים" (RLS על הטבלה לא מגן על הקובץ עצמו ב-Storage). תוקן: ה-bucket הפך לפרטי, נוספה policy על `storage.objects` שמשקפת בדיוק את הרשאות ה-Sketch/SketchFeedback המקושרים, וקוד ה-frontend עודכן לשמור נתיב גולמי בלבד (לא `getPublicUrl`) וליצור Signed URL (תקף לשעה) "לפי דרישה" בכל פתיחת מודל. פורט לשני קבצים: UploadSketchModal.jsx ו-SketchDetailModal.jsx (ראו JSON).

3. **תיקוני אגב שהתגלו תוך כדי:**
   - LiveRoom SELECT היה חסום לגמרי לאורח לא-מחובר → שבר את זרימת ה-invite link הקיימת (guest נכנס לפני התחברות). נוספה policy ייעודית: אורח רואה חדר **רק** אם קיימת עבורו הזמנה (`RoomInvite`) פעילה.
   - `room_messages` - `room_id` הוא `text` (לא uuid), ואין עמודת `sender_user_id`/user_id בכלל - רק `username` חופשי. לכן RLS על הטבלה הזו הוא deny-by-default זמני, עד שהסכמה תיבנה מחדש כשהצ'אט בפועל ייבנה.
   - טריגר ישן ושבור בשם `trg_Sketch_set_updated_date` (שריד מ-Base44, מנסה לעדכן עמודה `updated_date` שכבר נמחקה ב-23.7) חסם כל UPDATE על טבלת Sketch, כולל את הניקוי החד-פעמי של ה-Storage migration. **נמחק.**
   - קטע סאונד בפורמט WAV לא מתנגן בדפדפן (MP3 עובד תקין) - **לא קשור לאבטחה**, שגיאת קודק/פענוח מדיה בצד הדפדפן. נרשם כבאג נפרד ל-TODO.
   - העלאת קובץ אודיו איטית מאוד - נצפה היום, סיבה לא אובחנה עדיין, TODO לסשן הבא.

**באג אמיתי לעומת false positive שנבדק היום:** תג "👑 את מנהלת את החדר" הופיע לשתי המשתמשות על אותו חדר - התברר שזה חדר **ישן** (17.07, לפני התיקון של ה-23.7 לזיהוי בעלות לפי `host_user_id`), בלי `host_user_id` בכלל, שנפל לfallback של `host_client_id` (שהוא per-דפדפן ולא per-חשבון). בדיקה עם חדר חדש (עם `host_user_id` תקין) אישרה שהזיהוי עובד נכון. **לא רגרסיה** - זו התנהגות ידועה ומתועדת לחדרים "יתומים" ישנים.

**סוגיות אבטחה נוספות שעלו אך לא טופלו (TODO, לא דחוף כמו מה שכבר נסגר):**
- RoomInvite: כל אחד (גם לא-מחובר) יכול לסמן הזמנה כ"נוצלה" מבלי לוודא שהוא זה שבאמת נכנס - סיכון נמוך (UUID אקראי), אבל לא מדויק.
- Edge Function `extract-pdf-text` - לא נבדק אם יש אכיפת JWT (`verify_jwt`) בכניסה; אם פתוחה לגמרי, פוטנציאל להצפה/עלות.
- הגבלת 50MB לקובץ - כרגע רק בצד הלקוח (JS), אפשר לעקוף בקריאת API ישירה.
- הגדרות Auth (Site URL/Redirect URLs, קצב שליחת Magic Link) - עדיין לא נסקרו.

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
* **הודעות אישיות (DM):** קיימות כפיצ'ר מלא - שיחה 1:1, תיבת דואר נכנס, ארכיון לפי צד. עדיין אין push notifications/מייל על הודעה חדשה. **מ-26.7: מוגנות RLS + טריגר הקשחה ברמת עמודה.**
* **תוכנית עתידית (לא בסשן קרוב):** הצפנה מקצה-לקצה ל-DM ואולי לחדרי לייב - דורשת סשן תכנון נפרד.

## 2. סביבת הפיתוח

* פיתוח בפועל: **GitHub Codespaces** (כתובת נוכחית: `https://friendly-space-succotash-x56g77qpppjg297x6-5173.app.github.dev` - **עלולה להשתנות**; אם כן, לעדכן ב-Supabase → Authentication → URL Configuration את ה-Site URL וה-Redirect URLs, אחרת Magic Link יפסיק לעבוד. **טרם נסקר מ-26.7 כפריט TODO.**)
* בסיס נתונים + Auth + Storage + Edge Functions: **Supabase** (Project ref: `djygajgvpzdqddexyrgn`, region eu-central)
* **תוכנית Free - אין גיבויים אוטומטיים** (Database → Backups מציג "Free Plan does not include project backups"). הוחלט ב-26.7 שזה בסדר כרגע כי אין עדיין משתמשים/דאטה אמיתיים - להעריך מחדש לפני השקה בפועל.
* Base44: שימש רק לעיצוב ראשוני - לא חלק מסביבת הפיתוח בפועל. השאיר שיריות (עמודות/טבלאות/**טריגר**) מאחורי הקלעים - כולל טריגר שבור שנמצא ונמחק ב-26.7 (ראו סעיף 0).
* וידאו/שמע אמיתי בחדרי לייב: **לא קיים** - כרגע רק Presence + כרטיסיות עיצוביות.
* Stack טכני: React + Vite, Tailwind CSS, `@supabase/supabase-js`
* Supabase CLI: `npm install supabase --save-dev`, מופעל דרך `npx supabase ...`. **הטוקן פג תוקף מדי פעם** - להריץ `npx supabase login` לפני כל פעולת CLI.
* **כלל ברזל להעתקת קוד/SQL בין הצ'אט לעורך:** תמיד כפתור ה-Copy שבפינת תיבת הקוד, אף פעם לא סימון ידני - אושר שוב ב-26.7 (סימון חלקי גרם לשגיאת syntax ב-SQL Editor).
* **טיפ SQL Editor:** מריץ כמה פקודות ברצף (מופרדות ב-`;`) **כטרנזקציה אחת** - אם פקודה אחת נכשלת באמצע, כל הבלוק (כולל מה שהצליח קודם) עלול להתבטל. פתרון: לכתוב policies בצורה idempotent עם `DROP POLICY IF EXISTS` לפני כל `CREATE POLICY`, כדי שאפשר יהיה להריץ שוב בבטחה אחרי כישלון חלקי.
* **טיפ לבדיקת תרחישי "משתמש אחר":** תמיד לוודא דרך Supabase Dashboard → Authentication → Users → "Last sign in at" שבאמת התחלפת בין חשבונות, ולא רק בהרגשה. שימוש בחלונות Incognito נפרדים (לא רק טאבים) מומלץ.

## 3. מבנה הפרויקט (קבצים עיקריים)

```
src/
  main.jsx
  App.jsx
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
    EditProfileModal.jsx
    PendingRequestsBanner.jsx
    GuestJoinModal.jsx
    UploadSketchModal.jsx        # עודכן 26.7 - ראו JSON בסעיף 11
    SketchDetailModal.jsx        # עודכן 26.7 - ראו JSON בסעיף 11
    SketchCard.jsx                # נבדק 26.7, לא נגע בקובץ - אין רינדור מדיה ישיר
    InboxModal.jsx
    DirectMessageModal.jsx
    PublicProfileModal.jsx

supabase/
  functions/
    extract-pdf-text/
      index.ts                    # לא נסקר עדיין מבחינת אבטחה (TODO)
```

## 4. טבלאות ב-Supabase (עמודות מרכזיות) - ללא שינוי סכמה מ-23.7

ראו HANDOFF קודם לרשימת עמודות מלאה. **שינוי מהותי מ-26.7: RLS פעיל על כל הטבלאות** - ראו סעיף 11 למצב מדויק לכל טבלה.

הערה חשובה שהתגלתה היום: `room_messages` בפועל **שונה** ממה שהיה מתועד - `room_id` הוא `text` לא `uuid`, ואין `sender_user_id`/`user_id`, רק `username` טקסט חופשי. יידרש שכתוב סכמה (הוספת `sender_user_id uuid`) לפני חיווט הצ'אט בפועל.

## 5. Storage - עודכן מהותית ב-26.7

* Bucket `sketch-files` - **הפך מ-Public ל-Private ב-26.7.**
* Policies על `storage.objects` (bucket `sketch-files` בלבד):
  - INSERT: `TO authenticated` בלבד (היה `public` לפני 26.7 - open relay שנסגר)
  - SELECT: מבוססת-הרשאות - `owner = auth.uid()` **או** קיים Sketch/SketchFeedback מקושר שה-`is_public`/הבעלות שלו מתירים גישה (זהה ללוגיקה שכבר קיימת ב-RLS של אותן טבלאות)
* **קוד (UploadSketchModal.jsx, SketchDetailModal.jsx):** לא שומרים יותר `getPublicUrl()`. שומרים רק את הנתיב הגולמי ב-Storage (`file_url` בטבלה מכיל path, לא URL). בזמן תצוגה, נוצר **Signed URL** (`createSignedUrl`, תקף לשעה) "לפי דרישה" - בפתיחת SketchDetailModal לקובץ הראשי, ובטעינת הפידבקים לכל קובץ מצורף. תגובה חדשה עם מדיה מקבלת Signed URL מיידי כדי שתהיה ניתנת לניגון בלי לרענן.
* **מיגרציה חד-פעמית שהורצה:** שורות ישנות ב-Sketch/SketchFeedback ששמרו URL ציבורי מלא הומרו לנתיב גולמי (regexp על `/sketch-files/`).
* עיקרון "טקסט בלבד" לקבצי מסמך - ללא שינוי, עדיין בתוקף.
* **TODO:** הגבלת 50MB היא רק בצד לקוח (JS) - ניתן לעקיפה. לא טופל היום.

## 6. Edge Function: extract-pdf-text

ללא שינוי מ-23.7. **TODO מ-26.7:** לא נבדק אם יש אכיפת JWT (`verify_jwt`) בכניסה - פוטנציאל להצפה/ניצול על ידי לא-מחוברים אם פתוחה לגמרי.

## 7. מה עובד ונבדק כרגע

כל הפיצ'רים המתועדים ב-HANDOFF-ים קודמים (23.7) **נבדקו מחדש תחת RLS ב-26.7 ועובדים תקין**: אימות, פרופילים (כולל "גם מקצוען"), חדרי לייב (יצירה/מחיקה/הצטרפות/הזמנת אורח כולל לא-מחובר), פיד היצירה (העלאה/חיפוש/נראות ציבורי-פרטי/דיון עם threading), הודעות אישיות (שיחה/ארכיון/תיבת דואר נכנס).

**חדש ונבדק ב-26.7:** קטע פרטי - הקובץ עצמו (לא רק הרשומה) מוגן ולא נגיש למי שלא אמור לראות אותו; קטע ציבורי וקבצים מצורפים לפידבק - Signed URLs עובדים מקצה לקצה (כולל תגובה חדשה שמתנגנת מיד).

## 8. מה בתהליך / שבור / לא גמור

**פיצ'רים לא גמורים (ללא שינוי מ-23.7):** ראו HANDOFF קודם - הפרדת פרופילים המלאה, כלי פידבק מתקדמים, מונטיזציה, וידאו/מיקרופון אמיתיים, צ'אט בחדר לייב.

**חדש/עדכון מ-26.7:**
- **קטעי WAV לא מתנגנים בדפדפן** (MP3 עובד) - שגיאת קודק בצד הדפדפן, לא קשור לאבטחה. TODO.
- **העלאת קובץ אודיו איטית מאוד** - נצפה היום, לא אובחן. TODO.
- חדר חדש לא מופיע ל-B בלי רענון ידני - חסר Realtime subscription ל-LiveRoom (רק ל-RoomJoinRequest/DirectMessage יש). TODO.
- `room_messages` דורש שכתוב סכמה (`sender_user_id uuid`) לפני חיווט הצ'אט בפועל - כרגע RLS חוסם הכל.
- 4 פערי אבטחה "בינוניים" שזוהו אך לא טופלו: RoomInvite burn-by-anyone, Edge Function auth, client-side-only file size limit, Auth settings review.
- אין עדיין גיבוי אוטומטי (Free plan) - מקובל כרגע (אין דאטה אמיתי), להעריך מחדש לפני השקה.

## 9. החלטות טכניות שכבר התקבלו (לא לפתוח מחדש דיון)

כל ההחלטות מ-23.7 ולפני עדיין בתוקף. **נוספו ב-26.7:**
- RLS פעיל על **כל** הטבלאות - ברירת מחדל היא "חסום, אלא אם צוין אחרת" מעכשיו והלאה על כל טבלה חדשה.
- Storage bucket `sketch-files` הוא **פרטי**; קבצים נגישים רק דרך Signed URL זמני שנוצר בזמן ריצה, לא URL קבוע.
- כל policy נכתבת מעתה עם `DROP POLICY IF EXISTS` לפני `CREATE POLICY` (idempotent) כדי לאפשר הרצה חוזרת בטוחה.
- הצפנה מקצה-לקצה (E2E) - **נושא נפרד**, סשן תכנון ייעודי, לא המשך ישיר של RLS.

## 10. שאלות/החלטות פתוחות לשיחה הבאה

**ממשיכות מ-23.7 (עדיין פתוחות, לא טופלו):**
- השלב הבא באיפיון הפרופילים: איך ייראה ה-Feed/Showcase הנפרד, ה-Portfolio/Case Studies, וה-CTA השונה בין Creator ל-Professional בפועל בממשק?
- להוסיף את בחירת "גם מקצוען" גם למסך ProfileSetupModal הראשוני?
- מתי לגשת להבדלי חדרי הלייב (Stage מול Peer-to-Peer, תור מובנה)?
- מתי לגשת לכלי הפידבק המתקדמים (Waveform annotation, Rubric)?
- מתי לגשת למונטיזציה (מנוי בפועל, Ticketed Rooms, Lead Generation)?
- קטעים פרטיים - האם יידרש בעתיד "פרטי לקבוצה" מעבר ל"פרטי ליוצר בלבד"?
- מתי לגשת לווידאו/מיקרופון האמיתי ולצ'אט החי בחדר?
- הודעות אישיות: להוסיף push/מייל על הודעה חדשה? לאפשר "ארכוב שיחה שלמה" בלחיצה אחת? לסנן הודעות מארכבות מתצוגת InboxModal?

*(הפריט "RLS - צריך לתכנן ולהפעיל לפני השקה" מה-23.7 הושלם היום, 26.7, והוסר מהרשימה.)*

**חדש מ-26.7:**
- תעדוף בין 4 פערי האבטחה הבינוניים (RoomInvite/Edge Function/file size/Auth settings) - מתי לטפל בכל אחד?
- סשן ייעודי להצפנה מקצה-לקצה: מתי, ומה ההיקף (DM בלבד? גם חדרי לייב? מה קורה למודרציה עתידית?)
- אבחון בעיית מהירות העלאת אודיו
- מה גורם לבעיית פענוח WAV - קידוד ספציפי? להוסיף בדיקת פורמט בהעלאה?
- מתי לשכתב את סכמת `room_messages` (הוספת `sender_user_id uuid`) כדי לחבר את הצ'אט בפועל

---

## 11. קוד ומצב טכני - פורמט JSON קומפקטי

```json
{
  "last_updated": "2026-07-26",
  "session_focus": "RLS across all tables + Storage private migration",
  "files_changed_today": [
    {
      "path": "src/components/UploadSketchModal.jsx",
      "change": "Storage upload no longer calls getPublicUrl(); saves raw storage path only into Sketch.file_url. Enables private bucket + signed URL flow.",
      "status": "delivered in chat as full file, pasted into editor, confirmed working"
    },
    {
      "path": "src/components/SketchDetailModal.jsx",
      "change": "Generates Signed URLs (1hr expiry) on demand: for the sketch's own media on modal open, and for every feedback attachment after loadFeedback(). New feedback with media attachment gets an immediate signed URL before being added to local state, so it's playable without reload.",
      "status": "delivered in chat as full file, pasted into editor, confirmed working"
    }
  ],
  "files_unchanged_today": [
    "src/main.jsx",
    "src/App.jsx",
    "src/RoomPage.jsx",
    "src/components/CreateRoomModal.jsx",
    "src/components/JoinRoomModal.jsx",
    "src/components/AuthModal.jsx",
    "src/components/ProfileSetupModal.jsx",
    "src/components/EditProfileModal.jsx",
    "src/components/PendingRequestsBanner.jsx",
    "src/components/GuestJoinModal.jsx",
    "src/components/SketchCard.jsx",
    "src/components/InboxModal.jsx",
    "src/components/DirectMessageModal.jsx",
    "src/components/PublicProfileModal.jsx",
    "src/lib/clientId.js",
    "src/lib/guestAccess.js",
    "supabase/functions/extract-pdf-text/index.ts"
  ],
  "rls_status": {
    "Profile": { "enabled": true, "policies": ["select: authenticated read-all", "insert: own id only", "update: own id only"] },
    "ProfessionalProfile": { "enabled": true, "policies": ["select: authenticated read-all", "insert/update/delete: own id only"] },
    "Sketch": { "enabled": true, "policies": ["select: is_public=true OR own", "insert: own uploader_user_id only", "update/delete: own only"] },
    "SketchFeedback": { "enabled": true, "policies": ["select/insert: tied to related Sketch visibility", "update/delete: own author_user_id only"] },
    "LiveRoom": { "enabled": true, "policies": ["select: authenticated read-all", "select (extra): public/anon if a matching RoomInvite exists", "insert/update/delete: own host_user_id only"] },
    "Room_Participant": { "enabled": true, "policies": ["select: authenticated read-all (historical log, low sensitivity)", "insert: any authenticated user (no user_id column exists to restrict further)"], "known_gap": "no user_id column, can't enforce 'insert only your own record'" },
    "RoomJoinRequest": { "enabled": true, "policies": ["select/update/delete: requester or host of related room", "insert: own requester_user_id only"] },
    "RoomInvite": { "enabled": true, "policies": ["select: public (needed for pre-auth guest flow)", "insert/delete: host of related room only", "update: public, only if used=false"], "known_gap": "anyone can mark any unused invite as used without actually joining (low risk, random UUID)" },
    "room_messages": { "enabled": true, "policies": [], "note": "DENY-BY-DEFAULT. Table has no reliable user identity (sender is free-text username, room_id is text not uuid). Needs schema rework (sender_user_id uuid) before real policies can be written." },
    "DirectMessage": { "enabled": true, "policies": ["select: sender or recipient only", "insert: own sender_id only", "update: sender or recipient (row-level)"], "extra_protection": "BEFORE UPDATE trigger 'restrict_direct_message_updates' enforces column-level rules: content/sender_id/recipient_id/usernames/created_at are immutable; read_at only settable by recipient; archived_by_sender only by sender; archived_by_recipient only by recipient" }
  },
  "storage": {
    "bucket": "sketch-files",
    "public": false,
    "changed_from_public_at": "2026-07-26",
    "policies": [
      { "cmd": "INSERT", "role": "authenticated", "check": "bucket_id = 'sketch-files'" },
      { "cmd": "SELECT", "role": "authenticated", "check": "owner = auth.uid() OR linked Sketch/SketchFeedback visibility allows it" }
    ],
    "url_strategy": "signed URLs, 3600s expiry, generated on demand client-side via createSignedUrl",
    "one_time_migration_run": "converted legacy full public URLs in Sketch.file_url and SketchFeedback.file_url to raw storage paths via regexp_replace",
    "known_issue": "WAV files fail to decode in browser after signing (codec/format issue, unrelated to signed URL mechanism itself - confirmed via MP3 working fine)"
  },
  "db_cleanup_today": [
    { "type": "trigger", "name": "trg_Sketch_set_updated_date", "action": "dropped", "reason": "referenced a column (updated_date) removed on 2026-07-23; broke every UPDATE on Sketch including today's Storage migration cleanup query" }
  ],
  "security_gaps_open": [
    { "item": "RoomInvite can be marked used by anyone (not just the actual joining guest)", "severity": "low", "status": "todo" },
    { "item": "extract-pdf-text Edge Function - JWT enforcement (verify_jwt) not reviewed", "severity": "medium", "status": "todo" },
    { "item": "50MB file size limit is client-side only, bypassable via direct API calls", "severity": "medium", "status": "todo" },
    { "item": "Supabase Auth settings (Site URL/Redirect URLs, Magic Link rate limiting) not reviewed", "severity": "medium", "status": "todo" }
  ],
  "explicitly_deferred": [
    { "topic": "End-to-end encryption for DirectMessage and possibly LiveRoom", "reason": "architectural decision with product tradeoffs (e.g. loses future moderation capability), needs its own dedicated planning session, not a continuation of RLS work" }
  ]
}
```