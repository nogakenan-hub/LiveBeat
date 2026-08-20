import React, { useState, useContext } from 'react';
import { SupabaseContext } from '../main';

var MAX_FILE_SIZE = 50 * 1024 * 1024;
var MAX_COVER_IMAGE_SIZE = 5 * 1024 * 1024; // חדש 20.08.2026 - תמונת נושא, מוגבל בנפרד מהקובץ הראשי

function detectFileType(file) {
  if (file.type.indexOf('audio/') === 0) return 'sound';
  if (file.type.indexOf('video/') === 0) return 'video';
  return 'text';
}

function isWordFile(file) {
  var name = file.name.toLowerCase();
  if (name.indexOf('.doc') !== -1 || name.indexOf('.docx') !== -1) return true;
  if (file.type === 'application/msword') return true;
  if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return true;
  return false;
}

function arrayBufferToBase64(buffer) {
  var binary = '';
  var bytes = new Uint8Array(buffer);
  var len = bytes.byteLength;
  for (var i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// --- תיקון תאימות קבצי WAV ---
// חלק מתוכנות ה-DAW (Logic, Ableton, Pro Tools וכו') מייצאות WAV בקידודים
// פנימיים (24-bit, IEEE Float ועוד) שחלק מהדפדפנים לא יודעים לנגן ישירות
// דרך תג <audio> רגיל (במיוחד Firefox). הפתרון: לפענח את הקובץ המקורי עם
// Web Audio API (יותר "סלחני" מתג <audio>), ולכתוב אותו מחדש כ-WAV קנוני
// (16-bit PCM) - הפורמט הכי אוניברסלי שקיים, לפני ההעלאה בכלל.
// אם הפענוח נכשל מכל סיבה - נופלים בחזרה לקובץ המקורי, לא חוסמים העלאה.

function isWavFile(file) {
  var lowerName = file.name.toLowerCase();
  if (lowerName.indexOf('.wav') !== -1) return true;
  if (file.type === 'audio/wav' || file.type === 'audio/x-wav') return true;
  return false;
}

function writeAsciiString(view, offset, str) {
  for (var i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

function audioBufferToWavBlob(audioBuffer) {
  var numChannels = audioBuffer.numberOfChannels;
  var sampleRate = audioBuffer.sampleRate;
  var bitDepth = 16;
  var bytesPerSample = bitDepth / 8;
  var blockAlign = numChannels * bytesPerSample;
  var numFrames = audioBuffer.length;
  var dataSize = numFrames * blockAlign;

  var buffer = new ArrayBuffer(44 + dataSize);
  var view = new DataView(buffer);

  writeAsciiString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAsciiString(view, 8, 'WAVE');
  writeAsciiString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // גודל chunk ה-fmt
  view.setUint16(20, 1, true); // format = 1 (PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeAsciiString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  var channelData = [];
  var ch;
  for (ch = 0; ch < numChannels; ch++) {
    channelData.push(audioBuffer.getChannelData(ch));
  }

  var offset = 44;
  var frame;
  for (frame = 0; frame < numFrames; frame++) {
    for (ch = 0; ch < numChannels; ch++) {
      var sample = channelData[ch][frame];
      sample = Math.max(-1, Math.min(1, sample));
      var intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function reencodeWavFile(file) {
  return new Promise(function (resolve) {
    var AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      resolve(file);
      return;
    }

    var reader = new FileReader();
    reader.onload = function () {
      var audioCtx = new AudioContextClass();
      audioCtx.decodeAudioData(
        reader.result,
        function (audioBuffer) {
          var wavBlob = audioBufferToWavBlob(audioBuffer);
          var reencodedFile = new File([wavBlob], file.name, { type: 'audio/wav' });
          audioCtx.close();
          resolve(reencodedFile);
        },
        function (decodeError) {
          console.error('שגיאה בפענוח WAV לצורך תיקון פורמט - משתמשת בקובץ המקורי:', decodeError);
          audioCtx.close();
          resolve(file);
        }
      );
    };
    reader.onerror = function () {
      resolve(file);
    };
    reader.readAsArrayBuffer(file);
  });
}

function formatFileSizeMb(bytes) {
  return (bytes / (1024 * 1024)).toFixed(1);
}

export default function UploadSketchModal(props) {
  var isOpen = props.isOpen;
  var onClose = props.onClose;
  var onSketchUploaded = props.onSketchUploaded;
  var profile = props.profile;
  var session = props.session;

  var supabase = useContext(SupabaseContext);

  var titleState = useState('');
  var title = titleState[0];
  var setTitle = titleState[1];

  var genreState = useState('');
  var genre = genreState[0];
  var setGenre = genreState[1];

  // עודכן 19.08.2026: ברירת מחדל של נראות עברה מציבורי לפרטי (מודל דומה ל-Suno) -
  // קהל היעד האמיתי (מורה-תלמיד, מפיק-אמן, חברי להקה) לא צריך גילוי ציבורי כברירת מחדל.
  var isPublicState = useState(false);
  var isPublic = isPublicState[0];
  var setIsPublic = isPublicState[1];

  var fileState = useState(null);
  var file = fileState[0];
  var setFile = fileState[1];

  // חדש 20.08.2026 - תמונת נושא, נפרדת לגמרי מהקובץ הראשי (סאונד/וידאו/טקסט)
  var coverImageFileState = useState(null);
  var coverImageFile = coverImageFileState[0];
  var setCoverImageFile = coverImageFileState[1];

  var coverImagePreviewUrlState = useState('');
  var coverImagePreviewUrl = coverImagePreviewUrlState[0];
  var setCoverImagePreviewUrl = coverImagePreviewUrlState[1];

  var extractedTextState = useState('');
  var extractedText = extractedTextState[0];
  var setExtractedText = extractedTextState[1];

  var isExtractingState = useState(false);
  var isExtracting = isExtractingState[0];
  var setIsExtracting = isExtractingState[1];

  var extractionErrorState = useState('');
  var extractionError = extractionErrorState[0];
  var setExtractionError = extractionErrorState[1];

  var isConvertingWavState = useState(false);
  var isConvertingWav = isConvertingWavState[0];
  var setIsConvertingWav = isConvertingWavState[1];

  var submittingState = useState(false);
  var isSubmitting = submittingState[0];
  var setIsSubmitting = submittingState[1];

  if (!isOpen) return null;

  function runServerExtraction(selectedFile, fileTypeParam) {
    setIsExtracting(true);
    setExtractionError('');
    setExtractedText('');

    var reader = new FileReader();
    reader.onload = function () {
      var base64 = arrayBufferToBase64(reader.result);

      supabase.functions
        .invoke('extract-pdf-text', { body: { fileBase64: base64, fileType: fileTypeParam } })
        .then(function (result) {
          setIsExtracting(false);
          if (result.error || (result.data && result.data.error)) {
            var message = result.error ? result.error.message : result.data.error;
            console.error('שגיאה בחילוץ טקסט:', message);
            setExtractionError('לא הצלחנו לחלץ טקסט אוטומטית. אפשר להדביק את הטקסט ידנית למטה.');
            return;
          }
          setExtractedText(result.data.text || '');
        })
        .catch(function (error) {
          setIsExtracting(false);
          console.error('שגיאה בחילוץ טקסט:', error);
          setExtractionError('לא הצלחנו לחלץ טקסט אוטומטית. אפשר להדביק את הטקסט ידנית למטה.');
        });
    };
    reader.readAsArrayBuffer(selectedFile);
  }

  function readPlainTextFile(selectedFile) {
    var reader = new FileReader();
    reader.onload = function () {
      setExtractedText(String(reader.result || ''));
    };
    reader.readAsText(selectedFile);
  }

  function handleFileChange(e) {
    var selected = e.target.files[0];
    if (!selected) return;

    if (selected.size > MAX_FILE_SIZE) {
      alert('הקובץ גדול מדי - המגבלה היא 50MB לקובץ.');
      e.target.value = '';
      return;
    }

    setExtractedText('');
    setExtractionError('');

    var type = detectFileType(selected);

    if (type === 'sound' && isWavFile(selected)) {
      setFile(selected);
      setIsConvertingWav(true);
      reencodeWavFile(selected).then(function (finalFile) {
        setIsConvertingWav(false);
        setFile(finalFile);
      });
      return;
    }

    setFile(selected);

    if (type === 'text') {
      if (selected.type === 'application/pdf') {
        runServerExtraction(selected, 'pdf');
      } else if (isWordFile(selected)) {
        runServerExtraction(selected, 'word');
      } else if (selected.type === 'text/plain') {
        readPlainTextFile(selected);
      }
    }
  }

  // חדש 20.08.2026 - בחירת תמונת נושא: ולידציה מקומית (סוג+גודל) + תצוגה מקדימה
  // מקומית מיידית עם URL.createObjectURL (לא מעלה כלום עדיין - זה קורה רק בשליחה בפועל)
  function handleCoverImageChange(e) {
    var selected = e.target.files[0];
    if (!selected) return;

    if (selected.type.indexOf('image/') !== 0) {
      alert('תמונת הנושא חייבת להיות קובץ תמונה.');
      e.target.value = '';
      return;
    }

    if (selected.size > MAX_COVER_IMAGE_SIZE) {
      alert('תמונת הנושא גדולה מדי - המגבלה היא 5MB.');
      e.target.value = '';
      return;
    }

    if (coverImagePreviewUrl) {
      URL.revokeObjectURL(coverImagePreviewUrl);
    }

    setCoverImageFile(selected);
    setCoverImagePreviewUrl(URL.createObjectURL(selected));
  }

  function handleRemoveCoverImage() {
    if (coverImagePreviewUrl) {
      URL.revokeObjectURL(coverImagePreviewUrl);
    }
    setCoverImageFile(null);
    setCoverImagePreviewUrl('');
  }

  // חדש 20.08.2026 - מעלה את תמונת הנושא (אם נבחרה) ל-B2 באותו נתיב Presigned URL
  // כמו הקובץ הראשי, ומחזירה Promise שמתממש ל-objectKey (או null אם אין תמונה בכלל).
  // מופעלת תמיד לפני שמירת השורה ב-Sketch, גם בזרימת טקסט וגם בזרימת מדיה.
  function uploadCoverImageIfNeeded() {
    if (!coverImageFile) {
      return Promise.resolve(null);
    }

    return supabase.functions
      .invoke('media-presigned-url', {
        body: {
          action: 'upload',
          fileName: coverImageFile.name,
          contentType: coverImageFile.type,
          declaredSizeBytes: coverImageFile.size,
        },
      })
      .then(function (presignResult) {
        if (presignResult.error || (presignResult.data && presignResult.data.error)) {
          var presignMessage = presignResult.error ? presignResult.error.message : presignResult.data.error;
          throw new Error('תמונת נושא: ' + presignMessage);
        }

        var uploadUrl = presignResult.data.uploadUrl;
        var objectKey = presignResult.data.objectKey;

        return fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': coverImageFile.type },
          body: coverImageFile,
        }).then(function (putResponse) {
          if (!putResponse.ok) {
            throw new Error('העלאת תמונת הנושא נכשלה (סטטוס ' + putResponse.status + ')');
          }
          return objectKey;
        });
      });
  }

  // --- זרימת ההעלאה החדשה: קבצי מדיה (סאונד/וידאו) עוברים ל-Backblaze B2 ---
  // שלב 1: מבקשות מה-Edge Function URL חתום להעלאה ישירה (הפונקציה גם
  //         מייצרת שם קובץ בטוח בצד השרת - אין יותר buildSafeFilePath כאן).
  // שלב 2: מעלות את הקובץ עצמו ישירות ל-B2 עם fetch רגיל (לא דרך Supabase).
  // שלב 3: שומרות שורת Sketch עם storage_provider='backblaze' ועם מפתח
  //        הקובץ (objectKey) שחזר מה-Edge Function.
  function performMediaUpload(fileType) {
    var coverImageObjectKey = null;

    uploadCoverImageIfNeeded()
      .then(function (resolvedCoverKey) {
        coverImageObjectKey = resolvedCoverKey;

        return supabase.functions.invoke('media-presigned-url', {
          body: {
            action: 'upload',
            fileName: file.name,
            contentType: file.type,
            declaredSizeBytes: file.size,
          },
        });
      })
      .then(function (presignResult) {
        if (presignResult.error || (presignResult.data && presignResult.data.error)) {
          var presignMessage = presignResult.error ? presignResult.error.message : presignResult.data.error;
          throw new Error(presignMessage);
        }

        var uploadUrl = presignResult.data.uploadUrl;
        var objectKey = presignResult.data.objectKey;

        return fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        }).then(function (putResponse) {
          if (!putResponse.ok) {
            throw new Error('העלאת הקובץ נכשלה (סטטוס ' + putResponse.status + ')');
          }
          return objectKey;
        });
      })
      .then(function (objectKey) {
        var row = {
          title: title,
          file_url: objectKey,
          file_type: fileType,
          genre: genre,
          status: 'דרוש פידבק',
          uploader_username: profile.display_name,
          uploader_user_id: session.user.id,
          is_public: isPublic,
          storage_provider: 'backblaze',
          cover_image_url: coverImageObjectKey,
        };

        return supabase
          .from('Sketch')
          .insert([row])
          .select()
          .single();
      })
      .then(function (insertResult) {
        if (insertResult.error) {
          throw insertResult.error;
        }

        if (typeof onSketchUploaded === 'function') {
          onSketchUploaded(insertResult.data);
        }

        setIsSubmitting(false);
        resetForm();
        onClose();
      })
      .catch(function (error) {
        console.error('שגיאה בהעלאת הקובץ:', error.message);
        alert('קרתה שגיאה בהעלאת הקובץ: ' + error.message);
        setIsSubmitting(false);
      });
  }

  function handleUpload(e) {
    if (e && e.preventDefault) e.preventDefault();

    if (!title) {
      alert('נא להזין כותרת');
      return;
    }
    if (!file) {
      alert('נא לבחור קובץ');
      return;
    }
    if (!profile || !profile.display_name) {
      alert('חסר שם תצוגה בפרופיל');
      return;
    }
    if (isConvertingWav) {
      alert('עדיין מתקנת את פורמט הקובץ - רגע בבקשה');
      return;
    }

    var fileType = detectFileType(file);

    if (fileType === 'text' && !extractedText) {
      alert('לא נמצא טקסט להעלאה. אפשר להדביק את הטקסט ידנית בתיבה לפני הפרסום.');
      return;
    }

    setIsSubmitting(true);

    if (fileType === 'text') {
      uploadCoverImageIfNeeded()
        .then(function (coverImageObjectKey) {
          var textRow = {
            title: title,
            file_url: null,
            file_type: 'text',
            genre: genre,
            status: 'דרוש פידבק',
            uploader_username: profile.display_name,
            uploader_user_id: session.user.id,
            extracted_text: extractedText,
            is_public: isPublic,
            cover_image_url: coverImageObjectKey,
          };

          return supabase
            .from('Sketch')
            .insert([textRow])
            .select()
            .single();
        })
        .then(function (insertResult) {
          setIsSubmitting(false);
          if (insertResult.error) {
            console.error('שגיאה בשמירת הקטע:', insertResult.error.message);
            alert('קרתה שגיאה בשמירת הקטע: ' + insertResult.error.message);
            return;
          }
          if (typeof onSketchUploaded === 'function') {
            onSketchUploaded(insertResult.data);
          }
          resetForm();
          onClose();
        })
        .catch(function (error) {
          setIsSubmitting(false);
          console.error('שגיאה בשמירת הקטע:', error.message);
          alert('קרתה שגיאה בשמירת הקטע: ' + error.message);
        });
      return;
    }

    performMediaUpload(fileType);
  }

  function resetForm() {
    setTitle('');
    setGenre('');
    setIsPublic(false);
    setFile(null);
    setExtractedText('');
    setExtractionError('');
    setIsConvertingWav(false);
    if (coverImagePreviewUrl) {
      URL.revokeObjectURL(coverImagePreviewUrl);
    }
    setCoverImageFile(null);
    setCoverImagePreviewUrl('');
  }

  var currentFileType = file ? detectFileType(file) : null;
  var showTextArea = currentFileType === 'text';
  var isCurrentFileWav = !!(file && (file.type === 'audio/wav' || file.type === 'audio/x-wav'));

  function visibilityButtonClass(active) {
    if (active) {
      return 'flex-1 bg-green-600 p-2.5 rounded-lg font-bold text-sm transition-colors';
    }
    return 'flex-1 bg-gray-800 border border-gray-700 p-2.5 rounded-lg text-sm transition-colors hover:bg-gray-700';
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 p-8 rounded-2xl w-full max-w-md text-white shadow-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6">העלאת קטע חדש</h2>

        <label className="block text-sm text-gray-400 mb-1">כותרת *</label>
        <input
          value={title}
          onChange={function (e) { setTitle(e.target.value); }}
          placeholder="שם הקטע"
          className="w-full bg-gray-800 border border-gray-700 p-3 mb-4 rounded-lg focus:border-green-500 outline-none"
        />

        <label className="block text-sm text-gray-400 mb-1">סגנון (אופציונלי)</label>
        <input
          value={genre}
          onChange={function (e) { setGenre(e.target.value); }}
          placeholder="למשל: גאז, היפ הופ, רוק"
          className="w-full bg-gray-800 border border-gray-700 p-3 mb-4 rounded-lg focus:border-green-500 outline-none"
        />

        <label className="block text-sm text-gray-400 mb-1">נראות</label>
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={function () { setIsPublic(true); }}
            className={visibilityButtonClass(isPublic)}
          >
            ציבורי - נראה לכולם
          </button>
          <button
            type="button"
            onClick={function () { setIsPublic(false); }}
            className={visibilityButtonClass(!isPublic)}
          >
            פרטי - נראה רק לך
          </button>
        </div>

        <label className="block text-sm text-gray-400 mb-1">קובץ * (סאונד / טקסט / וידאו, עד 50MB)</label>
        <input
          type="file"
          accept="audio/*,video/*,text/plain,application/pdf,application/msword,.doc,.docx"
          onChange={handleFileChange}
          className="w-full bg-gray-800 border border-gray-700 p-3 mb-3 rounded-lg text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-green-600 file:text-white"
        />

        <label className="block text-sm text-gray-400 mb-1">תמונת נושא (אופציונלי, עד 5MB)</label>
        {coverImagePreviewUrl ? (
          <div className="flex items-center gap-3 mb-4">
            <img
              src={coverImagePreviewUrl}
              alt="תצוגה מקדימה של תמונת הנושא"
              className="w-16 h-16 rounded-lg object-cover border border-gray-700"
            />
            <button
              type="button"
              onClick={handleRemoveCoverImage}
              className="text-xs text-red-400 hover:text-red-300"
            >
              הסרת תמונה
            </button>
          </div>
        ) : (
          <input
            type="file"
            accept="image/*"
            onChange={handleCoverImageChange}
            className="w-full bg-gray-800 border border-gray-700 p-3 mb-4 rounded-lg text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-gray-700 file:text-white"
          />
        )}

        {isConvertingWav ? (
          <p className="text-xs text-gray-500 mb-3">מתקנת את פורמט קובץ ה-WAV לתאימות מלאה עם דפדפנים...</p>
        ) : null}

        {isCurrentFileWav && !isConvertingWav && !isSubmitting ? (
          <p className="text-xs text-gray-500 mb-3">
            קובץ WAV ({formatFileSizeMb(file.size)}MB) - קבצים כאלה גדולים משמעותית מ-MP3, ולכן ההעלאה עשויה לקחת כמה דקות בהתאם למהירות האינטרנט שלך.
          </p>
        ) : null}

        {isCurrentFileWav && isSubmitting ? (
          <p className="text-xs text-amber-400 mb-3">
            מעלה קובץ WAV ({formatFileSizeMb(file.size)}MB) - זה עשוי לקחת כמה דקות, זה תקין ולא תקוע. נא לא לסגור את החלון.
          </p>
        ) : null}

        {currentFileType === 'text' ? (
          <p className="text-xs text-gray-500 mb-3">
            קבצי PDF/Word/טקסט: שומרים רק את הטקסט שחולץ - הקובץ המקורי לא נשמר באתר, מטעמי בטיחות.
          </p>
        ) : null}

        {showTextArea ? (
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-1">
              {isExtracting ? 'מחלצת טקסט מהקובץ...' : 'תצוגה מקדימה - אפשר לערוך לפני פרסום'}
            </label>
            {extractionError ? (
              <p className="text-xs text-red-400 mb-2">{extractionError}</p>
            ) : null}
            <textarea
              value={extractedText}
              onChange={function (e) { setExtractedText(e.target.value); }}
              rows={8}
              disabled={isExtracting}
              placeholder={isExtracting ? '...' : 'אפשר גם להדביק טקסט ידנית כאן'}
              className="w-full bg-gray-800 border border-gray-700 p-3 rounded-lg focus:border-green-500 outline-none text-sm resize-none disabled:opacity-50"
            />
          </div>
        ) : null}

        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 bg-gray-700 hover:bg-gray-600 p-3 rounded-lg font-bold transition-colors disabled:opacity-50"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={isSubmitting || isExtracting || isConvertingWav}
            className="flex-1 bg-green-600 hover:bg-green-700 p-3 rounded-lg font-bold transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'מעלה...' : isConvertingWav ? 'מתקנת פורמט...' : 'העלאה'}
          </button>
        </div>
      </div>
    </div>
  );
}