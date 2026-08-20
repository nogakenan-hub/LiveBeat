// scripts/migrate-to-b2.mjs
//
// סקריפט חד-פעמי: מעביר קבצים קיימים מ-Supabase Storage ל-Backblaze B2,
// ומעדכן את storage_provider ל-'backblaze' בכל שורה שהועברה בהצלחה.
//
// לא מוחק כלום מ-Supabase Storage - הקבצים המקוריים נשארים שם כגיבוי,
// עד שתבדקי שהכל עובד ותמחקי אותם ידנית בעצמך בהמשך.
//
// שם הקובץ ב-B2 זהה בדיוק לשם הקובץ ב-Supabase (שניהם כבר בפורמט uuid.ext) -
// לכן אין צורך לשנות את עמודת file_url בכלל, רק את storage_provider.
//
// שיטת ההעלאה: Presigned URL בלי Content-Type בתוך החתימה עצמה (בדיוק כמו
// ה-GET שכבר עובד היום בפועל להורדה/ניגון) - ה-Content-Type נשלח כ-header
// רגיל, לא-חתום, בבקשת ה-PUT עצמה. זה נמנע מבעיית SignatureDoesNotMatch
// שקרתה כשהוא נכלל בחתימה (כנראה Node משנה מעט את ה-header כש-body הוא Blob).
//
// הרצה:
//   node scripts/migrate-to-b2.mjs --dry-run     (בדיקה בלבד, לא נוגע בכלום)
//   node scripts/migrate-to-b2.mjs               (הרצה אמיתית)
//
// לפני ההרצה צריך להזין בטרמינל (export), לא לשמור בשום קובץ:
//   export SUPABASE_URL=...
//   export SUPABASE_SERVICE_ROLE_KEY=...
//   export B2_KEY_ID=...
//   export B2_APPLICATION_KEY=...
//   export B2_BUCKET_NAME=...
//   export B2_ENDPOINT=...

import { createClient } from '@supabase/supabase-js';
import { AwsClient } from 'aws4fetch';

var isDryRun = process.argv.includes('--dry-run');

var requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'B2_KEY_ID',
  'B2_APPLICATION_KEY',
  'B2_BUCKET_NAME',
  'B2_ENDPOINT',
];

function checkRequiredEnvVars() {
  var missing = requiredEnvVars.filter(function (name) {
    return !process.env[name];
  });
  if (missing.length > 0) {
    console.error('חסרים משתני סביבה: ' + missing.join(', '));
    console.error('הזיני אותם עם export לפני הרצת הסקריפט (ראי הערות בראש הקובץ).');
    process.exit(1);
  }
}

checkRequiredEnvVars();

var supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function extractRegionFromEndpoint(endpoint) {
  var parts = endpoint.split('.');
  if (parts.length < 2) return 'auto';
  return parts[1];
}

var b2Client = new AwsClient({
  accessKeyId: process.env.B2_KEY_ID,
  secretAccessKey: process.env.B2_APPLICATION_KEY,
  service: 's3',
  region: extractRegionFromEndpoint(process.env.B2_ENDPOINT),
});

function guessContentType(fileName, blobType) {
  if (blobType) return blobType;
  var lower = fileName.toLowerCase();
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  if (lower.endsWith('.webm')) return 'video/webm';
  return 'application/octet-stream';
}

// חתימה בלי Content-Type בכלל - בדיוק כמו ה-GET שכבר מוכח כעובד.
async function buildPresignedPutUrl(fileName) {
  var bucketName = process.env.B2_BUCKET_NAME;
  var endpoint = process.env.B2_ENDPOINT;

  var url = new URL('https://' + endpoint + '/' + bucketName + '/' + fileName);
  url.searchParams.set('X-Amz-Expires', '3600');

  var signedRequest = await b2Client.sign(url.toString(), {
    method: 'PUT',
    aws: { signQuery: true },
  });

  return signedRequest.url;
}

