// @ts-nocheck
import React, { useState, useContext } from 'react';
import SketchCard from './components/SketchCard';
import SketchDetailModal from './components/SketchDetailModal';
import GroupManagerModal from './components/GroupManagerModal';
import VisibilityTagModal from './components/VisibilityTagModal';
import AdminSubscriptionsModal from './components/AdminSubscriptionsModal';
import RoomList from './components/RoomList';
import { SupabaseContext } from './main';

var PREVIEW_SKETCH_COUNT = 6; // כמה סקיצות מוצגות בעמוד הבית לפני שצריך ללחוץ "הצג הכל"

// user_id קבוע של נגה - פריט תפריט "ניהול מנויים" מוצג רק למי שמחוברת עם ה-id הזה.
// זו הגנת UI בלבד לנוחות - האכיפה האמיתית קיימת בשרת (Edge Function admin-set-subscription).
var ADMIN_USER_ID = 'b10531e5-2115-43d4-99f2-3205c697b01e';

function sketchMatchesSearch(sketch, query) {
  if (!query) return true;
  var q = query.toLowerCase();
  var title = (sketch.title || '').toLowerCase();
  var genre = (sketch.genre || '').toLowerCase();
  var uploader = (sketch.uploader_username || '').toLowerCase();
  return title.indexOf(q) !== -1 || genre.indexOf(q) !== -1 || uploader.indexOf(q) !== -1;
}

// --- מסך חסימה למשתמשת עם חשבון מושהה: הצגה בלבד + ביטול השהיה ---
function DeactivatedAccountScreen(props) {
  var profile = props.profile;
  var onSignOut = props.onSignOut;
  var supabase = useContext(SupabaseContext);

  var isReactivatingState = useState(false);
  var isReactivating = isReactivatingState[0];
  var setIsReactivating = isReactivatingState[1];

  function handleReactivate() {
    setIsReactivating(true);

    supabase
      .from('Profile')
      .update({ deactivated_at: null })
      .eq('id', profile.id)
      .then(function (result) {
        if (result.error) {
          setIsReactivating(false);
          console.error('שגיאה בביטול ההשהיה:', result.error.message);
          alert('קרתה שגיאה בביטול ההשהיה: ' + result.error.message);
          return;
        }
        window.location.reload();
      });
  }

  var deactivatedDate = profile.deactivated_at ? new Date(profile.deactivated_at).toLocaleDateString('he-IL') : '';

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4" dir="rtl">
      <div className="max-w-md w-full text-center border border-border rounded-2xl p-8 bg-card">
        <div className="text-4xl mb-4">💤</div>
        <h1 className="text-xl font-bold mb-2">החשבון שלך מושהה</h1>
        <p className="text-sm text-muted-foreground mb-6">
          החשבון הושהה בתאריך {deactivatedDate}. הוא מוסתר מכולם, ושום דבר לא נמחק. אפשר לחזור בכל שלב.
        </p>
        <button
          type="button"
          onClick={handleReactivate}
          disabled={isReactivating}
          className="w-full bg-primary text-primary-foreground p-3 rounded-lg font-bold mb-3 disabled:opacity-50"
        >
          {isReactivating ? 'מבטלת השהיה...' : 'בטלי השהיה וחזרי לפעילות'}
        </button>
        <button
          type="button"
          onClick={onSignOut}
          className="w-full bg-secondary p-3 rounded-lg font-medium text-sm"
        >
          התנתקות
        </button>
      </div>
    </div>
  );
}

