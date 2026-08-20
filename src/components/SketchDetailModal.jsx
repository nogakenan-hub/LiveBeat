import React, { useState, useContext, useEffect } from 'react';
import { SupabaseContext } from '../main';

var soundFallbackText = 'הדפדפן שלך לא תומך בנגן שמע.';
var videoFallbackText = 'הדפדפן שלך לא תומך בנגן וידאו.';
var textLinkLabel = 'פתיחה או הורדה של הקובץ';
var MAX_FEEDBACK_FILE_SIZE = 50 * 1024 * 1024;
var SIGNED_URL_EXPIRY_SECONDS = 3600;
var PREVIEW_LIMIT_SECONDS = 20; // מגבלת תצוגה מקדימה למי שלא מחוברת - זהה ל-SketchCard.jsx

function detectFileType(file) {
  if (file.type.indexOf('audio/') === 0) return 'sound';
  if (file.type.indexOf('video/') === 0) return 'video';
  return 'text';
}

function buildChildrenMap(list) {
  var map = {};
  list.forEach(function (fb) {
    var key = fb.parent_feedback_id ? fb.parent_feedback_id : 'root';
    if (!map[key]) {
      map[key] = [];
    }
    map[key].push(fb);
  });
  return map;
}

// --- קבלת קישור נגינה, בהתאם לספק האחסון של הרשומה ---
// רשומות ישנות (storage_provider='supabase', ברירת המחדל) ממשיכות לקבל
// Signed URL רגיל מ-Supabase Storage בדיוק כמו היום.
// רשומות חדשות (storage_provider='backblaze') עוברות דרך ה-Edge Function
// media-presigned-url, שבודקת הרשאות מול ה-DB (עם ה-JWT של המשתמשת עצמה,
// או ללא התחברות בכלל - RLS מחליטה בשני המקרים) לפני שהיא מנפיקה קישור.
function fetchPlaybackUrl(supabase, table, record) {
  if (record.storage_provider === 'backblaze') {
    return supabase.functions
      .invoke('media-presigned-url', {
        body: { action: 'download', table: table, recordId: record.id },
      })
      .then(function (result) {
        if (result.error || (result.data && result.data.error)) {
          console.error('שגיאה בקבלת קישור מ-Backblaze:', result.error ? result.error.message : result.data.error);
          return null;
        }
        return result.data.downloadUrl;
      })
      .catch(function (error) {
        console.error('שגיאה בקבלת קישור מ-Backblaze:', error.message);
        return null;
      });
  }

  return supabase.storage
    .from('sketch-files')
    .createSignedUrl(record.file_url, SIGNED_URL_EXPIRY_SECONDS)
    .then(function (signResult) {
      return signResult.data ? signResult.data.signedUrl : null;
    });
}

// --- העלאת קובץ מדיה חדש (מצורף לפידבק) ל-Backblaze B2 ---
// אותה זרימה בדיוק כמו ב-UploadSketchModal.jsx: מבקשות URL חתום, מעלות
// ישירות אליו, ומחזירות את מפתח הקובץ שנוצר בצד השרת.
function uploadMediaToBackblaze(supabase, file) {
  return supabase.functions
    .invoke('media-presigned-url', {
      body: {
        action: 'upload',
        fileName: file.name,
        contentType: file.type,
        declaredSizeBytes: file.size,
      },
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
    });
}

// --- תיקון תאימות קבצי WAV (זהה בעיקרון ל-UploadSketchModal.jsx, מוכפל
// בכוונה - אין קובץ utils משותף בפרויקט כרגע) ---
// חלק מתוכנות ה-DAW מייצאות WAV בקידודים פנימיים שחלק מהדפדפנים לא יודעים
// לנגן ישירות (במיוחד Firefox). מפענחות עם Web Audio API וכותבות מחדש
// כ-WAV קנוני (16-bit PCM) לפני ההעלאה. נכשל בשקט לקובץ המקורי אם צריך.

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
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
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

function isFileWav(file) {
  return !!(file && (file.type === 'audio/wav' || file.type === 'audio/x-wav'));
}

// --- הגנה על קבצים המצורפים לתגובות: אותו עיקרון "טקסט בלבד" שחל על הקטע הראשי ---

