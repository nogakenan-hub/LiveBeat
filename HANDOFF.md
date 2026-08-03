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

## 0.4 סיכום יומי - 30.7.2026 (מפגש 1, אחה"צ) - תיקון Realtime לחדרי לייב + החלטות אסטרטגיות על הגעה לחנויות

מפגש 1 לפי "תוכנית העבודה להשקה", שהתחיל בתיקון קוד קטן וממוקד והתפתח לדיון אסטרטגי חשוב על לוח הזמנים להשקה. **לא נגענו היום ב-DB/RLS בכלל** - כל השינוי היה בקוד frontend + תכנון.

**מה נסגר בפועל, בקוד:**

1. **תוקן הבאג: חדר לייב חדש לא הופיע אצל משתמשות אחרות בלי רענון ידני.** הסיבה: לא היה Realtime subscription כלל על טבלת `LiveRoom` (בניגוד ל-`RoomJoinRequest` ו-`DirectMessage` שכבר היו מחוברים). נוסף `useEffect` חדש ב-`src/main.jsx` עם ערוץ `'live-room-changes'` שמאזין ל-`postgres_changes` (`event: '*'`) על `LiveRoom`, ומעדכן את ה-state של `rooms` ישירות בלי לקרוא מחדש ל-`fetchRooms()`:
   - `INSERT` → מוסיף את החדר החדש לתחילת הרשימה (עם בדיקת קיום, ליתר ביטחון מפני כפילות)
   - `UPDATE` → מחליף את החדר המתאים בגרסה המעודכנת
   - `DELETE` → מסנן את החדר שנמחק החוצה
   - **אומת end-to-end בהצלחה:** שתי משתמשות מחוברות בו-זמנית (לא אנונימיות) - חדר חדש שנוצר אצל אחת הופיע מיידית אצל השנייה בלי שום רענון.

2. **גילוי אגבי (לא באג) תוך כדי הבדיקה:** ניסיון ראשוני לבדוק עם חלון פרטי **אנונימי לגמרי** (בלי התחברות) הראה שהחדר לא מופיע כלל. זה **צפוי ותקין** - הפוליסי הכללית של `LiveRoom` ("authenticated read-all unless host deactivated") מוגדרת רק לתפקיד `authenticated`; אנונימית רואה חדר רק דרך הפוליסי השנייה (הזמנת אורח לא-ממומשת). לא תוקן דבר, כי זו התנהגות מכוונת קיימת - אבל זה פתח שאלת מוצר חדשה (ראו סעיף 10).

**מה נבדק ויזואלית (לא קוד):**

