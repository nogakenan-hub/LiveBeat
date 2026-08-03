import React, { useState, useContext } from 'react';
import { SupabaseContext } from '../main';

var MAX_FILE_SIZE = 50 * 1024 * 1024;

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

function getSafeFileExtension(fileName) {
  var parts = fileName.split('.');
  if (parts.length < 2) return 'bin';
  var ext = parts[parts.length - 1];
  var cleanExt = ext.replace(/[^a-zA-Z0-9]/g, '');
  if (!cleanExt) return 'bin';
  return cleanExt.toLowerCase();
}

function buildSafeFilePath(file) {
  var randomId = (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + '_' + String(Math.random()).slice(2);
  var ext = getSafeFileExtension(file.name);
  return randomId + '.' + ext;
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

  var isPublicState = useState(true);
  var isPublic = isPublicState[0];
  var setIsPublic = isPublicState[1];

  var fileState = useState(null);
  var file = fileState[0];
  var setFile = fileState[1];

  var extractedTextState = useState('');
  var extractedText = extractedTextState[0];
  var setExtractedText = extractedTextState[1];

  var isExtractingState = useState(false);
  var isExtracting = isExtractingState[0];
  var setIsExtracting = isExtractingState[1];

  var extractionErrorState = useState('');
  var extractionError = extractionErrorState[0];
  var setExtractionError = extractionErrorState[1];

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

    setFile(selected);
    setExtractedText('');
    setExtractionError('');

    var type = detectFileType(selected);
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

    var fileType = detectFileType(file);

    if (fileType === 'text' && !extractedText) {
      alert('לא נמצא טקסט להעלאה. אפשר להדביק את הטקסט ידנית בתיבה לפני הפרסום.');
      return;
    }

    setIsSubmitting(true);

    if (fileType === 'text') {
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
      };

      supabase
        .from('Sketch')
        .insert([textRow])
        .select()
        .single()
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
        });
      return;
    }

    var filePath = buildSafeFilePath(file);

    supabase.storage
      .from('sketch-files')
      .upload(filePath, file)
      .then(function (uploadResult) {
        if (uploadResult.error) {
          throw uploadResult.error;
        }

        // שומרות את הנתיב הגולמי בלבד - לא URL ציבורי.
        // ה-bucket פרטי; קישור זמני (Signed URL) ייווצר "לפי דרישה" רק למי שיש לו הרשאה,
        // בהתאם ל-RLS על storage.objects שמכבדת את is_public/uploader_user_id של הקטע.
        var row = {
          title: title,
          file_url: filePath,
          file_type: fileType,
          genre: genre,
          status: 'דרוש פידבק',
          uploader_username: profile.display_name,
          uploader_user_id: session.user.id,
          is_public: isPublic,
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

  function resetForm() {
    setTitle('');
    setGenre('');
    setIsPublic(true);
    setFile(null);
    setExtractedText('');
    setExtractionError('');
  }

  var currentFileType = file ? detectFileType(file) : null;
  var showTextArea = currentFileType === 'text';

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
            disabled={isSubmitting || isExtracting}
            className="flex-1 bg-green-600 hover:bg-green-700 p-3 rounded-lg font-bold transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'מעלה...' : 'העלאה'}
          </button>
        </div>
      </div>
    </div>
  );
}