// --- Overlay צף של "כל הקטעים" - מרחף מעל האתר, גלילה פנימית, הרקע נראה מטושטש מאחורה ---
function AllSketchesOverlay(props) {
  var isOpen = props.isOpen;
  var onClose = props.onClose;
  var sketches = props.sketches;
  var searchQuery = props.searchQuery;
  var setSearchQuery = props.setSearchQuery;
  var filters = props.filters;
  var activeFilter = props.activeFilter;
  var setActiveFilter = props.setActiveFilter;
  var filterButtonClass = props.filterButtonClass;
  var onOpenModal = props.onOpenModal;
  var onDeleteSketch = props.onDeleteSketch;
  var onUploadClick = props.onUploadClick;
  var session = props.session;
  var onOpenAuth = props.onOpenAuth;
  // חדש - מועבר הלאה ל-SketchCard כאן, בדיוק כמו בפיד הרגיל למטה
  var rooms = props.rooms || [];
  var pendingRoomIds = props.pendingRoomIds;
  var approvedRoomIds = props.approvedRoomIds;
  var guestRoomIds = props.guestRoomIds;
  var onJoinRoom = props.onJoinRoom;
  var onEnterRoom = props.onEnterRoom;
  var onOpenCreateRoomForSketch = props.onOpenCreateRoomForSketch;
  var onSketchUpdated = props.onSketchUpdated;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-6xl bg-background border border-border rounded-2xl shadow-2xl mt-4 sm:mt-8 mb-4 sm:mb-8 flex flex-col max-h-[90vh]"
        onClick={function (e) { e.stopPropagation(); }}
      >
        {/* כותרת קבועה למעלה, לא גוללת עם התוכן */}
        <div className="flex items-center justify-between gap-2 p-4 sm:p-5 border-b border-border shrink-0">
          <div>
            <h2 className="text-base sm:text-xl font-bold flex items-center gap-2">🎵 כל הקטעים</h2>
            <p className="text-[11px] sm:text-sm text-muted-foreground mt-0.5">{sketches.length} קטעים</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onUploadClick}
              className="hidden sm:flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-all whitespace-nowrap"
            >
              + העלאת קטע
            </button>
            <button
              type="button"
              onClick={onClose}
              title="סגירה"
              className="flex items-center justify-center h-9 w-9 rounded-lg bg-secondary hover:bg-secondary/70 transition-colors text-lg leading-none"
            >
              ✕
            </button>
          </div>
        </div>

        {/* תוכן גלילי */}
        <div className="p-4 sm:p-5 overflow-y-auto">
          <div className="mb-3 sm:mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={function (e) { setSearchQuery(e.target.value); }}
              placeholder="חיפוש לפי כותרת, סגנון או שם היוצר..."
              className="w-full bg-secondary/40 border border-border rounded-lg px-3 py-2 text-xs sm:text-sm outline-none focus:border-primary transition-colors"
            />
          </div>

          <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-4 sm:mb-6">
            {filters.map(function (f) {
              return (
                <button
                  type="button"
                  key={f}
                  onClick={function () { setActiveFilter(f); }}
                  className={filterButtonClass(activeFilter === f)}
                >
                  {f}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {sketches.map(function (sketch) {
              return (
                <SketchCard
                  key={sketch.id}
                  sketch={sketch}
                  onOpenModal={onOpenModal}
                  onDelete={onDeleteSketch}
                  session={session}
                  onOpenAuth={onOpenAuth}
                  rooms={rooms}
                  pendingRoomIds={pendingRoomIds}
                  approvedRoomIds={approvedRoomIds}
                  guestRoomIds={guestRoomIds}
                  onJoinRoom={onJoinRoom}
                  onEnterRoom={onEnterRoom}
                  onOpenCreateRoomForSketch={onOpenCreateRoomForSketch}
                  onSketchUpdated={onSketchUpdated}
                />
              );
            })}
          </div>

          {sketches.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {searchQuery ? 'לא נמצאו קטעים התואמים לחיפוש.' : 'עדיין אין קטעים כאן. תהיי הראשונה להעלות!'}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function App(props) {
  var rooms = props.rooms || [];
  var sketches = props.sketches || [];
  var onOpenCreateModal = props.onOpenCreateModal;
  var onOpenCreateRoomForSketch = props.onOpenCreateRoomForSketch;
  var onDeleteRoom = props.onDeleteRoom;
  var onRequestJoin = props.onRequestJoin;
  var onEnterRoom = props.onEnterRoom;
  var onOpenUploadModal = props.onOpenUploadModal;
  var onDeleteSketch = props.onDeleteSketch;
  var onUpdateSketch = props.onUpdateSketch;
  var pendingRoomIds = props.pendingRoomIds;
  var approvedRoomIds = props.approvedRoomIds;
  var guestRoomIds = props.guestRoomIds;
  var session = props.session;
  var profile = props.profile;
  var onOpenAuth = props.onOpenAuth;
  var onSignOut = props.onSignOut;
  var onOpenEditProfile = props.onOpenEditProfile;
  var onOpenDeleteAccount = props.onOpenDeleteAccount;
  var onDeactivateAccount = props.onDeactivateAccount;
  var unreadMessageCount = props.unreadMessageCount || 0;
  var onOpenInbox = props.onOpenInbox;
  var onOpenDirectMessage = props.onOpenDirectMessage;
  var onOpenProfile = props.onOpenProfile;

  var activeFilterState = useState('הכל');
  var activeFilter = activeFilterState[0];
  var setActiveFilter = activeFilterState[1];

  // באנר "ברוכה השבה" - שלב 2 של תוכנית העיצוב. ההסתרה זמנית בלבד (state רגיל) - חוזר בכל רענון, לפי בקשת נגה.
  var welcomeBannerState = useState(true);
  var isWelcomeBannerVisible = welcomeBannerState[0];
  var setIsWelcomeBannerVisible = welcomeBannerState[1];

  var searchQueryState = useState('');
  var searchQuery = searchQueryState[0];
  var setSearchQuery = searchQueryState[1];

  var profileMenuState = useState(false);
  var isProfileMenuOpen = profileMenuState[0];
  var setIsProfileMenuOpen = profileMenuState[1];

  var selectedSketchState = useState(null);
  var selectedSketch = selectedSketchState[0];
  var setSelectedSketch = selectedSketchState[1];

  // "הצג הכל" - overlay צף, לא מסך/עמוד נפרד
  var isAllSketchesOpenState = useState(false);
  var isAllSketchesOpen = isAllSketchesOpenState[0];
  var setIsAllSketchesOpen = isAllSketchesOpenState[1];

  // ניהול קבוצות (Stage 3 - ניראות סלקטיבית)
  var isGroupManagerOpenState = useState(false);
  var isGroupManagerOpen = isGroupManagerOpenState[0];
  var setIsGroupManagerOpen = isGroupManagerOpenState[1];

  // ניהול מנויים - זמין רק לאדמין (נגה)
  var isAdminSubscriptionsOpenState = useState(false);
  var isAdminSubscriptionsOpen = isAdminSubscriptionsOpenState[0];
  var setIsAdminSubscriptionsOpen = isAdminSubscriptionsOpenState[1];

  // תיוג ניראות לחדר ספציפי - שומרים רק את ה-id של החדר שכרגע מתויג
  var taggingRoomIdState = useState(null);
  var taggingRoomId = taggingRoomIdState[0];
  var setTaggingRoomId = taggingRoomIdState[1];

  var filters = ['הכל', 'בעבודה', 'פוצח בהצלחה', 'דרוש פידבק'];

  var isAdmin = !!(session && session.user && session.user.id === ADMIN_USER_ID);

  // --- אם החשבון המחובר מושהה, מציגות רק את מסך הביטול - חוסמות את שאר האפליקציה ---
  if (session && profile && profile.deactivated_at) {
    return <DeactivatedAccountScreen profile={profile} onSignOut={onSignOut} />;
  }

  function handleProfileButtonClick() {
    setIsProfileMenuOpen(function (prev) { return !prev; });
  }

  function handleSignOutClick() {
    setIsProfileMenuOpen(false);
    if (onSignOut) onSignOut();
  }

  function handleSignInClick() {
    setIsProfileMenuOpen(false);
    if (onOpenAuth) onOpenAuth();
  }

  function handleEditProfileClick() {
    setIsProfileMenuOpen(false);
    if (onOpenEditProfile) onOpenEditProfile();
  }

  function handleOpenGroupManagerClick() {
    setIsProfileMenuOpen(false);
    setIsGroupManagerOpen(true);
  }

  function handleOpenAdminSubscriptionsClick() {
    setIsProfileMenuOpen(false);
    setIsAdminSubscriptionsOpen(true);
  }

  function handleDeleteAccountClick() {
    setIsProfileMenuOpen(false);
    if (onOpenDeleteAccount) onOpenDeleteAccount();
  }

  function handleDeactivateAccountClick() {
    setIsProfileMenuOpen(false);
    var message = 'החשבון שלך יוסתר לגמרי מכולם עד שתתחברי שוב ותבטלי את ההשהיה. שום דבר לא נמחק. להמשיך?';
    var confirmed = window.confirm(message);
    if (confirmed && onDeactivateAccount) {
      onDeactivateAccount();
    }
  }

  function handleUploadClick() {
    if (onOpenUploadModal) onOpenUploadModal();
  }

  function handleDismissWelcomeBanner() {
    setIsWelcomeBannerVisible(false);
  }

  function filterButtonClass(isActive) {
    var base = 'px-2.5 py-1 sm:px-4 sm:py-1.5 rounded-full text-[11px] sm:text-sm font-medium transition-all ';
    if (isActive) {
      return base + 'bg-primary text-primary-foreground';
    }
    return base + 'bg-secondary text-muted-foreground hover:text-foreground';
  }

  function handleSketchStatusChanged(updatedSketch) {
    setSelectedSketch(updatedSketch);
    if (onUpdateSketch) {
      onUpdateSketch(updatedSketch);
    }
  }

  // הסינון האמיתי כבר קורה ב-RLS בצד השרת (כולל תיוגי נראות של שלב 3 - קבוצות ומשתמשות ספציפיות).
  // כל שורה שמגיעה כאן כבר עברה את הבדיקה בשרת - אין צורך (וזה גם שגוי) לסנן שוב לפי בעלות בלבד בצד הלקוח.
  var visibleSketches = sketches;

  var statusFilteredSketches;
  if (activeFilter === 'הכל') {
    statusFilteredSketches = visibleSketches;
  } else {
    statusFilteredSketches = visibleSketches.filter(function (s) {
      return s.status === activeFilter;
    });
  }

  var displayedSketches = statusFilteredSketches.filter(function (s) {
    return sketchMatchesSearch(s, searchQuery);
  });

  var hasMoreThanPreview = displayedSketches.length > PREVIEW_SKETCH_COUNT;
  var previewSketches = displayedSketches.slice(0, PREVIEW_SKETCH_COUNT);

  var profileButtonLabel;
  if (session) {
    if (profile) {
      profileButtonLabel = profile.display_name;
    } else {
      profileButtonLabel = session.user.email;
    }
  } else {
    profileButtonLabel = 'הפרופיל שלי';
  }

  var welcomeGreeting;
  if (session && profile && profile.display_name) {
    welcomeGreeting = 'ברוכה השבה, ' + profile.display_name;
  } else {
    welcomeGreeting = 'ברוכים הבאים לקהילה';
  }

  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      <style>{'.rooms-scrollbar::-webkit-scrollbar{width:6px}.rooms-scrollbar::-webkit-scrollbar-track{background:transparent}.rooms-scrollbar::-webkit-scrollbar-thumb{background-color:#52525b;border-radius:9999px}.rooms-scrollbar::-webkit-scrollbar-button{display:none;width:0;height:0}.rooms-scrollbar{scrollbar-width:thin;scrollbar-color:#52525b transparent}'}</style>

      {/* ===== Header - עודכן בשלב 1 של תוכנית העיצוב: לוגו ממורכז, בלי ניווט, פעמון במקום מעטפה ===== */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto grid max-w-7xl grid-cols-[auto_1fr] items-center gap-4 px-4 py-3 sm:px-6">

          {/* צד ימני (ב-RTL, כי זה ה-child הראשון): הודעות + פרופיל מקובצים יחד */}
          <div className="flex items-center gap-2">
            {session ? (
              <button
                type="button"
                onClick={function () { if (onOpenInbox) onOpenInbox(); }}
                className="relative flex items-center justify-center rounded-xl border border-border bg-secondary/50 h-10 w-10 hover:bg-secondary transition-colors"
                title="הודעות"
              >
                ✉️
                {unreadMessageCount > 0 ? (
                  <span className="absolute -top-1 -left-1 bg-red-600 text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center">
                    {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
                  </span>
                ) : null}
              </button>
            ) : null}

            <div className="relative">
              <button
                type="button"
                onClick={handleProfileButtonClick}
                className="flex items-center gap-2 rounded-xl border border-border bg-secondary/50 px-3 py-2 text-sm font-medium hover:bg-secondary transition-colors"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">👤</div>
                {profileButtonLabel}
                {profile && profile.is_professional ? (
                  <span title="גם איש/אשת מקצוע" className="text-xs">🎓</span>
                ) : null}
              </button>

              {isProfileMenuOpen ? (
              <div className="absolute left-0 mt-2 w-56 rounded-xl border border-border bg-card p-2 shadow-2xl z-50">
                {session ? (
                  <React.Fragment>
                    <div className="px-3 py-2 text-xs text-muted-foreground border-b border-border mb-1">
                      מחוברת כ: {session.user.email}
                    </div>
                    <button
                      type="button"
                      onClick={handleEditProfileClick}
                      className="w-full text-right px-3 py-2 text-sm rounded-lg hover:bg-secondary transition-colors"
                    >
                      עדכון פרטים
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenGroupManagerClick}
                      className="w-full text-right px-3 py-2 text-sm rounded-lg hover:bg-secondary transition-colors"
                    >
                      ניהול קבוצות
                    </button>
                    {isAdmin ? (
                      <button
                        type="button"
                        onClick={handleOpenAdminSubscriptionsClick}
                        className="w-full text-right px-3 py-2 text-sm rounded-lg hover:bg-secondary transition-colors"
                      >
                        ניהול מנויים (אדמין)
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={handleDeleteAccountClick}
                      className="w-full text-right px-3 py-2 text-sm rounded-lg hover:bg-secondary transition-colors text-red-400"
                    >
                      מחיקת חשבון לצמיתות
                    </button>
                    <button
                      type="button"
                      onClick={handleDeactivateAccountClick}
                      className="w-full text-right px-3 py-2 text-sm rounded-lg hover:bg-secondary transition-colors"
                    >
                      השהיית חשבון
                    </button>
                    <button
                      type="button"
                      onClick={handleSignOutClick}
                      className="w-full text-right px-3 py-2 text-sm rounded-lg hover:bg-secondary transition-colors"
                    >
                      התנתקות
                    </button>
                  </React.Fragment>
                ) : (
                  <button
                    type="button"
                    onClick={handleSignInClick}
                    className="w-full text-right px-3 py-2 text-sm rounded-lg hover:bg-secondary transition-colors"
                  >
                    התחברות
                  </button>
                )}
              </div>
            ) : null}
            </div>
          </div>

          {/* השטח הנותר: הלוגו, ממורכז בתוכו */}
          <div className="flex items-center justify-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <span className="text-lg">🎵</span>
            </div>
            <span className="text-lg font-bold tracking-tight">Rezo</span>
          </div>
        </div>
      </header>

      {/* ===== באנר "ברוכה השבה" - עודכן בשלב 2: שתי שורות, מיושר לאותו מיכל כמו שאר העמוד ===== */}
      {isWelcomeBannerVisible ? (
        <div className="border-b border-border bg-card/50">
          <div className="mx-auto flex max-w-7xl items-start justify-between gap-3 px-3 py-3 sm:px-6 flex-wrap">
            <div className="text-right">
              <p className="text-sm font-bold sm:text-base">
                {welcomeGreeting} 🎵
              </p>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                יש <span className="text-primary font-semibold">{sketches.length}</span> קטעים חדשים בפיד ו-<span className="text-primary font-semibold">{rooms.length}</span> חדרי לייב פעילים כרגע.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDismissWelcomeBanner}
              className="shrink-0 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              הסתר ✕
            </button>
          </div>
        </div>
      ) : null}

      <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8">
        <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[320px_1fr] gap-3 sm:gap-8 items-start">

          <section id="live">
            <div className="mb-4 sm:mb-6">
              <h2 className="text-base sm:text-xl font-bold flex items-center gap-2">
                <span className="text-live">📡</span>
                <span className="hidden sm:inline">חדרים בלייב</span>
                <span className="sm:hidden">חדרים</span>
              </h2>
              <p className="text-[11px] sm:text-sm text-muted-foreground mt-1">
                <span className="text-primary font-semibold">{rooms.length}</span> פעילים
              </p>
            </div>

            {/* עודכן: הריווח (mt/mb) עצמו נשאר זהה לשורת הכלים בפיד - זה כבר נבדק ואושר.
                אבל עכשיו לשורת הכלים יש עד 4 שורות במובייל (חיפוש/סינון/הצג הכל/העלאה - כל אחת בשורה
                נפרדת), בעוד שכאן יש רק כפתור אחד - זה עלול ליצור מחדש הפרש גובה גדול יותר מקודם.
                הריווח הדמה הבא הוא זמני ומכוון לפצות על שורה נוספת אחת בלבד - כדאי לבדוק בפועל
                אם הוא מספיק אחרי הפירוק ל-4 שורות, וייתכן שיהיה צריך לחשוב מחדש על הפתרון. */}
            <div className="mt-3 sm:mt-4 mb-4 sm:mb-6 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={function (e) {
                  e.preventDefault();
                  e.stopPropagation();
                  if (onOpenCreateModal) onOpenCreateModal();
                }}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-transparent bg-live px-3 text-xs font-semibold text-white hover:bg-live/90 transition-all whitespace-nowrap"
              >
                <span className="text-sm leading-none">+</span>
                פתיחת חדר
              </button>
              <div className="h-8 w-3/4 sm:hidden" aria-hidden="true" />
            </div>

            <RoomList
              rooms={rooms}
              pendingRoomIds={pendingRoomIds}
              approvedRoomIds={approvedRoomIds}
              guestRoomIds={guestRoomIds}
              session={session}
              onJoinRoom={onRequestJoin}
              onEnterRoom={onEnterRoom}
              onDeleteRoom={onDeleteRoom}
              onTagVisibility={setTaggingRoomId}
            />
          </section>

          <section id="sketches">
            <div className="mb-4 sm:mb-6">
              <h2 className="text-base sm:text-xl font-bold flex items-center gap-2">🎵 פיד היצירה</h2>
              <p className="text-[11px] sm:text-sm text-muted-foreground mt-1">
                <span className="text-primary font-semibold">{sketches.length}</span> קטעים בקהילה
              </p>
            </div>

            {/* ===== מותאם למובייל: חזרה לקיבוץ 2 שורות (חיפוש+סינון / הצג הכל+העלאה) - 4 שורות נפרדות
                היה גם גבוה מדי וגם לא מאוזן (פילים צרים נמתחים לרוחב מלא). הפעם בלי flex-1 על
                כפתורי השורה השנייה - הם בגודל תוכן קבוע, אז לא "מתפחים" כשרק אחד מהם מוצג. ===== */}
            <div className="mb-4 mt-3 sm:mb-6 sm:mt-4 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-2.5 w-[92%] mx-auto">

              {/* שורה 1 במובייל: חיפוש (תופס את רוב הרוחב) + סינון (קומפקטי) */}
              <div className="flex items-center gap-2 sm:contents">
                <div
                  className="flex h-8 flex-1 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-muted-foreground sm:flex-none sm:w-[170px] sm:shrink-0"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0">
                    <circle cx="11" cy="11" r="7" />
                    <path d="M21 21l-4.3-4.3" />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={function (e) { setSearchQuery(e.target.value); }}
                    placeholder="חיפוש..."
                    className="w-full bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
                  />
                </div>

                <div className="relative shrink-0">
                  <select
                    value={activeFilter}
                    onChange={function (e) { setActiveFilter(e.target.value); }}
                    className="h-8 cursor-pointer appearance-none rounded-full border border-border bg-card pl-[14px] pr-[34px] text-[12.5px] text-foreground outline-none transition-colors focus:border-primary whitespace-nowrap"
                  >
                    {filters.map(function (f) {
                      return (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      );
                    })}
                  </select>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute left-[14px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 text-muted-foreground">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </div>
              </div>

              {/* רווח גמיש - קיים רק בדסקטופ (שורה אחת), נעלם לגמרי במובייל */}
              <div className="hidden sm:block sm:flex-1" />

              {/* שורה 2 במובייל: הצג הכל + העלאת קטע - גודל תוכן קבוע (לא flex-1), לא נמתחים */}
              <div className="flex items-center gap-2 sm:contents">
                {hasMoreThanPreview ? (
                  <button
                    type="button"
                    onClick={function () { setIsAllSketchesOpen(true); }}
                    className="inline-flex h-8 items-center justify-center rounded-full border border-border/70 px-3 text-xs font-semibold text-foreground hover:bg-secondary/40 transition-all whitespace-nowrap"
                  >
                    הצג הכל
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={handleUploadClick}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-white transition-opacity hover:opacity-90 whitespace-nowrap"
                  style={{ background: 'linear-gradient(135deg, var(--accent-2-hex), var(--accent-hex))' }}
                >
                  + העלאת קטע
                </button>
              </div>
            </div>

            {/* עודכן: תמיד 2 כרטיסים בשורה (מ-sm ומעלה), ממורכז מתחת לשורת הכלים.
                כוונון סופי: max-w-4xl (כמעט לא הורגש) -> max-w-2xl (מרווח קצת יותר מדי) -> max-w-3xl (איזון).
                שינוי זה חל רק בפיד הרגיל כאן - לא ב-overlay של "הצג הכל" למטה. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 max-w-3xl mx-auto">
              {previewSketches.map(function (sketch) {
                return (
                  <SketchCard
                    key={sketch.id}
                    sketch={sketch}
                    onOpenModal={setSelectedSketch}
                    onDelete={onDeleteSketch}
                    session={session}
                    onOpenAuth={onOpenAuth}
                    rooms={rooms}
                    pendingRoomIds={pendingRoomIds}
                    approvedRoomIds={approvedRoomIds}
                    guestRoomIds={guestRoomIds}
                    onJoinRoom={onRequestJoin}
                    onEnterRoom={onEnterRoom}
                    onOpenCreateRoomForSketch={onOpenCreateRoomForSketch}
                    onSketchUpdated={onUpdateSketch}
                  />
                );
              })}
            </div>

            {displayedSketches.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {searchQuery ? 'לא נמצאו קטעים התואמים לחיפוש.' : 'עדיין אין קטעים כאן. תהיי הראשונה להעלות!'}
              </p>
            ) : null}
          </section>
        </div>
      </div>

      <footer className="border-t border-border mt-12 py-6 text-center text-sm text-muted-foreground">
        סקיצה פתוחה 2026 - קהילה לפיצוח סקיצות
      </footer>

      <SketchDetailModal
        isOpen={!!selectedSketch}
        sketch={selectedSketch}
        onClose={function () { setSelectedSketch(null); }}
        session={session}
        profile={profile}
        onStatusChange={handleSketchStatusChanged}
        onOpenDirectMessage={onOpenDirectMessage}
        onOpenProfile={onOpenProfile}
        onOpenAuth={onOpenAuth}
      />

      <AllSketchesOverlay
        isOpen={isAllSketchesOpen}
        onClose={function () { setIsAllSketchesOpen(false); }}
        sketches={displayedSketches}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        filters={filters}
        activeFilter={activeFilter}
        setActiveFilter={setActiveFilter}
        filterButtonClass={filterButtonClass}
        onOpenModal={setSelectedSketch}
        onDeleteSketch={onDeleteSketch}
        onUploadClick={handleUploadClick}
        session={session}
        onOpenAuth={onOpenAuth}
        rooms={rooms}
        pendingRoomIds={pendingRoomIds}
        approvedRoomIds={approvedRoomIds}
        guestRoomIds={guestRoomIds}
        onJoinRoom={onRequestJoin}
        onEnterRoom={onEnterRoom}
        onOpenCreateRoomForSketch={onOpenCreateRoomForSketch}
        onSketchUpdated={onUpdateSketch}
      />

      <GroupManagerModal
        isOpen={isGroupManagerOpen}
        onClose={function () { setIsGroupManagerOpen(false); }}
        session={session}
      />

      {isAdmin ? (
        <AdminSubscriptionsModal
          isOpen={isAdminSubscriptionsOpen}
          onClose={function () { setIsAdminSubscriptionsOpen(false); }}
        />
      ) : null}

      {taggingRoomId ? (
        <VisibilityTagModal
          isOpen={!!taggingRoomId}
          onClose={function () { setTaggingRoomId(null); }}
          session={session}
          contentType="room"
          contentId={taggingRoomId}
          contentTitle={(function () {
            var found = rooms.filter(function (r) { return r.id === taggingRoomId; })[0];
            return found ? found.name : '';
          })()}
          allowInviteOverride={(function () {
            var found = rooms.filter(function (r) { return r.id === taggingRoomId; })[0];
            return found ? found.allow_invite_override : true;
          })()}
        />
      ) : null}
    </div>
  );
}