3. **סקירה כללית ראשונית של תצוגת המובייל** - הועברו שני צילומי מסך אמיתיים מטלפון (Chrome על אנדרואיד, גישה דרך ה-URL של הקודספייס). התצוגה הכללית של המסך הראשי (חדרי לייב + פיד הסקיצות זה-לצד-זה, לפי ה-`grid-cols-[150px_1fr]` הקיים) נראתה תקינה - לא זוהו בעיות דחופות. **הובהר לנגה, כשאלה טכנית נפרדת:** ה-URL bar וה-chrome של הדפדפן שנראים בצילומים ייעלמו לגמרי כשהאתר ייעטף כאפליקציה (Capacitor) - אבל הפרופורציות/לייאאוט של התוכן עצמו יישארו **זהות**, כי הם נקבעים לפי רוחב ה-viewport, לא לפי נוכחות ה-chrome. **הוחלט במפורש לדחות QA מפורט מסך-מסך** (טאצ' טארגטים, גלילה, מקלדת) לסבב הייעודי לפני ההשקה (שלב 5), ולא להתעכב עליו עכשיו.

**החלטות אסטרטגיות גדולות שהתקבלו היום (לא קוד, אבל משפיעות מהותית על התוכנית):**

4. **הוחלט במפורש: נוכחות בפועל ב-App Store וב-Google Play ביום ההשקה היא קריטית**, לא מספיק PWA/אתר רספונסיבי בלבד. זה שינה משמעותית את "תוכנית העבודה להשקה" (הקובץ עודכן במלואו - ראו גם בריפו/בקבצי הפרויקט אם הועלה שם).
5. **נבדק בחיפוש בזמן אמת (30.7.2026) מצב הכלים הרלוונטי:**
   - Capacitor עצמו (`npx cap init/add`) רץ לגמרי מתוך Codespaces, בלי מחשב נוסף.
   - build סופי ל-iOS דורש macOS בפועל, אבל זה נפתר עם שירות build בענן ייעודי - **לא** מחשב Mac פיזי.
   - **Capawesome Cloud** מומלץ כשירות build (נבנה במיוחד ל-Capacitor, ללא קונפיגורציית YAML מסובכת, tier חינמי + מ-9$/חודש). אלטרנטיבה: Codemagic. **לא** Ionic Appflow - יש לו תאריך שקיעה מוכרז (סוף 2027), לא מומלץ להתחיל עליו פרויקט חדש.
   - Android אפשר לבנות גם ב-CI רגיל (GitHub Actions) בלי שום תלות ב-Mac בכלל.
6. **חדשות טובות שעלו תוך כדי:** אפל דורשת אפשרות מחיקת חשבון בתוך האפליקציה עצמה (App Store Guideline 5.1.1(v)) - **וזה כבר בנוי ונבדק אצלנו** (ראו סעיף 0.3 בהיסטוריה - מחיקה/השהיית חשבון). חוסך זמן משמעותי מול פרויקט שמתחיל מאפס.
7. **הוחלט על תזמון סופי (אחרי דיון ופשרה):**
   - **פתיחת חשבונות המפתחים (Apple Developer Program + Google Play Developer) מתחילה עכשיו/השבוע** - זו עבודה מנהלתית טהורה (טופס + תשלום) שלא תלויה בשום שלב פיתוח, ולוקחת זמן המתנה פסיבי (24-48 שעות, לפעמים יותר) שלא כדאי לדחוס לשבוע האחרון.
   - **כל שאר עבודת החנויות** (Capacitor בפועל, טיוטת מדיניות פרטיות/תנאי שימוש, build, איסוף חומרי חנות, הגשה ל-Review) **נדחית במכוון לשבוע שלפני ההשקה בפועל** - כשהאפליקציה כבר תהיה שלמה (וידאו עובד, צ'אט עובד, פרופילים מוכנים), כדי לא להגיש build חצי-גמור. נגה בחרה במפורש באפשרות הזו על פני התחלה מוקדמת יותר, למרות שסומן לה הסיכון שבזה (זמן ה-Review של אפל הוא הגורם הכי פחות ודאי בתוכנית, ושבוע הוא חלון צר יחסית לספוג דחייה+תיקון). **סיכון פתוח ומודע**, לא נפתר - רק סומן.
   - נרשמה רשת ביטחון: אם קורה עיכוב באותו שבוע אחרון, PWA יכול לשמש כפתרון גישור זמני (לא קבוע).

**קובץ שעודכן היום (לא בריפו של הקוד, קובץ תכנון בלבד):** `תוכנית_עבודה_להשקה.md` - עודכן פעמיים במהלך המפגש לשקף את כל השינויים למעלה. אם הקובץ מועלה כקובץ פרויקט ב-Claude, **חשוב להחליף אותו בגרסה החדשה** - קבצי פרויקט הם עותק קבוע (snapshot) ולא מתעדכנים אוטומטית.

**במפורש נדחה להיום, לפי בקשת נגה (לא מחוסר זמן, אלא מבחירה):**
- דיון על Jitsi (שלב 2 בתוכנית) - נדחה כולו ליום ראשון, כנושא גדול שמצדיק מפגש מלא משלו.
- שלוש משימות אבטחה קטנות שהוצעו כברירת מחדל למפגש (בדיקת end-to-end ל-INSERT policy של deactivated_at, סקירה שיטתית של policies נוספים, ניקוי ה-Secret הישן) - **לא בוצעו היום**, עדיין ב-TODO לסשן הבא.

---

## 0.3 סיכום יומי - 30.7.2026 (יום חמישי, בוקר) - CORS דינמי + RLS INSERT + גילוי פרצת RLS כבוי + פוליסי הזמנה שבורה

יום עבודה שהתחיל כהמשך ישיר ומתוכנן לשני ה-TODO-ים שעלו מביקורת Gemini על סיכום ה-28.7 (סעיף 0.2), אבל הפך לגילוי **פרצת אבטחה חמורה ובלתי-קשורה** דרך בדיקת end-to-end של פיצ'ר ההשהיה. הסדר בפועל:

**חלק א' - שני ה-TODO המתוכננים מראש, נסגרו בהצלחה:**

1. **CORS דינמי לפי Origin נכנס, במקום `ALLOWED_ORIGIN` Secret קבוע:** שתי ה-Edge Functions (`extract-pdf-text`, `delete-account`) עודכנו כך שבודקות את ה-`Origin` header שהגיע בבקשה בפועל מול regex קבוע בקוד (`/^https:\/\/[a-z0-9-]+\.app\.github\.dev$/`), ומחזירות אותו בדיוק אם הוא תואם. מבטל לגמרי את הצורך לעדכן Secret בכל שינוי פורט של הקודספייס. שתי הפונקציות נפרסו בהצלחה (`npx supabase functions deploy <name>`).
   - **תקלה טכנית קטנה תוך כדי:** התיקייה `delete-account` נמצאה מקוננת בטעות בתוך `extract-pdf-text/delete-account/`, עם הקובץ בשם שגוי `Index.TS` (אותיות גדולות - Supabase דורש `index.ts` מדויק). תוקן ידנית עם `mkdir`/`mv`/`rmdir` להעביר לנתיב הנכון `supabase/functions/delete-account/index.ts` כתיקייה עצמאית ליד `extract-pdf-text`, לא בתוכה.
   - **הבהרה שעלתה תוך כדי:** התחברות ל-CLI (`npx supabase login`) נדרשת רק כשבפועל מריצים פקודת `supabase` (כמו `deploy` או `secrets set`) ומקבלים שגיאת הרשאה - לא חובה "בתחילת כל יום עבודה" סתם ככה אם לא נוגעים ב-Edge Functions/Secrets באותו יום.
   - Secret הישן `ALLOWED_ORIGIN` נשאר עדיין מוגדר בפרויקט (לא נמחק בפועל - הוחלט לדלג על הניקוי הקוסמטי הזה) אך אינו נקרא יותר בקוד, ולכן "מת" ולא משפיע על כלום.

2. **RLS - הוספת בדיקת `deactivated_at IS NULL` ל-INSERT policies:** לפי הבקשה מ-Gemini, נוסף תנאי לשתי הפוליסי הקיימות:
   - `Sketch` / `"Users can insert their own sketches"`: נוסף `AND NOT EXISTS (SELECT 1 FROM "Profile" WHERE "Profile".id = auth.uid() AND "Profile".deactivated_at IS NOT NULL)` לצד תנאי הבעלות הקיים (`uploader_user_id = auth.uid()`).
   - `DirectMessage` / `"Users can send messages as themselves"`: אותו תנאי נוסף לצד `sender_id = auth.uid()`.
   - שמות העמודות אומתו מראש דרך `information_schema.columns` לפני הכתיבה (לפי הכלל הקבוע בסעיף 2) - `uploader_user_id` ב-Sketch, `sender_id` ב-DirectMessage, שניהם אושרו נכונים.
   - הרצה בוצעה בהצלחה, ללא שגיאות.

**חלק ב' - בדיקת end-to-end של ההשהיה, וגילוי פרצה חמורה שלא הייתה קשורה לתוכנית:**

3. **בדיקת מחיקת חשבון לצמיתות - נדחתה במודע:** אין כרגע כתובת מייל פנויה לוויתור לבדיקה בלתי-הפיכה. הוצע טריק Gmail `+` או מייל זמני לעתיד, לא בוצע היום. **עדיין TODO פתוח.**

4. **בדיקת השהיית חשבון - בוצעה בהצלחה, כולל אימות חשוב:** הושהה חשבון אמיתי, מסך `DeactivatedAccountScreen` הופיע כראוי כולל תאריך נכון. **אומת גם logout+login מלא** (לא רק ריענון) - מסך החסימה נשאר לאחר התחברות מחדש. זה מאשר גם ש-`deactivated_at` אכן מוזרם נכון מ-`main.jsx` ל-`App.jsx` בדפדפן בפועל (שני הפריטים שהיו ב"pending_verification" מ-28.7 - **סגורים**).
   - **תקלה צדדית תוך כדי הבדיקה:** ה-Magic Link שנשלח למייל הצביע על ה-Site URL הרשום ב-Supabase (5174), בעוד הקודספייס רץ בפועל על פורט אחר (5173) - קישור זמני "מת" (שגיאת 401/Unauthorized מ-GitHub). עריכת ה-URL ידנית לא עבדה (session שייך לדומיין המקורי). **נפתר בפועל** ע"י עדכון Site URL ב-Supabase Dashboard ל-5173 ובקשת Magic Link חדש. **שיעור לעתיד: Site URL חייב תמיד להיות מסונכרן עם הפורט הפעיל בפועל, לא מספיק שה-Redirect URLs מכילים אותו** - כי ה-Site URL הוא מה שבפועל נכנס לגוף המייל של ה-Magic Link.

5. **גילוי קריטי מס' 1 - RLS היה כבוי לגמרי (לא רק "בלי policy מתאימה") על שלוש טבלאות מרכזיות:** תוך כדי בדיקת ההשהיה, נצפה שסקיצה ציבורית של חשבון מושהה עדיין מופיעה בפיד בחלון פרטי לגמרי בלי התחברות. חקירה שיטתית (בדיקת qual של הפוליסי → עמודות → ערכים בפועל → לבסוף `relrowsecurity`) גילתה ש-**`Profile`, `Sketch`, ו-`SketchFeedback` היו עם `relrowsecurity = false`** - כלומר RLS כבוי ברמת הטבלה עצמה, כך שכל ה-policies המוגדרות עליהן (מה-26.7) פשוט **התעלמו לגמרי**. תוצאה בפועל: כל הפרופילים, כל הסקיצות (כולל פרטיות) וכל הפידבק היו חשופים לציבור הרחב ללא שום הגבלה, ללא קשר לנושא ההשהיה - חשיפה רחבה בהרבה ממה שהבדיקה המקורית התכוונה לבדוק. **סיבת השורש לא אותרה** (לא ברור מתי/איך זה נכבה - ייתכן ניסוי דיבוג ישן שלא הוחזר). **תוקן מיידית:**
   ```sql
   ALTER TABLE "Profile" ENABLE ROW LEVEL SECURITY;
   ALTER TABLE "Sketch" ENABLE ROW LEVEL SECURITY;
   ALTER TABLE "SketchFeedback" ENABLE ROW LEVEL SECURITY;
   ```
   נבדק ואומת: כל 10 הטבלאות חוזרות `relrowsecurity = true` כעת.

6. **גילוי קריטי מס' 2 - פוליסי הזמנת-אורח ל-`LiveRoom` לא בדקה אם ההזמנה מומשה:** אחרי תיקון הפרצה הקודמת, סקיצות נעלמו כראוי מהצפייה הפרטית, אבל **חדרי לייב נשארו גלויים**. הפוליסי `"Rooms are viewable via valid invite"` בדקה רק **האם קיימת אי-פעם** שורת `RoomInvite` עבור החדר (`EXISTS (SELECT 1 FROM "RoomInvite" WHERE room_id = ...)`), בלי לבדוק אם ה-invite עדיין רלוונטי (`used = false`) ובלי לבדוק השהיית המארחת. תוצאה בפועל: **כל חדר שאי-פעם נוצרה לו הזמנת אורח נשאר גלוי לציבור הרחב לצמיתות**, גם הרבה אחרי שהאורח כבר הצטרף ונוצל הקישור. אומת בנתונים: חדר "10:17 17.07" (משתי הזמנות, שתיהן `used=true`) נחשף שלא לצורך; חדר "26.07.26" (מארחת מושהית + הזמנה אחת `used=false`) - זהו בדיוק התרחיש השולי שכבר תועד ומקובל במודע מה-26.7, לא גילוי חדש. **תוקן:**
   ```sql
   DROP POLICY IF EXISTS "Rooms are viewable via valid invite" ON "LiveRoom";
   CREATE POLICY "Rooms are viewable via valid invite"
   ON "LiveRoom" FOR SELECT TO public
   USING (
     EXISTS (
       SELECT 1 FROM "RoomInvite"
       WHERE "RoomInvite".room_id = "LiveRoom".id
       AND "RoomInvite".used = false
     )
   );
   ```
   נבדק ואומת בחלון פרטי: אחרי התיקון, רק "26.07.26" (הפער הידוע/המקובל) עדיין מופיע; "10:17 17.07" נעלם כראוי.

**מסקנה מתודולוגית חשובה מהיום:** בדיקת policies דרך `pg_policies` (תוכן ה-`qual`) **אינה מספיקה** - חובה לבדוק גם את `pg_class.relrowsecurity` בפועל, כי RLS יכול להיות כבוי ברמת הטבלה גם כשה-policies "נראות" תקינות על הנייר. כדאי לשקול הוספת השאילתה הבאה כבדיקת-שגרה קבועה בתחילת כל סשן אבטחה עתידי:
```sql
SELECT relname, relrowsecurity FROM pg_class
WHERE relname IN ('Sketch','SketchFeedback','Profile','ProfessionalProfile','LiveRoom','Room_Participant','RoomJoinRequest','RoomInvite','room_messages','DirectMessage')
ORDER BY relname;
```

**עדיין פתוח בסוף היום:**
- בדיקת end-to-end בפועל של מחיקת חשבון לצמיתות (נדחתה - חסר מייל פנוי לוויתור).
- סקירה שיטתית של שאר ה-policies בכל הטבלאות, לאור שתי הפרצות שנמצאו היום - לא ברור אם יש עוד policies "רופאות" דומות (בודקות "קיים אי-פעם" במקום "רלוונטי כרגע") מעבר לזו שכבר תוקנה ב-`RoomInvite`/`LiveRoom`.
- ניקוי קוסמטי: מחיקת ה-Secret הישן `ALLOWED_ORIGIN` שכבר לא בשימוש (לא דחוף).
- לוודא Site URL ב-Supabase Dashboard מסונכרן עם הפורט הפעיל **בתחילת כל יום עבודה מעתה**, לא רק Redirect URLs (לקח חדש מהתקלה בסעיף 4).

---

## 0.2 בדיקת עמיתה (Gemini) על סיכום ה-28.7 - שני TODO אמיתיים חדשים ליום חמישי

אחרי סיום הסשן, ה-HANDOFF נשלח ל-Gemini לביקורת שנייה. רוב ההערות שלה כבר טופלו במודע (למשל: "קבצי פידבק יתומים" - זו בדיוק ההחלטה המכוונת של אנונימיזציה, לא פער) או לא מצדיקות השקעה כרגע (rollback מלא ל-Edge Function של המחיקה - over-engineering לפני שיש משתמשות אמיתיות). אבל **שתי נקודות אמיתיות עלו וצריך לטפל בהן ביום חמישי:**

1. **RLS על כתיבה בזמן השהיה - זו לא רק "פגיעה עצמית":** משתמשת מושהית עדיין יכולה לשלוח DM למישהי אחרת שפעילה וזה כבר פוגע בצד שלישי, לא רק בעצמה כמו שהוחלט ב-28.7. **צריך להוסיף:** תנאי ב-`WITH CHECK` על INSERT ב-`Sketch` וב-`DirectMessage` שבודק `deactivated_at IS NULL` בפרופיל של המבצעת (השולחת/המעלה), לא רק בפרופיל שמוצג לאחרים.
2. **CORS - הפתרון הנוכחי (`ALLOWED_ORIGIN` secret קבוע) ידרוש עדכון ידני בכל פעם שהפורט של הקודספייס משתנה.** פתרון טוב יותר: ה-Edge Function תבדוק את ה-Origin שהגיע בבקשה בפועל, ותחזיר אותו בדיוק אם הוא תואם תבנית regex (כמו מסתיים ב-`.app.github.dev`) - כך שאין צורך לעדכן Secret בכל שינוי פורט. שינוי קטן בשתי הפונקציות (`extract-pdf-text`, `delete-account`).

שני אלה נכנסים לתחילת סדר היום של יום חמישי, לפני שממשיכים הלאה לפיצ'רים אחרים.

**עדכון 30.7.2026: שני הפריטים האלה טופלו במלואם - ראו סעיף 0.3 למעלה.**

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
* **הודעות אישיות (DM):** קיימות כפיצ'ר מלא - שיחה 1:1, תיבת דואר נכנס, ארכיון לפי צד. עדיין אין push notifications/מייל על הודעה חדשה. מוגנות RLS + טריגר הקשחה ברמת עמודה, ומאנונמות (לא נמחקות) בעת מחיקת חשבון של אחד הצדדים. מ-30.7 מוגנות גם ב-INSERT מפני שליחה ע"י משתמשת מושהית.
* **חשבון: שני מסלולים נפרדים** - השהיה (הפיכה, ללא הגבלת זמן, דרך התפריט) ומחיקה לצמיתות (בלתי הפיכה, דורשת הקלדת אישור). ראו סעיף 0 לפרטים המלאים. **נבדק end-to-end בהצלחה ב-30.7 (השהיה בלבד - מחיקה עדיין לא נבדקה בפועל).**
* **תוכנית עתידית (לא בסשן קרוב):** הצפנה מקצה-לקצה ל-DM ואולי לחדרי לייב - דורשת סשן תכנון נפרד.
* **החלטה אסטרטגית חדשה (30.7 אחה"צ):** האפליקציה חייבת להיות בפועל ב-App Store וב-Google Play ביום ההשקה, לא רק PWA. ייעטף עם Capacitor + build בענן (Capawesome Cloud). ראו סעיף 0.4 לפרטים המלאים, ו"תוכנית עבודה להשקה.md" לתזמון המדויק.

## 2. סביבת הפיתוח

* פיתוח בפועל: **GitHub Codespaces** (הכתובת הפעילה **כוללת פורט משתנה** - נצפה שינוי מ-5173 ל-5174 ב-28.7, וחזרה ל-5173 ב-30.7. **חובה לבדוק בתחילת כל יום עבודה**: את כתובת ה-URL הפעילה מול **גם** Site URL **וגם** Redirect URLs ב-Supabase Authentication. **לקח מ-30.7: לא מספיק שה-Redirect URLs מכילים את הפורט הנוכחי - ה-Site URL חייב גם הוא להיות מעודכן, כי הוא זה שנכנס בפועל לגוף המייל של ה-Magic Link.** מ-30.7 ואילך, בעיית ה-`ALLOWED_ORIGIN` Secret כבר לא רלוונטית - שתי ה-Edge Functions בודקות Origin דינמית מול regex, לא תלויות ב-Secret.)
* בסיס נתונים + Auth + Storage + Edge Functions: **Supabase** (Project ref: `djygajgvpzdqddexyrgn`, region eu-central)
* **תוכנית Free - אין גיבויים אוטומטיים.** הוחלט ב-26.7 שזה בסדר כרגע כי אין עדיין משתמשים/דאטה אמיתיים - להעריך מחדש לפני השקה בפועל.
* Base44: שימש רק לעיצוב ראשוני - לא חלק מסביבת הפיתוח בפועל.
* וידאו/שמע אמיתי בחדרי לייב: **לא קיים** - כרגע רק Presence + כרטיסיות עיצוביות. **מתוכנן ל-Jitsi (`meet.jit.si`), נדחה ליום ראשון 2.8.2026 כמפגש ייעודי.**
* Stack טכני: React + Vite, Tailwind CSS, `@supabase/supabase-js`
* Supabase CLI: `npm install supabase --save-dev`, מופעל דרך `npx supabase ...`. **הטוקן פג תוקף מדי פעם** - להריץ `npx supabase login` **רק כשבפועל מריצים פקודת CLI ומקבלים שגיאת הרשאה** (לא חובה בתחילת כל יום סתם - הובהר ב-30.7).
* **כלל ברזל להעתקת קוד/SQL בין הצ'אט לעורך:** תמיד כפתור ה-Copy שבפינת תיבת הקוד, אף פעם לא סימון ידני.
* **טיפ SQL Editor:** מריץ כמה פקודות ברצף (מופרדות ב-`;`) **כטרנזקציה אחת** - אם פקודה אחת נכשלת באמצע, כל הבלוק עלול להתבטל. פתרון: לכתוב policies בצורה idempotent עם `DROP POLICY IF EXISTS` לפני כל `CREATE POLICY`.
* **טיפ קריטי מ-28.7:** לפני `DROP POLICY`/`CREATE POLICY` על טבלה, **חובה** לבדוק קודם את שם הפוליסי המדויק הקיים עם:
  ```sql
  SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'שם_הטבלה' AND cmd = 'סוג_הפעולה';
  ```
  ניחוש שם גורם לכך שהפוליסי הישנה נשארת **לצד** החדשה (לא מוחלפת), ומכיוון שכמה policies מאותו סוג פעולה מתחברות ב-OR ב-Postgres, הישנה עלולה "לנצח" ולבטל את ההגבלה החדשה בלי שגיאה גלויה.
* **טיפ חדש וקריטי מ-30.7: לבדוק policies על הנייר (`pg_policies`/`qual`) לא מספיק.** חובה לוודא גם שה-RLS בכלל מופעל ברמת הטבלה עצמה:
  ```sql
  SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'שם_הטבלה';
  ```
  `relrowsecurity` חייב להיות `true` - אחרת כל ה-policies המוגדרות על הטבלה מתעלמות לחלוטין, בלי שום שגיאה או אזהרה. מומלץ להריץ את הבדיקה הזו על כל הטבלאות כצעד ראשון בכל סשן אבטחה עתידי.
* **טיפ נוסף מ-30.7: policy שבודקת "האם קיימת שורה קשורה כלשהי" (EXISTS גנרי) עלולה להיות רחבה מדי.** יש לוודא שהבדיקה כוללת גם תנאי רלוונטיות בזמן אמת (כמו `used = false`, לא רק "אי-פעם נוצר"), אחרת גישה חד-פעמית הופכת לחשיפה קבועה.
* **טיפ לבדיקת תרחישי "משתמש אחר":** תמיד לוודא דרך Supabase Dashboard → Authentication → Users → "Last sign in at" שבאמת התחלפת בין חשבונות. שימוש בחלונות Incognito נפרדים (לא רק טאבים) מומלץ - **וגם**, כפי שאומת ב-30.7, חלון פרטי לגמרי בלי שום התחברות הוא הבדיקה הכי אמינה לחשיפה כלפי "זר גמור" - אבל **שים לב**: חלון פרטי אנונימי גם לא רואה חדרי לייב כלל (זו התנהגות מכוונת, לא באג - ראו סעיף 0.4). לבדיקת Realtime בין משתמשות, חובה שהחלון השני יהיה **מחובר** (לא רק פרטי), אחרת התוצאה מטעה.
* **Edge Functions - CORS (עודכן 30.7):** שתי הפונקציות (`extract-pdf-text`, `delete-account`) בודקות כעת את ה-`Origin` header של הבקשה הנכנסת מול regex קבוע בקוד (`/^https:\/\/[a-z0-9-]+\.app\.github\.dev$/`) ומחזירות אותו בדיוק אם תואם. **אין יותר תלות ב-Secret `ALLOWED_ORIGIN`** - השינוי בקוד בלבד, בלי redeploy נדרש בכל שינוי פורט. ה-Secret הישן עדיין קיים בפרויקט אך לא נקרא (ניקוי קוסמטי אופציונלי, לא דחוף).
* **הבדלה בין שתי Edge Functions בשם קובץ זהה (index.ts):** שם הקובץ תמיד `index.ts` (דרישת Supabase) - ההבדל הוא **שם התיקייה** (`supabase/functions/extract-pdf-text/` מול `supabase/functions/delete-account/`, שתי תיקיות אחיות עצמאיות, לא מקוננות זו בזו), לא שם הקובץ. לזיהוי איזה תוכן שייך לאיזו פונקציה: extract-pdf-text מכיל `pdf-parse`/`word-extractor`; delete-account מכיל `ownSketchesResult`/`auth.admin.deleteUser`.
* **חדש מ-30.7 - הגעה לחנויות בלי מחשב מקומי:** Capacitor (`npx cap init/add`) רץ לגמרי מתוך Codespaces. ה-build הסופי ל-iOS דורש macOS, נפתר עם שירות build בענן ייעודי (Capawesome Cloud מומלץ, לא Ionic Appflow - יש לו תאריך שקיעה מוכרז לסוף 2027). Android אפשר לבנות גם ב-GitHub Actions בלי תלות ב-Mac כלל. **טרם הותקן בקוד בפועל - מתוכנן לשבוע שלפני ההשקה, ראו "תוכנית עבודה להשקה.md".**

## 3. מבנה הפרויקט (קבצים עיקריים)

```
src/
  main.jsx                       # עודכן 30.7 (אחה"צ) - נוסף useEffect לערוץ Realtime 'live-room-changes' על LiveRoom (INSERT/UPDATE/DELETE); עודכן גם 28.7 - state/handlers לניהול חשבון
  App.jsx                        # עודכן 28.7 - מסך חסימה להשהיה + תפריט פרופיל
  RoomPage.jsx                   # טרם עודכן - מיועד לחיבור Jitsi ביום ראשון 2.8.2026
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
      index.ts                    # עודכן 30.7 - CORS דינמי לפי Origin+regex (בעבר: 28.7 - JWT check)
    delete-account/
      index.ts                    # עודכן 30.7 - CORS דינמי לפי Origin+regex (בעבר: 28.7 - נוצר לראשונה); תוקן גם מיקום/שם קובץ שגויים (היה מקונן בטעות בתוך extract-pdf-text/, בשם Index.TS)
```

## 4. טבלאות ב-Supabase (עמודות מרכזיות)

ראו HANDOFF-ים קודמים לרשימת עמודות מלאה. **שינוי סכמה מ-28.7:** `Profile` קיבלה עמודה חדשה `deactivated_at timestamptz DEFAULT NULL`.

RLS פעיל על כל הטבלאות מאז ה-26.7 - ראו סעיף 11 למצב מדויק ומעודכן לכל טבלה. **עדכון קריטי מ-30.7: התגלה שבפועל RLS היה כבוי לגמרי (`relrowsecurity=false`) על `Profile`, `Sketch`, ו-`SketchFeedback` (סיבת השורש לא אותרה), למרות שה-policies היו מוגדרות ותקינות על הנייר. תוקן באותו יום עם `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`. ראו סעיף 0.3 לפרטים המלאים.**

הערה שנותרה רלוונטית: `room_messages` בפועל שונה ממה שהיה מתועד במקור - `room_id` הוא `text` לא `uuid`, ואין `sender_user_id`/`user_id`, רק `username` טקסט חופשי. יידרש שכתוב סכמה לפני חיווט הצ'אט בפועל.

## 5. Storage

* Bucket `sketch-files` - **פרטי** (מ-26.7).
* **מ-28.7:** `file_size_limit = 52428800` (50MB) ו-`allowed_mime_types` (רשימה מלאה של אודיו/וידאו/מסמכים) מוגדרים ברמת ה-bucket עצמו - אוכפים גם מול קריאת API ישירה, לא רק בדיקת JS בצד לקוח.
* **מגבלה מתועדת ומודעת (28.7):** ההגבלה על סוג הקובץ מסתמכת על ה-Content-Type שהלקוח מצהיר עליו בהעלאה - זיוף API ישיר אפשרי טכנית. הוחלט לא לבנות שכבת בדיקת magic-bytes (תדרוש Edge Function ביניים ושינוי זרימת ההעלאה) כי הסיכון בפועל נמוך - קבצים מוצגים רק בתוך `<audio>`/`<video>` מדומיין ה-Storage הנפרד, לא כ-HTML/iframe בדומיין הראשי של האתר.
* Policies על `storage.objects`: INSERT ל-`authenticated` בלבד; SELECT מבוסס-הרשאות (owner או Sketch/SketchFeedback מקושר עם הרשאה מתאימה). **הערה מ-30.7: מכיוון שגילינו RLS כבוי על טבלת `Sketch` עצמה עד היום, יש לשקול (TODO עתידי) לוודא שגם policies של `storage.objects` לא נסמכות בעקיפין על מצב תקין של טבלת Sketch שהיה שבור - לא נבדק ישירות היום, אבל שווה אימות בסשן הבא.**
* URL strategy: Signed URLs (תקף לשעה), נוצרים "לפי דרישה" בצד לקוח.
* עיקרון "טקסט בלבד" לקבצי מסמך - ללא שינוי, עדיין בתוקף.
* קבצי סקיצה של משתמש שנמחק לצמיתות (Sketch + SketchFeedback תחתן) נמחקים בפועל מה-Storage כחלק מתהליך מחיקת החשבון (ראו סעיף 0).

## 6. Edge Functions

* **`extract-pdf-text`** - עודכן 28.7: נוספה בדיקת JWT ידנית בקוד. **עודכן שוב 30.7:** CORS דינמי לפי Origin+regex במקום `ALLOWED_ORIGIN` Secret.
* **`delete-account`** (נוצר 28.7) - מאמתת JWT, מוחקת קבצי Storage רלוונטיים, קוראת ל-RPC `delete_account_data`, מוחקת את המשתמש מ-`auth.users`. **עודכן 30.7:** CORS דינמי לפי Origin+regex, ותוקן מיקום/שם קובץ שגויים (ראו סעיף 3).

## 7. מה עובד ונבדק כרגע

כל הפיצ'רים המתועדים ב-HANDOFF-ים קודמים עדיין עובדים (אימות, פרופילים כולל "גם מקצוען", חדרי לייב, פיד היצירה, הודעות אישיות, קטעים פרטיים/ציבוריים עם Signed URLs).

**מ-28.7:**
- מחיקת חשבון: כפתור בתפריט → מודל דורש הקלדת "מחק לצמיתות" → הכפתור נדלק רק בהקלדה מדויקת (נבדק ויזואלית). **end-to-end בפועל עדיין לא נבדק (ראו TODO).**
- CORS מהודק על שתי ה-Edge Functions (הוחלף לגמרי ב-30.7 בגרסה הדינמית).

**מ-30.7 (בוקר):**
- **השהיית חשבון - נבדק end-to-end בהצלחה:** הפעלה → מסך חסימה מיידי, כולל אחרי logout+login מלא (לא רק ריענון) → ביטול השהיה → חזרה לפעילות. `deactivated_at` מאומת כמוזרם נכון מ-`main.jsx` ל-`App.jsx` בדפדפן בפועל.
- **RLS על `Profile`/`Sketch`/`SketchFeedback` - תוקן ואומת שהוא פעיל בפועל** (לא רק ש-policies קיימות - `relrowsecurity=true` נבדק ישירות).
- **פוליסי `LiveRoom`/`RoomInvite` - תוקנה ואומתה:** חדר עם הזמנות ממומשות בלבד כבר לא גלוי לציבור; חדר עם הזמנה לא-ממומשת עדיין גלוי (פער ידוע ומקובל).
- CORS דינמי לפי Origin - שתי הפונקציות נפרסו ואומתו כעובדות (בדיקת extract-pdf-text עקיפה דרך העלאת מסמך בהצלחה בעבר, delete-account טרם נבדקה end-to-end בפועל).
- RLS: הוספת `deactivated_at IS NULL` ל-INSERT של `Sketch` ו-`DirectMessage` - הורץ בהצלחה, טרם נבדק end-to-end בפועל.

**חדש ונבדק ב-30.7 (אחה"צ, מפגש 1):**
- **Realtime subscription ל-`LiveRoom` - נוסף ואומת end-to-end.** חדר חדש שנוצר אצל משתמשת מחוברת אחת מופיע מיידית אצל משתמשת מחוברת אחרת, בלי רענון. (אומת גם: משתמשת אנונימית לגמרי לא רואה חדרים כלל - זו התנהגות RLS מכוונת וקיימת, לא קשורה לתיקון הזה.)
- **תצוגת מובייל - סקירה כללית ראשונית אושרה תקינה** מצילומי מסך אמיתיים (פיד+חדרים זה-לצד-זה). QA מפורט נדחה במכוון לשלב 5 בתוכנית העבודה.

## 8. מה בתהליך / שבור / לא גמור

**פיצ'רים לא גמורים (ללא שינוי):** הפרדת פרופילים המלאה, כלי פידבק מתקדמים, מונטיזציה, וידאו/מיקרופון אמיתיים, צ'אט בחדר לייב, שכתוב סכמת `room_messages`.

**נותר מ-26.7, טרם טופל:**
- קטעי WAV לא מתנגנים בדפדפן (MP3 עובד) - שגיאת קודק, לא אבטחתי.
- העלאת קובץ אודיו איטית - לא אובחן.
- ~~חדר חדש לא מופיע בלי רענון ידני - חסר Realtime subscription ל-LiveRoom~~ **✅ תוקן ואומת 30.7 (אחה"צ) - ראו סעיף 0.4.**
- אין גיבוי אוטומטי (Free plan) - מקובל זמנית.

**TODO מיידי לסשן הבא (מעודכן 30.7 אחה"צ - שלוש הפריטים הראשונים הוצעו למפגש הזה ונדחו במפורש לפי בקשת נגה):**
- לבצע סקירה שיטתית של **כל** ה-policies בכל הטבלאות, מחפשים במיוחד תבנית "EXISTS גנרי בלי בדיקת רלוונטיות בזמן אמת" כמו זו שנמצאה ב-`RoomInvite`/`LiveRoom` היום - לא ידוע אם יש עוד policies דומות שלא אותרו. **טרם בוצע.**
- בדיקת end-to-end בפועל: לנסות להעלות סקיצה / לשלוח DM מחשבון מושהה בפועל ולוודא שה-INSERT policy החדשה (מ-30.7 בוקר) אכן חוסמת. **טרם בוצע.**
- ניקוי קוסמטי: מחיקת ה-Secret הישן `ALLOWED_ORIGIN` (`npx supabase secrets unset ALLOWED_ORIGIN`) - לא דחוף, כבר לא בשימוש. **טרם בוצע.**
- בדיקת end-to-end בפועל: יצירת משתמש בדיקה, מחיקה לצמיתות, ואימות שהכל נמחק/מאונונם נכון בטבלאות + ב-Storage + ב-auth.users. **עדיין נדחה - חסר כתובת מייל פנויה לוויתור.**
- לוודא ש-Storage policies לא מסתמכות בעקיפין על מצב תקין של RLS בטבלת Sketch (ראו הערה בסעיף 5) - לא נבדק היום.

**חדש - מוצר, לא קוד (מ-30.7 אחה"צ):**
- לפתוח חשבון Apple Developer Program - **מומלץ להתחיל השבוע**, לא קשור לקוד, ראו סעיף 0.4/1.
- לפתוח חשבון Google Play Developer - **מומלץ להתחיל השבוע**.

**סגור לגמרי (הוסר מרשימת TODO ב-30.7 אחה"צ):**
- באג Realtime ב-LiveRoom - תוקן ואומת.

**סגור לגמרי (הוסר מרשימת TODO ב-30.7 בוקר):**
- CORS דינמי (regex לפי Origin) בשתי ה-Edge Functions - הושלם ונפרס.
- RLS: `deactivated_at IS NULL` ב-INSERT של Sketch ו-DirectMessage - הושלם (בדיקת end-to-end בפועל עדיין TODO, ראו למעלה).
- בדיקת end-to-end של השהיית חשבון (מסך חסימה + logout/login + ביטול) - הושלם במלואו.
- RLS כבוי בפועל על Profile/Sketch/SketchFeedback - תוקן ואומת.
- פוליסי LiveRoom/RoomInvite לא בודקת מימוש הזמנה - תוקן ואומת.

**סגור לגמרי (מ-28.7):**
- RLS על כל הטבלאות (הושלם 26.7)
- Auth URL config, Rate limits, File size + MIME whitelist, RoomInvite burn (חד-פעמיות), extract-pdf-text JWT - כולם נסגרו ב-28.7.
- מחיקת חשבון + השהיית חשבון - נבנו ב-28.7 (בדיקת end-to-end: השהיה הושלמה ב-30.7, מחיקה עדיין נדחית).

## 9. החלטות טכניות שכבר התקבלו (לא לפתוח מחדש דיון)

כל ההחלטות הקודמות עדיין בתוקף. **מ-28.7:**
- **מחיקת חשבון = אנונימיזציה, לא מחיקה מוחלטת של הכל.** מה שבבעלות בלעדית נמחק; מה שאחרים תלויים בו (פידבק על סקיצה של מישהו אחר, DM) מאונונם. זה תואם את הדרישה החוקית (הסרת זיהוי אישי, לא השמדה פיזית מוחלטת של כל שורה).
- **השהיה ומחיקה הם שני מסלולים נפרדים לגמרי**, לא "תקופת חסד" לפני מחיקה סופית. השהיה הפיכה תמיד, מחיקה בלתי הפיכה תמיד. לא לערבב בין השניים בעתיד.
- **ביטול השהיה נעשה דרך ה-Magic Link הקיים**, לא מנגנון קוד/מייל מותאם נפרד - שיקול יעילות מכוון.
- **ניהול חשבון (השהיה/מחיקה) חי כשתי שורות ישירות בתפריט הפרופיל**, לא בתוך מודל עריכת פרטים ולא מאוחד במודל "ניהול חשבון" אחד - הוחלט אחרי כמה איטרציות באותו סשן.
- **זיוף MIME type ברמת ה-API לא ייסגר בקרוב הקרוב** - סיכון מקובל במודע, ראו סעיף 5.
- הצפנה מקצה-לקצה (E2E) - עדיין נושא נפרד, סשן תכנון ייעודי.

**מ-30.7 (בוקר):**
- **CORS על Edge Functions דרך בדיקת Origin+regex דינמית**, לא דרך Secret קבוע (`ALLOWED_ORIGIN`) - מבטל את הצורך בעדכון ידני בכל שינוי פורט. זו שדרוג של ההחלטה הקודמת מ-28.7, לא סתירה לה.
- **חדר עם הזמנת-אורח נשאר גלוי לציבור רק כל עוד יש לו הזמנה שטרם מומשה (`used=false`)** - לא "כל עוד אי-פעם הייתה לו הזמנה". זו הבהרה/תיקון של ההחלטה מ-26.7, לא שינוי כיוון.
- **בדיקת `relrowsecurity` בפועל (לא רק תוכן ה-policies) הופכת לצעד קבוע וחובה בתחילת כל סשן אבטחה עתידי.**

**מ-30.7 (אחה"צ):**
- **נוכחות בפועל ב-App Store/Google Play ביום ההשקה היא קריטית**, לא רק PWA. Capacitor + build בענן (Capawesome Cloud מומלץ).
- **תזמון**: פתיחת חשבונות המפתחים מתחילה עכשיו/השבוע (עבודה מנהלתית, לא תלויה בקוד). כל שאר עבודת החנויות (Capacitor בפועל, build, הגשה) נדחית במכוון לשבוע שלפני ההשקה, אחרי שהאפליקציה שלמה - החלטה מודעת של נגה, למרות הסיכון שסומן (זמן Review לא ודאי, שבוע הוא חלון צר).
- **דיון Jitsi (שלב 2 בתוכנית) נדחה כולו ליום ראשון 2.8.2026** כמפגש ייעודי - נושא גדול מדי לסוף מפגש 1.

## 10. שאלות/החלטות פתוחות לשיחה הבאה

**ממשיכות מסשנים קודמים (עדיין פתוחות):**
- השלב הבא באיפיון הפרופילים (Feed/Showcase נפרד, Portfolio, CTA שונה בין Creator ל-Professional)?
- להוסיף בחירת "גם מקצוען" גם ל-ProfileSetupModal הראשוני?
- מתי לגשת להבדלי חדרי הלייב (Stage מול Peer-to-Peer, תור מובנה)?
- מתי לגשת לכלי הפידבק המתקדמים (Waveform annotation, Rubric)?
- מתי לגשת למונטיזציה?
- הודעות אישיות: push/מייל על הודעה חדשה? ארכוב שיחה שלמה בלחיצה אחת?

**מ-28.7 (עדיין רלוונטיות):**
- אם בעתיד ירצו לכסות גם את התרחיש השולי של הזמנת אורח לחדר של מארחת שהשהתה חשבון תוך כדי (כרגע לא מטופל בכוונה - שים לב: זה עדיין נכון גם אחרי תיקון ה-`used=false` מ-30.7, כי חדר עם הזמנה לא-ממומשת של מארחת מושהית עדיין גלוי במכוון).
- להחליט אם/מתי בכל זאת להשקיע בשכבת בדיקת magic-bytes לקבצים (כרגע דחוי במודע).

**מ-30.7 (בוקר):**
- לתאם מולי (נגה) מתי לבצע את בדיקת המחיקה הסופית (דורשת כתובת מייל שאפשר לוותר עליה).
- להחליט אם להקדיש סשן מלא לסקירה שיטתית של כל שאר ה-policies בכל הטבלאות (לאור שתי הפרצות שנמצאו היום, לא ברור שאין עוד).

**חדש מ-30.7 (אחה"צ):**
- **שאלת מוצר פתוחה, נדחתה במכוון:** האם מבקרת אנונימית לגמרי (בלי התחברות) אמורה לראות את רשימת חדרי הלייב הפעילים (בלי יכולת הצטרפות, רק לראות שהם קיימים), או שזה בכוונה מוסתר עד שהיא מתחברת?
- **סיכון פתוח, לא נפתר:** תזמון הגשת החנויות (שבוע לפני השקה בלבד) חושף את התוכנית לזמן Review לא-ודאי של אפל. אם יש סימן לעיכוב באותו שבוע, זה הדבר הראשון שצריך להעלות - האופציה היחידה אז היא PWA כפתרון גישור זמני.
- לוודא שהקובץ המעודכן `תוכנית_עבודה_להשקה.md` (עם המסלול המקביל של החנויות) מוחלף בקבצי הפרויקט אם הוא מועלה שם - קבצי פרויקט הם snapshot קבוע ולא מתעדכנים אוטומטית.

---

## 11. קוד ומצב טכני - פורמט JSON קומפקטי

```json
{
  "last_updated": "2026-07-30-afternoon",
  "session_focus": "fixed LiveRoom realtime subscription bug; strategic decision on app store presence and timing",
  "files_changed_today_afternoon": [
    {
      "path": "src/main.jsx",
      "change": "Added new useEffect creating a Supabase Realtime channel 'live-room-changes' subscribed to postgres_changes (event: '*') on table LiveRoom. Handles INSERT (prepend to rooms state, with existence check to avoid duplicates), UPDATE (replace matching room), DELETE (filter out removed room). No longer relies on manual fetchRooms() re-calls to see other users' new rooms.",
      "status": "delivered as full file, pasted, confirmed working end-to-end with two logged-in users in separate browser sessions (new room appeared instantly on the second user's screen without refresh)."
    }
  ],
  "files_changed_today_morning": [
    {
      "path": "supabase/functions/extract-pdf-text/index.ts",
      "change": "CORS switched from ALLOWED_ORIGIN secret to dynamic Origin-header check against regex /^https:\\/\\/[a-z0-9-]+\\.app\\.github\\.dev$/",
      "status": "deployed, confirmed"
    },
    {
      "path": "supabase/functions/delete-account/index.ts",
      "change": "Same dynamic CORS change as extract-pdf-text. Also fixed folder/file location - was miscreated nested inside extract-pdf-text/ with wrong filename Index.TS, moved to correct sibling path supabase/functions/delete-account/index.ts",
      "status": "deployed, confirmed"
    }
  ],
  "sql_run_today_morning": [
    { "purpose": "Added deactivated_at IS NULL check to Sketch INSERT policy (WITH CHECK)", "target": "Sketch policy 'Users can insert their own sketches'", "status": "confirmed, end-to-end test still pending" },
    { "purpose": "Added deactivated_at IS NULL check to DirectMessage INSERT policy (WITH CHECK)", "target": "DirectMessage policy 'Users can send messages as themselves'", "status": "confirmed, end-to-end test still pending" },
    { "purpose": "Re-enabled RLS at the table level (was fully disabled, relrowsecurity=false)", "target": "Profile, Sketch, SketchFeedback", "status": "confirmed, verified relrowsecurity=true on all 10 tables" },
    { "purpose": "Tightened LiveRoom/RoomInvite guest-visibility policy to require used=false, not just 'invite exists'", "target": "LiveRoom policy 'Rooms are viewable via valid invite'", "status": "confirmed, verified in private window" }
  ],
  "no_sql_or_db_changes_today_afternoon": true,
  "product_decisions_today_afternoon": {
    "app_store_presence": "decided critical, not optional - must be live on App Store and Google Play by launch day, not just a responsive PWA",
    "wrapping_technology": "Capacitor (wraps existing React code, no rewrite) + cloud build service for iOS binary (Capawesome Cloud recommended over Codemagic; explicitly NOT Ionic Appflow due to its announced sunset end of 2027)",
    "android_build": "can be done via GitHub Actions with no Mac dependency at all",
    "apple_deletion_requirement": "Apple Guideline 5.1.1(v) requires in-app account deletion - already built and tested (2026-07-28/30), saves time",
    "timing_decision_after_discussion": "Developer account signups (Apple Developer Program + Google Play Developer) start now/this week - pure administrative work, not code-dependent, and has passive waiting time (24-48h+) not worth compressing into the final week. ALL other store-related work (Capacitor implementation, privacy policy draft, cloud build setup, store asset collection, actual Review submission) deliberately deferred to the week immediately before launch, once the app is feature-complete (video, chat, profiles all working) - Noga's explicit choice after being shown the risk (Apple review time is the least certain factor in the whole plan, one week is a narrow window to absorb a rejection+fix cycle). Risk flagged, not resolved - PWA noted as a temporary bridge option if that week slips.",
    "jitsi_deferred": "Step 2 (Jitsi video/audio) explicitly deferred in full to a dedicated session on Sunday 2026-08-02 - too large a topic for the end of session 1",
    "three_small_security_todos_declined_today": "End-to-end test of deactivated_at INSERT check, systematic policy review for other generic-EXISTS patterns, and ALLOWED_ORIGIN secret cleanup were all offered as small same-session tasks and explicitly declined by Noga for today - still open TODOs for next session"
  },
  "mobile_review_today": {
    "method": "two real phone screenshots (Chrome on Android, via Codespaces URL) reviewed visually",
    "finding": "general layout (side-by-side rooms+feed grid) looked fine, no urgent issues flagged",
    "clarified_to_noga": "browser chrome (URL bar, menu) will disappear once wrapped as an app via Capacitor, but content proportions/layout stay identical because they're determined by viewport width, not chrome presence",
    "detailed_screen_by_screen_QA": "explicitly deferred to stage 5 (pre-launch QA pass), not done today"
  },
  "rls_status": {
    "Profile": { "enabled": true, "policies": ["select: authenticated read-all UNLESS deactivated_at IS NOT NULL (then only owner) - updated 2026-07-28", "insert: own id only", "update: own id only"] },
    "ProfessionalProfile": { "enabled": true, "policies": ["select: authenticated read-all UNLESS linked Profile is deactivated (then only owner) - updated 2026-07-28", "insert/update/delete: own id only"] },
    "Sketch": { "enabled": true, "policies": ["select: is_public=true AND uploader not deactivated, OR own - updated 2026-07-28", "insert: own uploader_user_id only AND uploader not deactivated - updated 2026-07-30", "update/delete: own only"] },
    "SketchFeedback": { "enabled": true, "policies": ["select/insert: tied to related Sketch visibility", "update/delete: own author_user_id only"] },
    "LiveRoom": { "enabled": true, "policies": ["select (general): authenticated read-all UNLESS host is deactivated (then only host sees it) - updated 2026-07-28", "select (extra): public/anon if a matching RoomInvite exists AND that invite is still unused (used=false) - tightened 2026-07-30, previously matched on ANY invite ever created regardless of use", "insert/update/delete: own host_user_id only"] },
    "Room_Participant": { "enabled": true, "policies": ["select: authenticated read-all (historical log, low sensitivity)", "insert: any authenticated user (no user_id column exists to restrict further)"], "known_gap": "no user_id column, can't enforce 'insert only your own record'; account deletion anonymizes by matching stored display_name, best-effort only" },
    "RoomJoinRequest": { "enabled": true, "policies": ["select/update/delete: requester or host of related room", "insert: own requester_user_id only"] },
    "RoomInvite": { "enabled": true, "policies": ["select: public (needed for pre-auth guest flow)", "insert/delete: host of related room only", "update: public, only if used=false -> used=true, no other field changeable - tightened 2026-07-28"], "known_gap": "anyone can still mark any unused invite as used without actually joining (low risk, random UUID) - unchanged" },
    "room_messages": { "enabled": true, "policies": [], "note": "DENY-BY-DEFAULT, unchanged. Needs schema rework (sender_user_id uuid) before real policies can be written." },
    "DirectMessage": { "enabled": true, "policies": ["select: sender or recipient only", "insert: own sender_id only AND sender not deactivated - updated 2026-07-30", "update: sender or recipient (row-level)"], "extra_protection": "BEFORE UPDATE trigger 'restrict_direct_message_updates' unchanged", "account_deletion_behavior": "sender_id/recipient_id set NULL and username set to 'משתמש שנמחק' on deletion; row itself deleted only if both sides already anonymized" }
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
    "extract-pdf-text": { "verify_jwt_toggle": false, "manual_jwt_check_in_code": true, "cors": "dynamic Origin check against regex /^https:\\/\\/[a-z0-9-]+\\.app\\.github\\.dev$/ - updated 2026-07-30, no longer depends on ALLOWED_ORIGIN secret" },
    "delete-account": { "verify_jwt_toggle": false, "manual_jwt_check_in_code": true, "cors": "dynamic Origin check against regex /^https:\\/\\/[a-z0-9-]+\\.app\\.github\\.dev$/ - updated 2026-07-30, no longer depends on ALLOWED_ORIGIN secret", "flow": ["verify JWT -> get target_uid", "collect Storage paths: own Sketch.file_url + SketchFeedback.file_url under own sketches", "storage.remove(paths)", "rpc('delete_account_data', {target_uid})", "auth.admin.deleteUser(target_uid)"], "file_location_note": "correct path is supabase/functions/delete-account/index.ts as a sibling folder to extract-pdf-text - was briefly miscreated nested inside extract-pdf-text/ with wrong filename Index.TS, fixed 2026-07-30" }
  },
  "account_lifecycle_design": {
    "deactivation": {
      "reversible": true,
      "no_time_limit": true,
      "mechanism": "Profile.deactivated_at timestamp set/cleared via direct client-side supabase update (allowed by existing owner-only UPDATE policy)",
      "hiding": "RLS-level, hides Profile/Sketch/ProfessionalProfile/LiveRoom(hosted) from everyone except the owner",
      "login_still_works": true,
      "reactivation_mechanism": "reuses existing Magic Link login itself as the identity-verification step; app then shows a dedicated block screen with a reactivate button that clears deactivated_at",
      "known_limitation": "enforcement is UI-layer + RLS-for-others only; the deactivated user's own API calls to their own rows are not blocked at the RLS layer, since they still hold a valid, non-banned JWT. Impact limited to the user themselves, not third parties (partially addressed 2026-07-30 for Sketch/DirectMessage INSERT specifically).",
      "end_to_end_test_status": "PASSED 2026-07-30 morning: block screen appears correctly, persists across full logout+login (not just refresh), reactivation restores full access. deactivated_at confirmed propagating correctly from main.jsx to App.jsx in live browser."
    },
    "permanent_deletion": {
      "reversible": false,
      "requires_typed_confirmation": "מחק לצמיתות",
      "legal_basis": "anonymization of dependent third-party content + full deletion of exclusively-owned content satisfies erasure requirement under privacy law (equivalent to GDPR Article 17 approach), without breaking other users' threads/conversations",
      "end_to_end_test_status": "NOT YET TESTED as of 2026-07-30 - deferred, no disposable email address available. Gmail '+' trick or temporary email service suggested for future test.",
      "note_2026_07_30_afternoon": "this feature happens to satisfy Apple App Store Guideline 5.1.1(v) which requires in-app account deletion - relevant now that store submission is planned"
    }
  },
  "security_incident_2026_07_30": {
    "summary": "RLS was fully disabled at the table level (relrowsecurity=false) on Profile, Sketch, and SketchFeedback, despite policies being correctly defined on paper. Root cause not identified. Discovered incidentally while testing deactivation end-to-end (a deactivated user's public sketch was visible to a fully logged-out incognito visitor).",
    "impact": "All profiles, all sketches (including private ones), and all feedback were exposed to the public with zero access restriction, unrelated to the deactivation feature being tested - broader exposure than the original test scope.",
    "fix": "ALTER TABLE \"Profile\"/\"Sketch\"/\"SketchFeedback\" ENABLE ROW LEVEL SECURITY; verified relrowsecurity=true on all 10 tables afterward.",
    "secondary_finding": "LiveRoom's guest-invite SELECT policy ('Rooms are viewable via valid invite') only checked whether a RoomInvite row existed for the room at all, not whether it was still unused - meaning any room that ever had an invite link generated remained publicly visible forever, even long after the guest had already joined. Fixed by adding 'AND RoomInvite.used = false' to the EXISTS check. Verified: a room with only used invites disappeared from public view; a room with a genuinely deactivated host + an unused invite remained visible (this second case is the pre-existing, deliberately-accepted edge case from 2026-07-26, not a new gap).",
    "methodological_lesson": "Checking pg_policies content (the qual expression) is not sufficient on its own - must also verify pg_class.relrowsecurity is true at the table level, and must check EXISTS-based policies for real-time relevance conditions (not just 'a related row was ever created'). Recommended as a standard first step in all future security sessions."
  },
  "live_room_realtime_fix_2026_07_30_afternoon": {
    "bug": "New LiveRoom created by one user did not appear for other users without a manual page refresh - no Realtime subscription existed on the LiveRoom table (unlike RoomJoinRequest and DirectMessage which already had channels).",
    "fix": "Added a new Supabase Realtime channel 'live-room-changes' in src/main.jsx, subscribed to postgres_changes on LiveRoom for all event types, updating local rooms state directly on INSERT/UPDATE/DELETE instead of re-fetching.",
    "test_result": "PASSED - verified with two separate logged-in users (not anonymous) in separate browser sessions; new room appeared instantly for the second user without any refresh.",
    "related_non_bug_finding": "An anonymous (fully logged-out) visitor does NOT see any rooms at all, by design - the general LiveRoom SELECT policy is restricted to the 'authenticated' role; anonymous visitors only see rooms via the separate unused-invite policy. This is expected RLS behavior, not related to the Realtime fix, and opened a new deferred product question (see open_questions)."
  },
  "app_store_strategy_2026_07_30_afternoon": {
    "decision": "Must be live on App Store and Google Play by launch day - not optional, not satisfied by PWA alone",
    "wrapping_approach": "Capacitor wraps the existing React codebase (no rewrite) - npx cap init/add ios/add android run fine from within Codespaces with no local machine needed",
    "ios_build_constraint": "Actual iOS binary build requires macOS, solved via a cloud build service (NOT a physical Mac)",
    "recommended_cloud_build_service": "Capawesome Cloud - purpose-built for Capacitor, no complex YAML config, free tier + paid plans from $9/month",
    "alternative_cloud_build_service": "Codemagic - free tier up to 500 macOS build minutes/month",
    "explicitly_not_recommended": "Ionic Appflow - has an announced sunset date (end of 2027), not worth starting a new project on",
    "android_build": "can be fully handled via GitHub Actions with zero Mac dependency",
    "apple_requirement_already_satisfied": "App Store Guideline 5.1.1(v) requires in-app account deletion capability - already built and tested in this project (see account_lifecycle_design.permanent_deletion)",
    "timing_final_decision": {
      "developer_account_signups": "start now/this week (Apple Developer Program + Google Play Developer) - pure administrative work, not code-dependent, has passive approval wait time (24-48h+) best not compressed into final week",
      "everything_else": "deliberately deferred to the week immediately before actual launch (Capacitor implementation, privacy policy/terms of service draft, cloud build setup, store asset collection, actual Review submission) - Noga's explicit choice, made after being shown the risk that Apple's review time is the least certain factor in the whole plan and one week is a narrow window to absorb a rejection+fix cycle. Risk flagged and accepted, not resolved.",
      "bridge_fallback": "if that final week slips, a PWA (installable from browser, 'add to home screen') is noted as a temporary bridge option, not a permanent substitute"
    }
  },
  "pending_verification": [
    "end-to-end test of permanent deletion with a disposable test account (verify Storage files gone, DB rows deleted/anonymized correctly, auth.users entry gone, login impossible afterward) - still deferred as of 2026-07-30, no disposable email available",
    "end-to-end test of the new deactivated_at IS NULL check on Sketch/DirectMessage INSERT (added 2026-07-30 morning, SQL ran successfully but not yet tested by actually attempting an insert from a deactivated account) - offered as a same-session task in the afternoon and explicitly declined for today",
    "systematic review of all remaining RLS policies across all tables for the same 'EXISTS without real-time relevance check' pattern found in RoomInvite/LiveRoom today - not yet performed, also declined for today's afternoon session",
    "verify Storage policies on storage.objects don't indirectly rely on Sketch table RLS having been broken - not checked today"
  ],
  "next_session_plan": {
    "date": "2026-08-02 (Sunday)",
    "focus": "Step 2 of the launch plan - real video/audio in live rooms via Jitsi (meet.jit.si iframe embed). Needs RoomPage.jsx content to start.",
    "carried_over_todos": "the three small security items declined today (end-to-end INSERT policy test, systematic policy review, ALLOWED_ORIGIN cleanup) remain open and could be tackled either before or after the Jitsi work, at Noga's discretion"
  }
}
```

---

## 12. צ'ק-ליסט אבטחה קבוע - להריץ בסוף כל יום עבודה שנוגע בקוד/DB/הרשאות

נוצר ב-30.7.2026, בעקבות גילוי RLS כבוי + policy כפולה סותרת שנשארו בלי משים באותו יום. המטרה: לתפוס פערים חדשים מוקדם, לפני שהם מצטברים. **לא צריך להריץ את כל הרשימה בכל יום** - רק את הסעיפים הרלוונטיים לשינוי שנעשה (למשל: אם רק עבדת על UI בלי לגעת ב-DB, מספיק סעיף 5). **הערה: מפגש 30.7 אחה"צ לא נגע ב-DB בכלל (רק frontend + תכנון) - לכן לא הורץ הצ'ק-ליסט הזה באותו מפגש, וזה תקין.**

**1. RLS מופעל בפועל בכל הטבלאות (לא רק "policies קיימות"):**
```sql
SELECT relname, relrowsecurity FROM pg_class
WHERE relname IN ('Sketch','SketchFeedback','Profile','ProfessionalProfile','LiveRoom','Room_Participant','RoomJoinRequest','RoomInvite','room_messages','DirectMessage')
ORDER BY relname;
```
כל שורה חייבת להיות `true`. אם משהו `false` - זו חשיפה מלאה, לתקן מיידית עם `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`.

**2. אין policies כפולות/סותרות על אותה טבלה+פעולה:**
```sql
SELECT tablename, cmd, count(*), array_agg(policyname)
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename, cmd
HAVING count(*) > 1;
```
כל שורה שחוזרת - לבדוק ידנית שכל ה-policies שם מכוונות, לא ששכחו למחוק ישנה. (policies מתחברות ב-OR, אז ישנה "רפויה" מבטלת חדשה "מהודקת".)

**3. חיפוש תבנית "EXISTS גנרי" בלי תנאי רלוונטיות בזמן אמת:**
```sql
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;
```
לעבור ידנית ולוודא שכל `EXISTS (SELECT 1 FROM ...)` בודק גם שדה סטטוס רלוונטי (כמו `used=false`, `deactivated_at IS NULL`), לא רק "שורה קשורה קיימת אי-פעם".

**4. תלויות npm פגיעות:**
```
npm audit
```
לתקן אזהרות "High"/"Critical". לא חובה בכל יום - מספיק פעם בשבוע, או אחרי הוספת ספרייה חדשה.

**5. Site URL מסונכרן (רק אם נוגעים ב-Auth/Magic Link היום):**
לוודא שה-URL הפעיל של הקודספייס תואם גם ל-Site URL וגם ל-Redirect URLs ב-Supabase Dashboard (לא מספיק רק Redirect URLs - ראו לקח מ-30.7 בסעיף 2).

**6. Service Role Key לא דלף לקוד frontend/Git:**
```
grep -r "SUPABASE_SERVICE_ROLE_KEY\|service_role" src/
```
צריך לחזור ריק - המפתח הזה שייך אך ורק ל-Edge Functions/Secrets, לעולם לא לקוד React.

**7. שימוש מסוכן ב-React (שער נפוץ ל-XSS):**
```
grep -rn "dangerouslySetInnerHTML" src/
```
אם יש תוצאה - לבדוק שהתוכן המוצג שם אינו קלט משתמש גולמי בלי sanitization.

**מה שהצ'ק-ליסט הזה לא מכסה (לזכור שזה קיים, גם אם לא נבדק כל יום):**
- בדיקת חדירה שיטתית אמיתית (Penetration Testing) - מעבר לסקירת קוד/policies ידנית.
- הגדרות Auth מתקדמות כמו "Leaked Password Protection" ב-Supabase - שווה לוודא שדלוקות, לא נבדק עדיין נכון ל-30.7.
- אבטחת תשתית הענן עצמה (misconfigurations ברמת הפרויקט/ספק) - לא רלוונטי כרגע בהיקף הפרויקט, אך שווה audit חיצוני לפני השקה בפועל.