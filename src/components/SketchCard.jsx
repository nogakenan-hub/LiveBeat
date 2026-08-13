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

// האם הסטטוס "דרוש פידבק" - שלב 5 של תוכנית העיצוב: רק כרטיסים כאלה מקבלים הילת זוהר, לפי rezo_redesign_v3.html
function needsFeedbackGlow(status) {
  return !!(status && status.indexOf('פידבק') !== -1);
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

function IconFile(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
      <path d="M14 2v6h6M6 2h8l6 6v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2z" />
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
  var menuRef = useRef(null);

  var isOwner = session && sketch.uploader_user_id === session.user.id;
  var isPrivate = sketch.is_public === false;
  var isSound = (sketch.file_type || 'sound') === 'sound';
  var avatarColor = getAvatarColor(sketch.uploader_username);
  var avatarInitial = (sketch.uploader_username || '?').trim().charAt(0);
  var waveformBars = isSound ? getWaveformBars(sketch.id) : [];
  var showGlow = needsFeedbackGlow(sketch.status);
  // הערה: מונה התגובות מוצג רק אם sketch.comment_count אכן קיים בנתונים שמגיעים מהשרת.
  // אם השדה נקרא אחרת אצלך (או לא קיים בכלל), תגידי לי ונתאים.
  var hasCommentCount = typeof sketch.comment_count === 'number';

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

  // שלב 5 של תוכנית העיצוב - תפריט תלת-נקודתי (מרכז תיוג/שיתוף/מחיקה)
  var isMenuOpenState = useState(false);
  var isMenuOpen = isMenuOpenState[0];
  var setIsMenuOpen = isMenuOpenState[1];

  // ברגע שה-URL החתום מגיע, אם הייתה בקשת ניגון ממתינה - מנגנות מיד
  useEffect(function () {
    if (signedUrl && pendingPlayRef.current && audioRef.current) {
      pendingPlayRef.current = false;
      audioRef.current.play();
    }
  }, [signedUrl]);

  // סגירת התפריט בלחיצה מחוץ לו
  useEffect(function () {
    if (!isMenuOpen) return;
    function handleOutsideClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener('click', handleOutsideClick);
    return function () {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, [isMenuOpen]);

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
    setIsMenuOpen(false);
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
    setIsMenuOpen(false);
    setIsTagModalOpen(true);
  }

  function handleMenuToggle(e) {
    e.stopPropagation();
    setIsMenuOpen(function (prev) { return !prev; });
  }

  function handleShareClick(e) {
    e.stopPropagation();
    setIsMenuOpen(false);
    if (navigator.share) {
      navigator.share({ title: sketch.title, url: window.location.href }).catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
    }
  }

  var displayDate = sketch.created_at ? new Date(sketch.created_at).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' }) : '';

  return (
    <div
      onClick={function () { onOpenModal(sketch); }}
      className="relative overflow-hidden rounded-lg bg-card p-3.5 cursor-pointer transition-all hover:border-primary/30"
      style={{
        border: '1px solid var(--border-subtle, rgba(255,255,255,0.09))',
        backgroundImage: 'linear-gradient(160deg, rgba(138,111,214,0.12), rgba(30,26,44,0.2) 55%, rgba(15,13,20,0.35))'
      }}
    >
      {/* הילת זוהר - רק לכרטיסי "דרוש פידבק", שלב 5 של תוכנית העיצוב */}
      {showGlow ? (
        <span
          className="pointer-events-none absolute -z-10 animate-glow-pulse"
          style={{
            top: '-40px',
            right: '-40px',
            width: '140px',
            height: '140px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(224,168,79,0.28), transparent 70%)'
          }}
        />
      ) : null}

      {/* שורה 1: נקודת סטטוס + תגיות + תפריט תלת-נקודתי */}
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className={'w-2 h-2 rounded-full ' + getStatusColor(sketch.status)}></span>
          <span className="text-xs text-muted-foreground">{sketch.status}</span>
        </div>

        <div className="flex items-center gap-1.5">
          {isPrivate ? (
            <span
              title="קטע פרטי - נראה רק לך"
              className="text-[10px] font-medium bg-yellow-700/70 text-white px-2 py-0.5 rounded-full"
            >
              🔒 פרטי
            </span>
          ) : null}
          {sketch.genre ? (
            <span className="text-xs text-foreground/70 bg-white/5 border border-white/10 px-2.5 py-0.5 rounded-full">
              {sketch.genre}
            </span>
          ) : null}

          {/* תפריט תלת-נקודתי - מרכז תיוג/שיתוף/מחיקה, במקום כפתורים נפרדים */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={handleMenuToggle}
              title="עוד אפשרויות"
              className="flex h-6 w-6 shrink-0 items-center justify-center gap-[2.5px] rounded-md text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
            >
              <span className="h-[3px] w-[3px] rounded-full bg-current"></span>
              <span className="h-[3px] w-[3px] rounded-full bg-current"></span>
              <span className="h-[3px] w-[3px] rounded-full bg-current"></span>
            </button>

            {isMenuOpen ? (
              <div
                className="absolute left-0 top-7 z-20 min-w-[130px] rounded-md border p-1 shadow-2xl"
                style={{ background: '#26213a', borderColor: 'var(--border-med, rgba(255,255,255,0.16))' }}
                onClick={stopPropagation}
              >
                {isOwner ? (
                  <button
                    type="button"
                    onClick={handleOpenTagModal}
                    className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-right text-[12.5px] text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
                  >
                    תיוג
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={handleShareClick}
                  className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-right text-[12.5px] text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
                >
                  שיתוף
                </button>
                {isOwner ? (
                  <button
                    type="button"
                    onClick={handleDeleteClick}
                    className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-right text-[12.5px] text-red-400 transition-colors hover:bg-red-500/10"
                  >
                    מחיקה
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* שורה 2: מדיה - waveform לקבצי סאונד (בלי כותרת, כמו במוקאפ), אייקון+תאריך+כותרת לשאר */}
      {isSound ? (
        <div dir="ltr" className="mb-2.5 flex items-center gap-2 rounded-lg bg-black/20 px-2 py-1.5" style={{ border: '1px solid var(--border-subtle, rgba(255,255,255,0.09))' }}>
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

          {displayDate ? (
            <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">{displayDate}</span>
          ) : null}

          <button
            type="button"
            onClick={handlePlayClick}
            disabled={isLoadingAudio}
            title={isPlaying ? 'השהיה' : 'השמעה'}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-60"
          >
            {isLoadingAudio ? (
              <IconLoader className="w-3 h-3 text-foreground" />
            ) : isPlaying ? (
              <IconPause className="w-2.5 h-2.5 text-foreground" />
            ) : (
              <IconPlay className="w-2.5 h-2.5 text-foreground ml-[1px]" />
            )}
          </button>

          <div className="flex h-6 flex-1 items-center gap-[2px] overflow-hidden">
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
        </div>
      ) : (
        <div dir="ltr" className="mb-2.5 flex items-center gap-3 rounded-lg bg-black/20 px-2 py-1.5" style={{ border: '1px solid var(--border-subtle, rgba(255,255,255,0.09))' }}>
          {displayDate ? (
            <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">{displayDate}</span>
          ) : null}
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
            style={{ background: 'linear-gradient(135deg, rgba(138,111,214,0.25), rgba(138,111,214,0.05))', border: '1px solid var(--border-subtle, rgba(255,255,255,0.09))' }}
          >
            {sketch.file_type === 'video' ? (
              <span className="text-base">🎬</span>
            ) : (
              <IconFile className="h-4 w-4" style={{ color: 'var(--accent-2-hex, #b48fe8)' }} />
            )}
          </div>
          <span className="flex-1 truncate text-[12.5px] font-semibold text-foreground">{sketch.title}</span>
        </div>
      )}

      {/* שורה 4: פוטר - אווטאר+שם+מונה תגובות, לייק/תגובה */}
      <div className="flex items-center justify-between border-t pt-1.5" style={{ borderColor: 'var(--border-subtle, rgba(255,255,255,0.09))' }}>
        <div className="flex items-center gap-1.5">
          <span className={'w-[18px] h-[18px] shrink-0 rounded-full flex items-center justify-center text-[9px] font-bold text-white ' + avatarColor}>
            {avatarInitial}
          </span>
          <span className="text-xs text-muted-foreground truncate">{sketch.uploader_username}</span>
          {hasCommentCount ? (
            <span
              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle, rgba(255,255,255,0.09))' }}
            >
              {sketch.comment_count}
              <IconMessage className="w-2.5 h-2.5 text-muted-foreground" />
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-3 text-muted-foreground">
          <button type="button" onClick={stopPropagation} title="לייק" className="hover:text-foreground transition-colors">
            <IconHeart className="w-4 h-4" />
          </button>
          <button type="button" onClick={stopPropagation} title="תגובה" className="hover:text-foreground transition-colors">
            <IconMessage className="w-4 h-4" />
          </button>
        </div>
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