import React, { useState, useContext, useRef, useEffect } from 'react';
import { SupabaseContext } from '../main';
import VisibilityTagModal from './VisibilityTagModal';

var fileTypeIcons = { sound: '🎵', video: '🎬', text: '📄' };
var SIGNED_URL_EXPIRY_SECONDS = 3600; // זהה לקבוע ב-SketchDetailModal.jsx

// פלטת צבעים לאווטאר - נבחר לפי שם המשתמש/ת בצורה קבועה (אותו שם = אותו צבע תמיד)
var AVATAR_PALETTE = ['bg-primary', 'bg-amber-500', 'bg-sky-500', 'bg-emerald-500', 'bg-pink-500', 'bg-violet-500'];

function getAvatarColor(name) {
  var str = name || '?';
  var hash = 0;
  for (var i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

// צבע נקודת הסטטוס - לפי מילות מפתח בטקסט הסטטוס הקיים (לא רשימה סגורה, ברירת מחדל אפורה)
function getStatusColor(status) {
  if (!status) return 'bg-muted-foreground';
  if (status.indexOf('הצלחה') !== -1 || status.indexOf('פוצח') !== -1 || status.indexOf('פורסם') !== -1) return 'bg-emerald-400';
  if (status.indexOf('עבודה') !== -1) return 'bg-amber-400';
  if (status.indexOf('פידבק') !== -1) return 'bg-violet-400';
  return 'bg-muted-foreground';
}

// גובהי פסי waveform דקורטיביים - פסבדו-רנדומליים אבל קבועים לפי מזהה הסקיצה
// (כך שהם לא "יקפצו" בכל רינדור מחדש, אבל גם לא זהים בין כרטיסים)
var WAVEFORM_BAR_COUNT = 40;

function getWaveformBars(seed) {
  var str = String(seed || '0');
  var bars = [];
  var value = 0;
  for (var i = 0; i < str.length; i++) {
    value = str.charCodeAt(i) + ((value << 3) - value);
  }
  for (var j = 0; j < WAVEFORM_BAR_COUNT; j++) {
    value = (value * 1103515245 + 12345) & 0x7fffffff;
    bars.push(20 + (value % 100) * 0.7);
  }
  return bars;
}

function IconMusic(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

function IconPlay(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={props.className}>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function IconPause(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={props.className}>
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

function IconLoader(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={props.className + ' animate-spin'}>
      <path d="M21 12a9 9 0 1 1-6.2-8.6" />
    </svg>
  );
}

function IconShare(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" />
      <line x1="15.4" y1="6.5" x2="8.6" y2="10.5" />
    </svg>
  );
}

function IconMessage(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function IconHeart(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
    </svg>
  );
}

export default function SketchCard(props) {
  var sketch = props.sketch;
  var onOpenModal = props.onOpenModal;
  var onDelete = props.onDelete;
  var session = props.session;

  var supabase = useContext(SupabaseContext);
  var audioRef = useRef(null);
  var pendingPlayRef = useRef(false); // true אם צריך לנגן ברגע שה-URL יגיע

  var isOwner = session && sketch.uploader_user_id === session.user.id;
  var isPrivate = sketch.is_public === false;
  var isSound = (sketch.file_type || 'sound') === 'sound';
  var avatarColor = getAvatarColor(sketch.uploader_username);
  var avatarInitial = (sketch.uploader_username || '?').trim().charAt(0);
  var waveformBars = isSound ? getWaveformBars(sketch.id) : [];

  var signedUrlState = useState('');
  var signedUrl = signedUrlState[0];
  var setSignedUrl = signedUrlState[1];

  var isLoadingAudioState = useState(false);
  var isLoadingAudio = isLoadingAudioState[0];
  var setIsLoadingAudio = isLoadingAudioState[1];

  var isPlayingState = useState(false);
  var isPlaying = isPlayingState[0];
  var setIsPlaying = isPlayingState[1];

  var progressState = useState(0); // 0-1
  var progress = progressState[0];
  var setProgress = progressState[1];

  var isTagModalOpenState = useState(false);
  var isTagModalOpen = isTagModalOpenState[0];
  var setIsTagModalOpen = isTagModalOpenState[1];

  // ברגע שה-URL החתום מגיע, אם הייתה בקשת ניגון ממתינה - מנגנות מיד
  useEffect(function () {
    if (signedUrl && pendingPlayRef.current && audioRef.current) {
      pendingPlayRef.current = false;
      audioRef.current.play();
    }
  }, [signedUrl]);

  function handlePlayClick(e) {
    e.stopPropagation();
    if (!isSound || !sketch.file_url) return;

    if (isPlaying) {
      audioRef.current.pause();
      return;
    }

    if (signedUrl) {
      audioRef.current.play();
      return;
    }

    pendingPlayRef.current = true;
    setIsLoadingAudio(true);
    supabase.storage
      .from('sketch-files')
      .createSignedUrl(sketch.file_url, SIGNED_URL_EXPIRY_SECONDS)
      .then(function (result) {
        setIsLoadingAudio(false);
        if (result.data) {
          setSignedUrl(result.data.signedUrl);
        } else {
          pendingPlayRef.current = false;
        }
      });
  }

  function handleTimeUpdate() {
    var audio = audioRef.current;
    if (audio && audio.duration) {
      setProgress(audio.currentTime / audio.duration);
    }
  }

  function handleEnded() {
    setIsPlaying(false);
    setProgress(0);
  }

  function handleDeleteClick(e) {
    e.stopPropagation();
    var confirmed = window.confirm('האם למחוק את הקטע ' + sketch.title + '?');
    if (confirmed && onDelete) {
      onDelete(sketch);
    }
  }

  function stopPropagation(e) {
    e.stopPropagation();
  }

  function handleOpenTagModal(e) {
    e.stopPropagation();
    setIsTagModalOpen(true);
  }

  return (
    <div
      onClick={function () { onOpenModal(sketch); }}
      className="rounded-2xl border border-border bg-card p-3.5 hover:border-primary/30 transition-all cursor-pointer relative"
    >
      {/* שורה 1: נקודת סטטוס + תגיות (מחיקה / פרטי / תיוג / ז'אנר) - הכל בשורה אחת, בלי absolute, כדי שלא יחפפו */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className={'w-2 h-2 rounded-full ' + getStatusColor(sketch.status)}></span>
          <span className="text-xs text-muted-foreground">{sketch.status}</span>
        </div>

        <div className="flex items-center gap-1.5">
          {isOwner ? (
            <button
              type="button"
              onClick={handleDeleteClick}
              title="מחק קטע"
              className="text-xs bg-red-600/80 hover:bg-red-600 text-white px-1.5 py-0.5 rounded-full"
            >
              🗑️
            </button>
          ) : null}
          {isPrivate ? (
            <span
              title="קטע פרטי - נראה רק לך"
              className="text-[10px] font-medium bg-yellow-700/70 text-white px-2 py-0.5 rounded-full"
            >
              🔒 פרטי
            </span>
          ) : null}
          {isOwner ? (
            <button
              type="button"
              onClick={handleOpenTagModal}
              title="תיוג / מי רואה את זה?"
              className="text-[10px] font-medium bg-white/5 border border-white/10 hover:bg-white/10 text-foreground/80 px-2 py-0.5 rounded-full transition-colors"
            >
              תיוג
            </button>
          ) : null}
          {sketch.genre ? (
            <span className="text-xs text-foreground/70 bg-white/5 border border-white/10 px-2.5 py-0.5 rounded-full">
              {sketch.genre}
            </span>
          ) : null}
        </div>
      </div>

      {/* שורה 2: כותרת + אייקון סוג קובץ */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <h3 className="font-bold text-base truncate">{sketch.title}</h3>
        <div className="shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
          {isSound ? (
            <IconMusic className="w-3.5 h-3.5 text-primary" />
          ) : (
            <span className="text-base">{fileTypeIcons[sketch.file_type] || '📄'}</span>
          )}
        </div>
      </div>

      {/* שורה 3: אווטאר + שם מעלה/ת */}
      <div className="flex items-center gap-1.5 mb-2.5">
        <span className={'w-4 h-4 shrink-0 rounded-full flex items-center justify-center text-[9px] font-bold text-white ' + avatarColor}>
          {avatarInitial}
        </span>
        <span className="text-xs text-muted-foreground truncate">{sketch.uploader_username}</span>
      </div>

      {/* שורה 4: waveform + ניגון אמיתי - רק לקבצי סאונד */}
      {isSound ? (
        <div className="flex items-center gap-2 bg-secondary/60 rounded-lg px-2 py-1.5 mb-2.5">
          {sketch.file_url ? (
            <audio
              ref={audioRef}
              src={signedUrl || undefined}
              onPlay={function () { setIsPlaying(true); }}
              onPause={function () { setIsPlaying(false); }}
              onEnded={handleEnded}
              onTimeUpdate={handleTimeUpdate}
              className="hidden"
            />
          ) : null}

          <div className="flex-1 flex items-center gap-[2px] h-4 overflow-hidden">
            {waveformBars.map(function (h, i) {
              var isPlayed = (i / WAVEFORM_BAR_COUNT) < progress;
              return (
                <span
                  key={i}
                  className={'w-[2px] shrink-0 rounded-full transition-colors ' + (isPlayed ? 'bg-primary' : 'bg-muted-foreground/50')}
                  style={{ height: h + '%' }}
                />
              );
            })}
          </div>

          <button
            type="button"
            onClick={handlePlayClick}
            disabled={isLoadingAudio}
            title={isPlaying ? 'השהיה' : 'השמעה'}
            className="shrink-0 w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center disabled:opacity-60"
          >
            {isLoadingAudio ? (
              <IconLoader className="w-2.5 h-2.5 text-foreground" />
            ) : isPlaying ? (
              <IconPause className="w-2.5 h-2.5 text-foreground" />
            ) : (
              <IconPlay className="w-2.5 h-2.5 text-foreground" />
            )}
          </button>
        </div>
      ) : null}

      {/* שורה 5: פעולות - שיתוף / תגובה / לייק */}
      <div className="border-t border-border pt-1.5 flex items-center gap-4">
        <button type="button" onClick={stopPropagation} title="שיתוף" className="text-muted-foreground hover:text-foreground transition-colors">
          <IconShare className="w-4 h-4" />
        </button>
        <button type="button" onClick={stopPropagation} title="תגובה" className="text-muted-foreground hover:text-foreground transition-colors">
          <IconMessage className="w-4 h-4" />
        </button>
        <button type="button" onClick={stopPropagation} title="לייק" className="text-muted-foreground hover:text-foreground transition-colors">
          <IconHeart className="w-4 h-4" />
        </button>
      </div>

      {isTagModalOpen ? (
        <VisibilityTagModal
          isOpen={isTagModalOpen}
          onClose={function (e) { if (e && e.stopPropagation) e.stopPropagation(); setIsTagModalOpen(false); }}
          session={session}
          contentType="sketch"
          contentId={sketch.id}
          contentTitle={sketch.title}
          isContentPublic={sketch.is_public !== false}
        />
      ) : null}
    </div>
  );
}