function arrayBufferToBase64(buffer) {
  var binary = '';
  var bytes = new Uint8Array(buffer);
  var len = bytes.byteLength;
  for (var i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function getExtractionFileTypeParam(file) {
  var lower = file.name.toLowerCase();
  if (file.type === 'application/pdf') return 'pdf';
  if (lower.indexOf('.doc') !== -1 || file.type === 'application/msword' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'word';
  return null;
}

function extractTextFromFile(supabase, file, onDone) {
  var extractionParam = getExtractionFileTypeParam(file);

  if (!extractionParam) {
    var plainReader = new FileReader();
    plainReader.onload = function () {
      onDone(String(plainReader.result || ''), null);
    };
    plainReader.onerror = function () {
      onDone(null, 'שגיאה בקריאת הקובץ');
    };
    plainReader.readAsText(file);
    return;
  }

  var reader = new FileReader();
  reader.onload = function () {
    var base64 = arrayBufferToBase64(reader.result);
    supabase.functions
      .invoke('extract-pdf-text', { body: { fileBase64: base64, fileType: extractionParam } })
      .then(function (result) {
        if (result.error || (result.data && result.data.error)) {
          var message = result.error ? result.error.message : result.data.error;
          onDone(null, message || 'שגיאה בחילוץ הטקסט');
          return;
        }
        onDone(result.data.text || '', null);
      })
      .catch(function (error) {
        onDone(null, error.message);
      });
  };
  reader.onerror = function () {
    onDone(null, 'שגיאה בקריאת הקובץ');
  };
  reader.readAsArrayBuffer(file);
}

function AttachedFilePreview(props) {
  var fileUrl = props.fileUrl;
  var fileType = props.fileType;
  var extractedText = props.extractedText;

  function handleOpen() {
    window.open(fileUrl, '_blank');
  }

  if (fileType === 'sound') {
    return (
      <audio controls className="w-full mt-2" src={fileUrl}>
        {soundFallbackText}
      </audio>
    );
  }
  if (fileType === 'video') {
    return (
      <video controls className="w-full rounded-lg mt-2" src={fileUrl}>
        {videoFallbackText}
      </video>
    );
  }
  if (fileType === 'text') {
    if (extractedText) {
      return (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap text-xs text-gray-300">
          {extractedText}
        </div>
      );
    }
    if (fileUrl) {
      return (
        <button
          type="button"
          onClick={handleOpen}
          className="block w-full text-center bg-gray-900 hover:bg-black border border-gray-700 p-2 rounded-lg text-xs mt-2"
        >
          קובץ מצורף - {textLinkLabel}
        </button>
      );
    }
    return null;
  }
  return null;
}

function FeedbackItem(props) {
  var fb = props.fb;
  var childrenMap = props.childrenMap;
  var depth = props.depth;
  var replyingToId = props.replyingToId;
  var setReplyingToId = props.setReplyingToId;
  var replyText = props.replyText;
  var setReplyText = props.setReplyText;
  var replyFile = props.replyFile;
  var replyDocName = props.replyDocName;
  var replyDocText = props.replyDocText;
  var setReplyDocText = props.setReplyDocText;
  var isExtractingReply = props.isExtractingReply;
  var isConvertingReplyWav = props.isConvertingReplyWav;
  var extractionErrorReply = props.extractionErrorReply;
  var onReplyFileSelected = props.onReplyFileSelected;
  var resetReplyAttachment = props.resetReplyAttachment;
  var onSubmitReply = props.onSubmitReply;
  var canReply = props.canReply;
  var isSubmitting = props.isSubmitting;
  var currentUserId = props.currentUserId;
  var editingId = props.editingId;
  var setEditingId = props.setEditingId;
  var editText = props.editText;
  var setEditText = props.setEditText;
  var onSubmitEdit = props.onSubmitEdit;
  var onDelete = props.onDelete;

  var children = childrenMap[fb.id] || [];
  var isReplyingHere = replyingToId === fb.id;
  var isEditingHere = editingId === fb.id;
  var isOwnComment = currentUserId && fb.author_user_id === currentUserId;
  var isReplyFileWav = isFileWav(replyFile);

  var wrapperStyle = { marginRight: (depth * 18) + 'px' };

  function handleToggleReply() {
    if (isReplyingHere) {
      setReplyingToId(null);
      resetReplyAttachment();
    } else {
      setReplyingToId(fb.id);
      setReplyText('');
      resetReplyAttachment();
      setEditingId(null);
    }
  }

  function handleToggleEdit() {
    if (isEditingHere) {
      setEditingId(null);
    } else {
      setEditingId(fb.id);
      setEditText(fb.content);
      setReplyingToId(null);
    }
  }

  function handleSendReply() {
    onSubmitReply(fb.id);
  }

  function handleSaveEdit() {
    onSubmitEdit(fb.id);
  }

  function handleReplyFileChange(e) {
    var selected = e.target.files[0];
    if (!selected) return;
    if (selected.size > MAX_FEEDBACK_FILE_SIZE) {
      alert('הקובץ גדול מדי - המגבלה היא 50MB.');
      e.target.value = '';
      return;
    }
    onReplyFileSelected(selected);
  }

  function handleDeleteClick() {
    var hasChildren = children.length > 0;
    var message = hasChildren
      ? 'למחוק את התגובה הזו ואת כל התגובות שהגיבו לה?'
      : 'למחוק את התגובה הזו?';
    var confirmed = window.confirm(message);
    if (confirmed) {
      onDelete(fb.id);
    }
  }

  return (
    <div style={wrapperStyle} className="mt-3">
      <div className="bg-gray-800 rounded-lg p-3">
        <p className="text-xs font-bold text-gray-300 mb-1">{fb.author_username}</p>

        {isEditingHere ? (
          <div className="flex flex-col gap-2 mb-2">
            <textarea
              value={editText}
              onChange={function (e) { setEditText(e.target.value); }}
              rows={2}
              className="w-full bg-gray-900 border border-gray-700 p-2.5 rounded-lg focus:border-green-500 outline-none text-sm resize-none"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isSubmitting}
                className="bg-green-600 hover:bg-green-700 px-4 py-1.5 rounded-lg font-bold text-xs transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'שומר...' : 'שמירה'}
              </button>
              <button
                type="button"
                onClick={handleToggleEdit}
                className="bg-gray-700 hover:bg-gray-600 px-4 py-1.5 rounded-lg font-bold text-xs transition-colors"
              >
                ביטול
              </button>
            </div>
          </div>
        ) : (
          <React.Fragment>
            <p className="text-sm text-gray-200 mb-2">{fb.content}</p>
            {fb.file_url || fb.extracted_text ? (
              <AttachedFilePreview
                fileUrl={fb.resolved_file_url || fb.file_url}
                fileType={fb.file_type}
                extractedText={fb.extracted_text}
              />
            ) : null}
          </React.Fragment>
        )}

        {!isEditingHere ? (
          <div className="flex gap-3 mt-2">
            {canReply ? (
              <button
                type="button"
                onClick={handleToggleReply}
                className="text-xs text-green-400 hover:text-green-300"
              >
                {isReplyingHere ? 'ביטול' : 'הגיבי'}
              </button>
            ) : null}
            {isOwnComment ? (
              <button
                type="button"
                onClick={handleToggleEdit}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                עריכה
              </button>
            ) : null}
            {isOwnComment ? (
              <button
                type="button"
                onClick={handleDeleteClick}
                className="text-xs text-red-400 hover:text-red-300"
              >
                מחיקה
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {isReplyingHere ? (
        <div className="mt-2 flex flex-col gap-2" style={{ marginRight: '14px' }}>
          <textarea
            value={replyText}
            onChange={function (e) { setReplyText(e.target.value); }}
            placeholder="כתבי תגובה..."
            rows={2}
            className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-lg focus:border-green-500 outline-none text-sm resize-none"
          />
          <input
            type="file"
            onChange={handleReplyFileChange}
            className="text-xs text-gray-400 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:bg-gray-700 file:text-white file:text-xs"
          />
          {isConvertingReplyWav ? (
            <p className="text-[11px] text-gray-500">מתקנת את פורמט קובץ ה-WAV לתאימות מלאה עם דפדפנים...</p>
          ) : null}
          {isReplyFileWav && !isConvertingReplyWav && !isSubmitting ? (
            <p className="text-[11px] text-gray-500">
              קובץ WAV ({formatFileSizeMb(replyFile.size)}MB) - ההעלאה עשויה לקחת כמה דקות.
            </p>
          ) : null}
          {isReplyFileWav && isSubmitting ? (
            <p className="text-[11px] text-amber-400">
              מעלה קובץ WAV ({formatFileSizeMb(replyFile.size)}MB) - זה עשוי לקחת כמה דקות, זה תקין.
            </p>
          ) : null}
          {replyDocName ? (
            <div className="flex flex-col gap-1">
              <p className="text-[11px] text-gray-500">
                מסמך: {replyDocName} - הקובץ המקורי לא יישמר, רק הטקסט שחולץ ממנו.
              </p>
              {isExtractingReply ? (
                <p className="text-[11px] text-gray-500">מחלצת טקסט...</p>
              ) : null}
              {extractionErrorReply ? (
                <p className="text-[11px] text-red-400">{extractionErrorReply}</p>
              ) : null}
              {!isExtractingReply ? (
                <textarea
                  value={replyDocText}
                  onChange={function (e) { setReplyDocText(e.target.value); }}
                  rows={3}
                  placeholder="אפשר לערוך את הטקסט שחולץ"
                  className="w-full bg-gray-900 border border-gray-700 p-2 rounded-lg focus:border-green-500 outline-none text-xs resize-none"
                />
              ) : null}
            </div>
          ) : null}
          <button
            type="button"
            onClick={handleSendReply}
            disabled={isSubmitting || isExtractingReply || isConvertingReplyWav}
            className="bg-green-600 hover:bg-green-700 p-2 rounded-lg font-bold text-xs transition-colors disabled:opacity-50 self-start px-4"
          >
            {isSubmitting ? 'שולח...' : isConvertingReplyWav ? 'מתקנת פורמט...' : 'שליחת תגובה'}
          </button>
        </div>
      ) : null}

      {children.map(function (child) {
        return (
          <FeedbackItem
            key={child.id}
            fb={child}
            childrenMap={childrenMap}
            depth={depth + 1}
            replyingToId={replyingToId}
            setReplyingToId={setReplyingToId}
            replyText={replyText}
            setReplyText={setReplyText}
            replyFile={replyFile}
            replyDocName={replyDocName}
            replyDocText={replyDocText}
            setReplyDocText={setReplyDocText}
            isExtractingReply={isExtractingReply}
            isConvertingReplyWav={isConvertingReplyWav}
            extractionErrorReply={extractionErrorReply}
            onReplyFileSelected={onReplyFileSelected}
            resetReplyAttachment={resetReplyAttachment}
            onSubmitReply={onSubmitReply}
            canReply={canReply}
            isSubmitting={isSubmitting}
            currentUserId={currentUserId}
            editingId={editingId}
            setEditingId={setEditingId}
            editText={editText}
            setEditText={setEditText}
            onSubmitEdit={onSubmitEdit}
            onDelete={onDelete}
          />
        );
      })}
    </div>
  );
}

export default function SketchDetailModal(props) {
  var isOpen = props.isOpen;
  var sketch = props.sketch;
  var onClose = props.onClose;
  var session = props.session;
  var profile = props.profile;
  var onStatusChange = props.onStatusChange;
  var onOpenDirectMessage = props.onOpenDirectMessage;
  var onOpenProfile = props.onOpenProfile;
  var onOpenAuth = props.onOpenAuth;

  var supabase = useContext(SupabaseContext);

  var feedbackListState = useState([]);
  var feedbackList = feedbackListState[0];
  var setFeedbackList = feedbackListState[1];

  // הקישור החי (Signed URL/Presigned URL, תקף לשעה) לקובץ המדיה הראשי של הקטע עצמו.
  // sketch.file_url מכיל רק את הנתיב/מפתח הגולמי ב-Storage, לא URL ציבורי.
  var sketchSignedUrlState = useState('');
  var sketchSignedUrl = sketchSignedUrlState[0];
  var setSketchSignedUrl = sketchSignedUrlState[1];

  var newFeedbackState = useState('');
  var newFeedback = newFeedbackState[0];
  var setNewFeedback = newFeedbackState[1];

  // מדיה (סאונד/וידאו) מצורפת לפידבק ראשי - נשמרת כקובץ כרגיל
  var newFeedbackFileState = useState(null);
  var newFeedbackFile = newFeedbackFileState[0];
  var setNewFeedbackFile = newFeedbackFileState[1];

  // מסמך (PDF/Word/טקסט) מצורף לפידבק ראשי - נשמר כטקסט בלבד, לא כקובץ
  var newFeedbackDocNameState = useState('');
  var newFeedbackDocName = newFeedbackDocNameState[0];
  var setNewFeedbackDocName = newFeedbackDocNameState[1];

  var newFeedbackDocTextState = useState('');
  var newFeedbackDocText = newFeedbackDocTextState[0];
  var setNewFeedbackDocText = newFeedbackDocTextState[1];

  var isExtractingNewState = useState(false);
  var isExtractingNew = isExtractingNewState[0];
  var setIsExtractingNew = isExtractingNewState[1];

  var extractionErrorNewState = useState('');
  var extractionErrorNew = extractionErrorNewState[0];
  var setExtractionErrorNew = extractionErrorNewState[1];

  // המרת WAV - דגל נפרד לפידבק הראשי, ודגל נפרד לתגובות (יכולות לקרות בנפרד)
  var isConvertingNewFeedbackWavState = useState(false);
  var isConvertingNewFeedbackWav = isConvertingNewFeedbackWavState[0];
  var setIsConvertingNewFeedbackWav = isConvertingNewFeedbackWavState[1];

  var isConvertingReplyWavState = useState(false);
  var isConvertingReplyWav = isConvertingReplyWavState[0];
  var setIsConvertingReplyWav = isConvertingReplyWavState[1];

  var replyingToIdState = useState(null);
  var replyingToId = replyingToIdState[0];
  var setReplyingToId = replyingToIdState[1];

  var replyTextState = useState('');
  var replyText = replyTextState[0];
  var setReplyText = replyTextState[1];

  var replyFileState = useState(null);
  var replyFile = replyFileState[0];
  var setReplyFile = replyFileState[1];

  var replyDocNameState = useState('');
  var replyDocName = replyDocNameState[0];
  var setReplyDocName = replyDocNameState[1];

  var replyDocTextState = useState('');
  var replyDocText = replyDocTextState[0];
  var setReplyDocText = replyDocTextState[1];

  var isExtractingReplyState = useState(false);
  var isExtractingReply = isExtractingReplyState[0];
  var setIsExtractingReply = isExtractingReplyState[1];

  var extractionErrorReplyState = useState('');
  var extractionErrorReply = extractionErrorReplyState[0];
  var setExtractionErrorReply = extractionErrorReplyState[1];

  var editingIdState = useState(null);
  var editingId = editingIdState[0];
  var setEditingId = editingIdState[1];

  var editTextState = useState('');
  var editText = editTextState[0];
  var setEditText = editTextState[1];

  var isSubmittingState = useState(false);
  var isSubmitting = isSubmittingState[0];
  var setIsSubmitting = isSubmittingState[1];

  var isChangingStatusState = useState(false);
  var isChangingStatus = isChangingStatusState[0];
  var setIsChangingStatus = isChangingStatusState[1];

  function loadFeedback() {
    if (!sketch) return;

    supabase
      .from('SketchFeedback')
      .select('*')
      .eq('sketch_id', sketch.id)
      .order('created_at', { ascending: true })
      .then(function (result) {
        if (!result.data) return;

        var items = result.data;
        var withMedia = items.filter(function (fb) { return !!fb.file_url; });

        if (withMedia.length === 0) {
          setFeedbackList(items);
          return;
        }

        // מפנות כל קובץ מצורף לזרימת ה-URL הנכונה, לפי storage_provider של אותה רשומה
        Promise.all(
          withMedia.map(function (fb) {
            return fetchPlaybackUrl(supabase, 'SketchFeedback', fb).then(function (url) {
              return { id: fb.id, signedUrl: url };
            });
          })
        ).then(function (signedResults) {
          var signedMap = {};
          signedResults.forEach(function (r) { signedMap[r.id] = r.signedUrl; });

          var withSigned = items.map(function (fb) {
            if (signedMap[fb.id]) {
              var copy = Object.assign({}, fb);
              copy.resolved_file_url = signedMap[fb.id];
              return copy;
            }
            return fb;
          });

          setFeedbackList(withSigned);
        });
      });
  }

  useEffect(function () {
    if (!isOpen || !sketch) {
      setFeedbackList([]);
      return;
    }
    loadFeedback();
  }, [isOpen, sketch]);

  // יוצרות קישור נגינה לקובץ המדיה הראשי של הקטע בכל פתיחה
  useEffect(function () {
    if (!isOpen || !sketch || !sketch.file_url) {
      setSketchSignedUrl('');
      return;
    }
    if (sketch.file_type === 'text' && sketch.extracted_text) {
      setSketchSignedUrl('');
      return;
    }

    fetchPlaybackUrl(supabase, 'Sketch', sketch).then(function (url) {
      if (url) {
        setSketchSignedUrl(url);
      }
    });
  }, [isOpen, sketch]);

  if (!isOpen || !sketch) {
    return null;
  }

  var subtitle = 'הועלה על ידי ' + sketch.uploader_username;
  if (sketch.genre) {
    subtitle = subtitle + ' - ' + sketch.genre;
  }

  var canMessageUploader = !!(session && sketch.uploader_user_id !== (session ? session.user.id : null));

  function handleUploaderClick() {
    if (onOpenProfile) {
      onOpenProfile(sketch.uploader_user_id);
    }
  }

  function handleOpenFile() {
    window.open(sketchSignedUrl, '_blank');
  }

  // תצוגה מקדימה בלבד למי שלא מחוברת - עוצרות את הניגון הראשי (סאונד/וידאו)
  // אחרי 20 שניות ופותחות את מסך ההתחברות עם קוד סיבה 'preview', כדי שיוצג
  // הסבר להקשר בתוך AuthModal. חלה רק על הקטע הראשי, לא על קבצים מצורפים
  // לפידבקים - אלה יטופלו בהמשך אם יידרש.
  function handleMainMediaTimeUpdate(e) {
    if (session) return;
    var mediaEl = e.target;
    if (mediaEl.currentTime >= PREVIEW_LIMIT_SECONDS) {
      mediaEl.pause();
      mediaEl.currentTime = 0;
      if (onOpenAuth) {
        onOpenAuth('preview');
      } else {
        alert('זו תצוגה מקדימה של 20 שניות. כדי לצפות/להאזין לקטע במלואו, צריך להתחבר או להירשם.');
      }
    }
  }

  function resetNewFeedbackAttachment() {
    setNewFeedbackFile(null);
    setNewFeedbackDocName('');
    setNewFeedbackDocText('');
    setExtractionErrorNew('');
    setIsExtractingNew(false);
    setIsConvertingNewFeedbackWav(false);
  }

  function resetReplyAttachment() {
    setReplyFile(null);
    setReplyDocName('');
    setReplyDocText('');
    setExtractionErrorReply('');
    setIsExtractingReply(false);
    setIsConvertingReplyWav(false);
  }

  function handleNewFeedbackFileChange(e) {
    var selected = e.target.files[0];
    if (!selected) return;
    if (selected.size > MAX_FEEDBACK_FILE_SIZE) {
      alert('הקובץ גדול מדי - המגבלה היא 50MB.');
      e.target.value = '';
      return;
    }

    var kind = detectFileType(selected);
    if (kind === 'text') {
      setNewFeedbackFile(null);
      setNewFeedbackDocName(selected.name);
      setNewFeedbackDocText('');
      setExtractionErrorNew('');
      setIsExtractingNew(true);
      extractTextFromFile(supabase, selected, function (text, error) {
        setIsExtractingNew(false);
        if (error) {
          setExtractionErrorNew('לא הצלחנו לחלץ טקסט אוטומטית מהקובץ. אפשר להדביק את הטקסט ידנית.');
          return;
        }
        setNewFeedbackDocText(text);
      });
      return;
    }

    setNewFeedbackDocName('');
    setNewFeedbackDocText('');
    setExtractionErrorNew('');

    if (kind === 'sound' && isWavFile(selected)) {
      setNewFeedbackFile(selected);
      setIsConvertingNewFeedbackWav(true);
      reencodeWavFile(selected).then(function (finalFile) {
        setIsConvertingNewFeedbackWav(false);
        setNewFeedbackFile(finalFile);
      });
      return;
    }

    setNewFeedbackFile(selected);
  }

  function handleReplyFileSelected(selected) {
    var kind = detectFileType(selected);
    if (kind === 'text') {
      setReplyFile(null);
      setReplyDocName(selected.name);
      setReplyDocText('');
      setExtractionErrorReply('');
      setIsExtractingReply(true);
      extractTextFromFile(supabase, selected, function (text, error) {
        setIsExtractingReply(false);
        if (error) {
          setExtractionErrorReply('לא הצלחנו לחלץ טקסט אוטומטית מהקובץ. אפשר להדביק את הטקסט ידנית.');
          return;
        }
        setReplyDocText(text);
      });
      return;
    }

    setReplyDocName('');
    setReplyDocText('');
    setExtractionErrorReply('');

    if (kind === 'sound' && isWavFile(selected)) {
      setReplyFile(selected);
      setIsConvertingReplyWav(true);
      reencodeWavFile(selected).then(function (finalFile) {
        setIsConvertingReplyWav(false);
        setReplyFile(finalFile);
      });
      return;
    }

    setReplyFile(selected);
  }

  function maybeAutoAdvanceStatus(feedbackAuthorId) {
    var isFeedbackFromOwner = feedbackAuthorId === sketch.uploader_user_id;

    if (sketch.status === 'דרוש פידבק' && !isFeedbackFromOwner) {
      supabase
        .from('Sketch')
        .update({ status: 'בעבודה' })
        .eq('id', sketch.id)
        .select()
        .single()
        .then(function (result) {
          if (!result.error && result.data && onStatusChange) {
            onStatusChange(result.data);
          }
        });
    }
  }

  function insertFeedback(content, parentId, attachedFile, docName, docText) {
    var hasMedia = !!attachedFile;
    var hasDoc = !!docName;

    if (!content && !hasMedia && !hasDoc) {
      alert('נא לכתוב טקסט או לצרף קובץ לפני השליחה');
      return;
    }
    if (!session || !profile) {
      alert('צריך להתחבר כדי להשאיר פידבק');
      return;
    }

    setIsSubmitting(true);

    function finishInsert(fileUrl, fileType, extractedTextValue, storageProvider) {
      var row = {
        sketch_id: sketch.id,
        author_username: profile.display_name,
        author_user_id: session.user.id,
        content: content || '',
        parent_feedback_id: parentId || null,
        file_url: fileUrl || null,
        file_type: fileType || null,
        extracted_text: extractedTextValue || null,
      };

      if (storageProvider) {
        row.storage_provider = storageProvider;
      }

      supabase
        .from('SketchFeedback')
        .insert([row])
        .select()
        .single()
        .then(function (result) {
          setIsSubmitting(false);
          if (result.error) {
            console.error('שגיאה בשליחת הפידבק:', result.error.message);
            alert('קרתה שגיאה בשליחת הפידבק');
            return;
          }

          function addToList(itemToAdd) {
            setFeedbackList(function (prev) {
              return prev.concat([itemToAdd]);
            });

            if (parentId) {
              setReplyText('');
              resetReplyAttachment();
              setReplyingToId(null);
            } else {
              setNewFeedback('');
              resetNewFeedbackAttachment();
            }

            maybeAutoAdvanceStatus(session.user.id);
          }

          var isMediaAttachment = result.data.file_url && (result.data.file_type === 'sound' || result.data.file_type === 'video');

          if (isMediaAttachment) {
            // יוצרות קישור נגינה מיידי כדי שהתגובה שהוזנה הרגע תהיה מיד ניתנת לניגון
            fetchPlaybackUrl(supabase, 'SketchFeedback', result.data).then(function (url) {
              var itemWithSigned = Object.assign({}, result.data);
              if (url) {
                itemWithSigned.resolved_file_url = url;
              }
              addToList(itemWithSigned);
            });
          } else {
            addToList(result.data);
          }
        });
    }

    if (hasMedia) {
      uploadMediaToBackblaze(supabase, attachedFile)
        .then(function (objectKey) {
          finishInsert(objectKey, detectFileType(attachedFile), null, 'backblaze');
        })
        .catch(function (error) {
          setIsSubmitting(false);
          console.error('שגיאה בהעלאת הקובץ:', error.message);
          alert('קרתה שגיאה בהעלאת הקובץ המצורף: ' + error.message);
        });
    } else if (hasDoc) {
      finishInsert(null, 'text', docText || '', null);
    } else {
      finishInsert(null, null, null, null);
    }
  }

  function handleSubmitTopLevel() {
    if (isConvertingNewFeedbackWav) {
      alert('עדיין מתקנת את פורמט הקובץ - רגע בבקשה');
      return;
    }
    insertFeedback(newFeedback, null, newFeedbackFile, newFeedbackDocName, newFeedbackDocText);
  }

  function handleSubmitReply(parentId) {
    if (isConvertingReplyWav) {
      alert('עדיין מתקנת את פורמט הקובץ - רגע בבקשה');
      return;
    }
    insertFeedback(replyText, parentId, replyFile, replyDocName, replyDocText);
  }

  function handleSubmitEdit(feedbackId) {
    if (!editText) {
      alert('נא לכתוב טקסט');
      return;
    }

    setIsSubmitting(true);

    supabase
      .from('SketchFeedback')
      .update({ content: editText })
      .eq('id', feedbackId)
      .select()
      .single()
      .then(function (result) {
        setIsSubmitting(false);
        if (result.error) {
          console.error('שגיאה בעריכת הפידבק:', result.error.message);
          alert('קרתה שגיאה בעריכת הפידבק');
          return;
        }
        setFeedbackList(function (prev) {
          return prev.map(function (fb) {
            if (fb.id === feedbackId) {
              var updated = Object.assign({}, result.data);
              // שומרות את הקישור שכבר נוצר לפריט הזה (העדכון מה-DB לא מחזיר אותו)
              if (fb.resolved_file_url) {
                updated.resolved_file_url = fb.resolved_file_url;
              }
              return updated;
            }
            return fb;
          });
        });
        setEditingId(null);
        setEditText('');
      });
  }

  function handleDeleteFeedback(feedbackId) {
    supabase
      .from('SketchFeedback')
      .delete()
      .eq('id', feedbackId)
      .then(function (result) {
        if (result.error) {
          console.error('שגיאה במחיקת הפידבק:', result.error.message);
          alert('קרתה שגיאה במחיקת הפידבק');
          return;
        }
        loadFeedback();
      });
  }

  function handleStatusSelectChange(e) {
    var newStatus = e.target.value;
    if (newStatus === sketch.status) return;

    setIsChangingStatus(true);

    supabase
      .from('Sketch')
      .update({ status: newStatus })
      .eq('id', sketch.id)
      .select()
      .single()
      .then(function (result) {
        setIsChangingStatus(false);
        if (result.error) {
          console.error('שגיאה בעדכון הסיווג:', result.error.message);
          alert('קרתה שגיאה בעדכון הסיווג');
          return;
        }
        if (onStatusChange) {
          onStatusChange(result.data);
        }
      });
  }

  var childrenMap = buildChildrenMap(feedbackList);
  var topLevelFeedback = childrenMap['root'] || [];
  var canReply = !!(session && profile);
  var currentUserId = session ? session.user.id : null;
  var isSketchOwner = currentUserId && sketch.uploader_user_id === currentUserId;
  var showStatusControls = isSketchOwner;
  var isNewFeedbackFileWav = isFileWav(newFeedbackFile);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 p-6 rounded-2xl w-full max-w-lg text-white shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={function (e) { e.stopPropagation(); }}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold">{sketch.title}</h2>
            <p className="text-sm text-gray-400">
              הועלה על ידי{' '}
              {canMessageUploader ? (
                <button
                  type="button"
                  onClick={handleUploaderClick}
                  className="text-gray-300 hover:text-green-400 underline underline-offset-2 transition-colors"
                >
                  {sketch.uploader_username}
                </button>
              ) : (
                <span>{sketch.uploader_username}</span>
              )}
              {sketch.genre ? ' - ' + sketch.genre : ''}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">X</button>
        </div>

        <div className="mb-4">
          {sketch.file_type === 'sound' ? (
            <audio controls className="w-full" src={sketchSignedUrl} onTimeUpdate={handleMainMediaTimeUpdate}>
              {soundFallbackText}
            </audio>
          ) : null}

          {sketch.file_type === 'video' ? (
            <video controls className="w-full rounded-lg" src={sketchSignedUrl} onTimeUpdate={handleMainMediaTimeUpdate}>
              {videoFallbackText}
            </video>
          ) : null}

          {!session && (sketch.file_type === 'sound' || sketch.file_type === 'video') ? (
            <p className="text-[11px] text-gray-500 mt-1.5">
              תצוגה מקדימה של 20 שניות - להאזנה/צפייה מלאה צריך להתחבר או להירשם.
            </p>
          ) : null}

          {sketch.file_type === 'text' ? (
            sketch.extracted_text ? (
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 max-h-64 overflow-y-auto whitespace-pre-wrap text-sm text-gray-200">
                {sketch.extracted_text}
              </div>
            ) : sketch.file_url ? (
              <button
                type="button"
                onClick={handleOpenFile}
                className="block w-full text-center bg-gray-800 hover:bg-gray-700 border border-gray-700 p-4 rounded-lg text-sm"
              >
                {textLinkLabel}
              </button>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">אין תוכן טקסט זמין</p>
            )
          ) : null}
        </div>

        <div className="flex items-center gap-2 mb-5 flex-wrap">
          {!isSketchOwner && session ? (
            <button
              type="button"
              onClick={function () {
                if (onOpenDirectMessage) {
                  onOpenDirectMessage(sketch.uploader_user_id, sketch.uploader_username);
                }
              }}
              title="שלח הודעה ליוצר"
              className="flex items-center justify-center h-8 w-8 rounded-full bg-gray-800 border border-gray-700 hover:bg-green-700 hover:border-green-600 transition-colors text-sm"
            >
              ✉️
            </button>
          ) : null}
          {showStatusControls ? (
            <select
              value={sketch.status}
              onChange={handleStatusSelectChange}
              disabled={isChangingStatus}
              className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-800 border border-gray-700 outline-none disabled:opacity-50"
            >
              <option value="דרוש פידבק">דרוש פידבק</option>
              <option value="בעבודה">בעבודה</option>
              <option value="פוצח בהצלחה">פוצח בהצלחה</option>
            </select>
          ) : (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-800 inline-block">
              {sketch.status}
            </span>
          )}
        </div>

        <div className="border-t border-gray-800 pt-4">
          <h3 className="text-sm font-bold mb-3">דיון ({feedbackList.length})</h3>

          <div className="flex flex-col gap-1 mb-4">
            {topLevelFeedback.map(function (fb) {
              return (
                <FeedbackItem
                  key={fb.id}
                  fb={fb}
                  childrenMap={childrenMap}
                  depth={0}
                  replyingToId={replyingToId}
                  setReplyingToId={setReplyingToId}
                  replyText={replyText}
                  setReplyText={setReplyText}
                  replyFile={replyFile}
                  replyDocName={replyDocName}
                  replyDocText={replyDocText}
                  setReplyDocText={setReplyDocText}
                  isExtractingReply={isExtractingReply}
                  isConvertingReplyWav={isConvertingReplyWav}
                  extractionErrorReply={extractionErrorReply}
                  onReplyFileSelected={handleReplyFileSelected}
                  resetReplyAttachment={resetReplyAttachment}
                  onSubmitReply={handleSubmitReply}
                  canReply={canReply}
                  isSubmitting={isSubmitting}
                  currentUserId={currentUserId}
                  editingId={editingId}
                  setEditingId={setEditingId}
                  editText={editText}
                  setEditText={setEditText}
                  onSubmitEdit={handleSubmitEdit}
                  onDelete={handleDeleteFeedback}
                />
              );
            })}

            {topLevelFeedback.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-2">עדיין אין פידבקים - תהיי הראשונה!</p>
            ) : null}
          </div>

          {canReply ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={newFeedback}
                onChange={function (e) { setNewFeedback(e.target.value); }}
                placeholder="כתבי פידבק על הקטע..."
                rows={3}
                className="w-full bg-gray-800 border border-gray-700 p-3 rounded-lg focus:border-green-500 outline-none text-sm resize-none"
              />
              <input
                type="file"
                onChange={handleNewFeedbackFileChange}
                className="text-xs text-gray-400 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:bg-gray-700 file:text-white file:text-xs"
              />
              {isConvertingNewFeedbackWav ? (
                <p className="text-xs text-gray-500">מתקנת את פורמט קובץ ה-WAV לתאימות מלאה עם דפדפנים...</p>
              ) : null}
              {isNewFeedbackFileWav && !isConvertingNewFeedbackWav && !isSubmitting ? (
                <p className="text-xs text-gray-500">
                  קובץ WAV ({formatFileSizeMb(newFeedbackFile.size)}MB) - ההעלאה עשויה לקחת כמה דקות.
                </p>
              ) : null}
              {isNewFeedbackFileWav && isSubmitting ? (
                <p className="text-xs text-amber-400">
                  מעלה קובץ WAV ({formatFileSizeMb(newFeedbackFile.size)}MB) - זה עשוי לקחת כמה דקות, זה תקין.
                </p>
              ) : null}
              {newFeedbackDocName ? (
                <div className="flex flex-col gap-1">
                  <p className="text-xs text-gray-500">
                    מסמך: {newFeedbackDocName} - הקובץ המקורי לא יישמר, רק הטקסט שחולץ ממנו.
                  </p>
                  {isExtractingNew ? (
                    <p className="text-xs text-gray-500">מחלצת טקסט...</p>
                  ) : null}
                  {extractionErrorNew ? (
                    <p className="text-xs text-red-400">{extractionErrorNew}</p>
                  ) : null}
                  {!isExtractingNew ? (
                    <textarea
                      value={newFeedbackDocText}
                      onChange={function (e) { setNewFeedbackDocText(e.target.value); }}
                      rows={4}
                      placeholder="אפשר לערוך את הטקסט שחולץ, או להדביק טקסט ידנית"
                      className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-lg focus:border-green-500 outline-none text-sm resize-none"
                    />
                  ) : null}
                </div>
              ) : null}
              <button
                type="button"
                onClick={handleSubmitTopLevel}
                disabled={isSubmitting || isExtractingNew || isConvertingNewFeedbackWav}
                className="bg-green-600 hover:bg-green-700 p-2.5 rounded-lg font-bold text-sm transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'שולח...' : isConvertingNewFeedbackWav ? 'מתקנת פורמט...' : 'שליחת פידבק'}
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-2">צריך להתחבר כדי להשאיר פידבק</p>
          )}
        </div>
      </div>
    </div>
  );
}