async function uploadToB2(fileName, blob) {
  var contentType = guessContentType(fileName, blob.type);
  var presignedUrl = await buildPresignedPutUrl(fileName);

  // ה-Content-Type כאן הוא header רגיל, לא-חתום - לא משפיע על תקינות
  // החתימה, אבל עדיין דואג שהקובץ יישמר עם סוג התוכן הנכון ב-B2.
  var response = await fetch(presignedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  });

  if (!response.ok) {
    var errorText = await response.text();
    throw new Error('העלאה ל-B2 נכשלה (סטטוס ' + response.status + '): ' + errorText);
  }
}

async function migrateTable(tableName) {
  console.log('\n--- טבלה: ' + tableName + ' ---');

  var selectResult = await supabase
    .from(tableName)
    .select('id, file_url')
    .eq('storage_provider', 'supabase')
    .not('file_url', 'is', null);

  if (selectResult.error) {
    console.error('שגיאה בשליפת שורות מ-' + tableName + ':', selectResult.error.message);
    return { successCount: 0, failureCount: 0, failedRows: [] };
  }

  var rows = selectResult.data;
  console.log('נמצאו ' + rows.length + ' שורות להעברה.');

  if (isDryRun) {
    rows.forEach(function (row) {
      console.log('  [DRY RUN] הייתי מעבירה: ' + row.file_url + ' (id: ' + row.id + ')');
    });
    return { successCount: 0, failureCount: 0, failedRows: [] };
  }

  var successCount = 0;
  var failedRows = [];

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var progressLabel = '[' + (i + 1) + '/' + rows.length + ']';

    try {
      var downloadResult = await supabase.storage.from('sketch-files').download(row.file_url);

      if (downloadResult.error || !downloadResult.data) {
        throw new Error(
          'הורדה מ-Supabase נכשלה: ' + (downloadResult.error ? downloadResult.error.message : 'unknown error')
        );
      }

      await uploadToB2(row.file_url, downloadResult.data);

      var updateResult = await supabase
        .from(tableName)
        .update({ storage_provider: 'backblaze' })
        .eq('id', row.id);

      if (updateResult.error) {
        throw new Error('עדכון storage_provider נכשל: ' + updateResult.error.message);
      }

      console.log(progressLabel + ' הועבר בהצלחה: ' + row.file_url);
      successCount = successCount + 1;
    } catch (error) {
      console.error(progressLabel + ' נכשל (' + row.file_url + '): ' + error.message);
      failedRows.push({ id: row.id, file_url: row.file_url, error: error.message });
    }
  }

  return { successCount: successCount, failureCount: failedRows.length, failedRows: failedRows };
}

async function main() {
  console.log(isDryRun ? 'מצב DRY RUN - לא יבוצע שום שינוי בפועל.' : 'מתחילה העברה בפועל...');

  var sketchResult = await migrateTable('Sketch');
  var feedbackResult = await migrateTable('SketchFeedback');

  console.log('\n=== סיכום ===');
  console.log('Sketch: ' + sketchResult.successCount + ' הצליחו, ' + sketchResult.failureCount + ' נכשלו.');
  console.log('SketchFeedback: ' + feedbackResult.successCount + ' הצליחו, ' + feedbackResult.failureCount + ' נכשלו.');

  var allFailed = sketchResult.failedRows.concat(feedbackResult.failedRows);
  if (allFailed.length > 0) {
    console.log('\nשורות שנכשלו (אפשר להריץ את הסקריפט שוב - הוא ידלג על מה שכבר הצליח):');
    allFailed.forEach(function (f) {
      console.log('  - id: ' + f.id + ', file: ' + f.file_url + ', error: ' + f.error);
    });
  }

  if (!isDryRun && allFailed.length === 0) {
    console.log('\nהכל הועבר בהצלחה. הקבצים המקוריים עדיין ב-Supabase Storage כגיבוי - למחוק ידנית בהמשך, אחרי בדיקה.');
  }
}

main();