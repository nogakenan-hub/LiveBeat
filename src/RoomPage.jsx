import React, { useState, useContext, useEffect, useRef, useCallback } from 'react';
import { SupabaseContext } from './main';
import * as nsfwjs from 'nsfwjs';
import '@tensorflow/tfjs';

// שרתי STUN ציבוריים וחינמיים של Google - בלי TURN בשלב הזה (החלטה מכוונת, ראו HANDOFF)
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

// בדיקת תוכן אוטומטית: כל כמה שניות בודקים פריים, וסף הוודאות שמפעיל חסימה
const MODERATION_CHECK_INTERVAL_MS = 12000;
const MODERATION_FLAGGED_CATEGORIES = ['Porn', 'Hentai', 'Sexy'];
const MODERATION_CONFIDENCE_THRESHOLD = 0.9;
const MODERATION_REQUIRED_CONSECUTIVE_FLAGS = 2; // דורשים זיהוי חוזר, לא מסתפקים בפריים בודד

const RoomPage = ({ room, session, profile, guestName, onLeaveRoom, onCloseRoom }) => {
  const supabase = useContext(SupabaseContext);
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [mediaError, setMediaError] = useState(null);
  const [remotePeers, setRemotePeers] = useState({}); // key -> { stream, name, isOwner }
  const [isMediaReady, setIsMediaReady] = useState(false);
  const [moderationWarning, setModerationWarning] = useState(null);
  const [moderationAlerts, setModerationAlerts] = useState([]); // גלוי רק למארחת - התראות על משתתפים אחרים
  const [messages, setMessages] = useState([]); // הודעות הצ'אט הטקסטואלי של החדר
  const [messageInput, setMessageInput] = useState('');

  const isOwner = session && room.host_user_id === session.user.id;
  const displayName = profile
    ? profile.display_name
    : (guestName ? guestName : (session ? session.user.email : 'אורח/ת'));

  const [presenceKey] = useState(() =>
    (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Math.random())
  );

  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const channelRef = useRef(null);
  const controlChannelRef = useRef(null); // ערוץ פרטי נפרד - רק לפקודת הסרה (kick), מוגן ב-RLS
  const peerConnectionsRef = useRef({}); // key -> RTCPeerConnection
  const moderationModelRef = useRef(null);
  const consecutiveFlagCountRef = useRef(0);
  const messagesEndRef = useRef(null); // עוגן לגלילה אוטומטית להודעה האחרונה

  // מטפלת בזיהוי תוכן פוגעני: עצירת מצלמה/מיקרופון מיידית + התראה למארחת
  const handleModerationFlag = useCallback((flagged) => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    setIsCameraOff(true);
    setIsMicMuted(true);
    setModerationWarning(
      'המצלמה והמיקרופון שלך נעצרו אוטומטית בעקבות זיהוי תוכן לא מתאים. המארחת קיבלה על כך התראה. כדי להמשיך, יש לצאת ולהצטרף מחדש לחדר.'
    );

    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'moderation-alert',
        payload: {
          from: presenceKey,
          fromName: displayName,
          category: flagged.className,
          confidence: flagged.probability,
          timestamp: new Date().toISOString(),
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presenceKey, displayName]);

  // יצירת חיבור עמית-לעמית חדש, כולל חיבור הזרם המקומי אליו
  const createPeerConnection = useCallback((peerKey, peerName, peerIsOwner) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'webrtc-signal',
          payload: {
            to: peerKey,
            from: presenceKey,
            kind: 'candidate',
            candidate: event.candidate,
          },
        });
      }
    };

    pc.ontrack = (event) => {
      setRemotePeers((prev) => ({
        ...prev,
        [peerKey]: {
          stream: event.streams[0],
          name: peerName,
          isOwner: peerIsOwner,
        },
      }));
    };

    peerConnectionsRef.current[peerKey] = pc;
    return pc;
  }, [presenceKey]);

  const closePeerConnection = useCallback((peerKey) => {
    const pc = peerConnectionsRef.current[peerKey];
    if (pc) {
      pc.close();
      delete peerConnectionsRef.current[peerKey];
    }
    setRemotePeers((prev) => {
      const next = { ...prev };
      delete next[peerKey];
      return next;
    });
  }, []);

  // הקמת מצלמה/מיקרופון מקומיים + ערוץ הנוכחות/סיגנלינג + ערוץ הבקרה הפרטי
  useEffect(() => {
    let cancelled = false;

    const setup = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        setIsMediaReady(true);
      } catch (err) {
        console.error('שגיאה בגישה למצלמה/מיקרופון:', err.message);
        if (!cancelled) {
          setMediaError('לא ניתן היה לגשת למצלמה/מיקרופון. ודאי שאישרת הרשאות בדפדפן ורענני את הדף.');
        }
      }

      if (cancelled) return;

      // ------------------------------------------------------------
      // ערוץ הבקרה הפרטי - room-control-{room.id}
      // מוגן ב-RLS: כתיבה (שליחת קוד kick) מותרת רק למארחת האמיתית,
      // מאומתת מול auth.uid() בשרת - לא ניתן לזיוף מהקונסול.
      // קריאה פתוחה לכולם (כולל אורחים) כדי שההסרה תעבוד עליהם.
      // ------------------------------------------------------------
      const controlChannel = supabase.channel('room-control-' + room.id, {
        config: { private: true },
      });
      controlChannelRef.current = controlChannel;

      controlChannel.on('broadcast', { event: 'room-kick' }, ({ payload }) => {
        if (payload && payload.to === presenceKey) {
          alert('הוסרת מהחדר על ידי המארחת.');
          onLeaveRoom();
        }
      });

      controlChannel.subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('שגיאה בהתחברות לערוץ הבקרה של החדר:', err && err.message);
        }
      });

      // ------------------------------------------------------------
      // הערוץ הציבורי הקיים - נוכחות, סיגנלינג WebRTC, התראות מודרציה
      // (ללא שינוי בהתנהגות)
      // ------------------------------------------------------------
      const channel = supabase.channel('room-presence-' + room.id, {
        config: { presence: { key: presenceKey } },
      });
      channelRef.current = channel;

      channel.on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const allEntries = Object.entries(state).map(([key, metas]) => ({
          key,
          name: metas[0].name,
          isOwner: metas[0].isOwner,
        }));
        setParticipants(allEntries);

        const currentKeys = new Set(allEntries.map((e) => e.key));

        // סגירת חיבורים למי שכבר לא בחדר
        Object.keys(peerConnectionsRef.current).forEach((key) => {
          if (!currentKeys.has(key)) {
            closePeerConnection(key);
          }
        });

        // יצירת חיבור לכל משתתף/ת חדש/ה שעדיין אין אליו/ה חיבור
        allEntries.forEach((entry) => {
          if (entry.key === presenceKey) return;
          if (peerConnectionsRef.current[entry.key]) return;

          // רק צד אחד יוזם הצעה (המפתח ה"קטן" יותר לקסיקוגרפית) - מונע התנגשות הצעות כפולות
          const shouldInitiate = presenceKey < entry.key;

          const pc = createPeerConnection(entry.key, entry.name, entry.isOwner);

          if (shouldInitiate) {
            pc.createOffer()
              .then((offer) => pc.setLocalDescription(offer).then(() => offer))
              .then((offer) => {
                channel.send({
                  type: 'broadcast',
                  event: 'webrtc-signal',
                  payload: {
                    to: entry.key,
                    from: presenceKey,
                    kind: 'offer',
                    sdp: offer,
                    fromName: displayName,
                    fromIsOwner: !!isOwner,
                  },
                });
              })
              .catch((err) => console.error('שגיאה ביצירת הצעת חיבור:', err.message));
          }
        });
      });

      channel.on('broadcast', { event: 'webrtc-signal' }, async ({ payload }) => {
        if (!payload || payload.to !== presenceKey) return;

        const { from, kind } = payload;
        let pc = peerConnectionsRef.current[from];

        if (kind === 'offer') {
          if (!pc) {
            pc = createPeerConnection(from, payload.fromName, payload.fromIsOwner);
          }
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            channel.send({
              type: 'broadcast',
              event: 'webrtc-signal',
              payload: {
                to: from,
                from: presenceKey,
                kind: 'answer',
                sdp: answer,
              },
            });
          } catch (err) {
            console.error('שגיאה בטיפול בהצעת חיבור נכנסת:', err.message);
          }
        } else if (kind === 'answer') {
          if (pc) {
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            } catch (err) {
              console.error('שגיאה בטיפול בתשובת חיבור:', err.message);
            }
          }
        } else if (kind === 'candidate') {
          if (pc && payload.candidate) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
            } catch (err) {
              console.error('שגיאה בהוספת מועמד רשת (ICE):', err.message);
            }
          }
        }
      });

      channel.on('broadcast', { event: 'moderation-alert' }, ({ payload }) => {
        if (!isOwner) return; // ההתראה רלוונטית רק למארחת החדר
        setModerationAlerts((prev) => [...prev, payload]);
      });

      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ name: displayName, isOwner: !!isOwner });
        }
      });
    };

    setup();

    return () => {
      cancelled = true;

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }

      Object.keys(peerConnectionsRef.current).forEach((key) => {
        peerConnectionsRef.current[key].close();
      });
      peerConnectionsRef.current = {};

      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      if (controlChannelRef.current) {
        supabase.removeChannel(controlChannelRef.current);
        controlChannelRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id, displayName, isOwner, presenceKey]);

  // טעינת מודל הבדיקה האוטומטית פעם אחת - רץ ברקע, לא חוסם את שאר הדף
  useEffect(() => {
    let cancelled = false;

    nsfwjs.load()
      .then((model) => {
        if (!cancelled) {
          moderationModelRef.current = model;
        }
      })
      .catch((err) => {
        console.error('שגיאה בטעינת מודל הבדיקה האוטומטית:', err.message);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // לולאת בדיקה תקופתית של פריים מהמצלמה שלי, כל עוד המדיה פעילה
  useEffect(() => {
    if (!isMediaReady) return;

    let cancelled = false;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const checkFrame = async () => {
      if (cancelled) return;
      if (isCameraOff) {
        consecutiveFlagCountRef.current = 0;
        return;
      }
      if (!moderationModelRef.current || !localVideoRef.current) return;

      const video = localVideoRef.current;
      if (video.readyState < 2 || video.videoWidth === 0) return; // עדיין אין מספיק נתונים בווידאו

      // בדיקת בהירות מהירה על פריים מוקטן - מדלגים על פריימים כמעט-שחורים
      // (מצלמה מכוסה, כשל טכני וכו') כי מודלים כאלה נוטים לטעות עליהם
      canvas.width = 64;
      canvas.height = 64;
      ctx.drawImage(video, 0, 0, 64, 64);
      const imageData = ctx.getImageData(0, 0, 64, 64).data;
      let brightnessSum = 0;
      for (let i = 0; i < imageData.length; i += 4) {
        brightnessSum += (imageData[i] + imageData[i + 1] + imageData[i + 2]) / 3;
      }
      const avgBrightness = brightnessSum / (imageData.length / 4);
      if (avgBrightness < 15) {
        consecutiveFlagCountRef.current = 0; // אין מספיק מידע בפריים הזה - לא סופרים ולא מאפסים לשווא
        return;
      }

      try {
        const predictions = await moderationModelRef.current.classify(video);
        const flagged = predictions.find(
          (p) =>
            MODERATION_FLAGGED_CATEGORIES.includes(p.className) &&
            p.probability > MODERATION_CONFIDENCE_THRESHOLD
        );

        if (flagged) {
          consecutiveFlagCountRef.current += 1;
          if (consecutiveFlagCountRef.current >= MODERATION_REQUIRED_CONSECUTIVE_FLAGS && !cancelled) {
            consecutiveFlagCountRef.current = 0;
            handleModerationFlag(flagged);
          }
        } else {
          consecutiveFlagCountRef.current = 0;
        }
      } catch (err) {
        console.error('שגיאה בבדיקת תוכן אוטומטית:', err.message);
      }
    };

    const intervalId = setInterval(checkFrame, MODERATION_CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [isMediaReady, isCameraOff, handleModerationFlag]);

  // טעינת היסטוריית הצ'אט + מנוי לעדכוני Realtime על הודעות חדשות בחדר הזה
  useEffect(() => {
    let cancelled = false;

    const loadMessages = async () => {
      const { data, error } = await supabase
        .from('room_messages')
        .select('*')
        .eq('room_id', room.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error("שגיאה בטעינת היסטוריית הצ'אט:", error.message);
        return;
      }
      if (!cancelled) {
        setMessages(data || []);
      }
    };

    loadMessages();

    const chatChannel = supabase
      .channel('room-messages-' + room.id)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'room_messages', filter: 'room_id=eq.' + room.id },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(chatChannel);
    };
  }, [room.id, supabase]);

  // גלילה אוטומטית להודעה האחרונה בכל פעם שמתווספת הודעה
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // שליחת הודעת צ'אט - sender_user_id אמיתי למחוברות, NULL לאורחים (תואם ל-RLS של room_messages)
  const handleSendMessage = async (e) => {
    e.preventDefault();
    const trimmed = messageInput.trim();
    if (!trimmed) return;

    setMessageInput('');

    const { error } = await supabase.from('room_messages').insert([{
      room_id: room.id,
      sender_user_id: session ? session.user.id : null,
      sender_display_name: displayName,
      content: trimmed,
    }]);

    if (error) {
      console.error('שגיאה בשליחת הודעה:', error.message);
      alert('קרתה שגיאה בשליחת ההודעה, נסי שוב.');
    }
  };

  const toggleMic = () => {
    if (!localStreamRef.current) return;
    const newMuted = !isMicMuted;
    localStreamRef.current.getAudioTracks().forEach((track) => { track.enabled = !newMuted; });
    setIsMicMuted(newMuted);
  };

  const toggleCamera = () => {
    if (!localStreamRef.current) return;
    const newOff = !isCameraOff;
    localStreamRef.current.getVideoTracks().forEach((track) => { track.enabled = !newOff; });
    setIsCameraOff(newOff);
  };

  const handleCloseClick = () => {
    const confirmed = window.confirm('האם לסגור את החדר? הוא יימחק לכולם.');
    if (confirmed && onCloseRoom) {
      onCloseRoom();
    }
  };

  // הסרת משתתף/ת מהחדר - זמין רק למארחת. עוברת דרך ערוץ הבקרה הפרטי
  // (room-control), שמאובטח ב-RLS כך שרק host_user_id אמיתי יכול לשלוח בפועל
  const handleKickParticipant = useCallback((peerKey, peerName) => {
    const confirmed = window.confirm(`להסיר את ${peerName} מהחדר?`);
    if (!confirmed) return;

    if (controlChannelRef.current) {
      controlChannelRef.current.send({
        type: 'broadcast',
        event: 'room-kick',
        payload: { to: peerKey },
      });
    }
  }, []);

  // דיווח על משתתף/ת - זמין לכל אחד, נשמר בטבלה נפרדת לבדיקה ידנית
  const handleReportParticipant = useCallback(async (peerName) => {
    const reason = window.prompt(`דיווח על ${peerName} - מה קרה? (הפרטים יישלחו למנהלת הפלטפורמה)`);
    if (!reason) return;

    try {
      const { error } = await supabase.from('RoomReport').insert([{
        room_id: room.id,
        reporter_display_name: displayName,
        reported_display_name: peerName,
        reason,
      }]);
      if (error) throw error;
      alert('הדיווח נשלח, תודה.');
    } catch (err) {
      console.error('שגיאה בשליחת דיווח:', err.message);
      alert('קרתה שגיאה בשליחת הדיווח, נסי שוב.');
    }
  }, [room.id, displayName, supabase]);

  const handleInviteClick = async () => {
    setIsCreatingInvite(true);

    try {
      const { data, error } = await supabase
        .from('RoomInvite')
        .insert([{ room_id: room.id }])
        .select()
        .single();

      if (error) throw error;

      const inviteUrl = window.location.origin + '/?invite=' + data.id;

      await navigator.clipboard.writeText(inviteUrl);
      alert('קישור ההזמנה הועתק! שלחי אותו למי שאת רוצה להזמין - הקישור עובד פעם אחת בלבד.');
    } catch (error) {
      console.error('שגיאה ביצירת קישור הזמנה:', error.message);
      alert('קרתה שגיאה ביצירת קישור ההזמנה');
    } finally {
      setIsCreatingInvite(false);
    }
  };

  const remotePeerList = Object.entries(remotePeers);

  return (
    <div className="flex flex-col h-screen bg-[#0f1115] text-white overflow-hidden" dir="rtl">

      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-[#2a2e35] bg-[#12151a] flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 bg-green-900/40 text-green-400 text-xs font-bold px-2.5 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
            LIVE
          </span>
        </div>

        <div className="text-center flex-1 min-w-0">
          <p className="font-bold text-sm truncate">{room.name}</p>
          <p className="text-xs text-gray-400">בניהול {room.host_username} · {participants.length} משתתפים</p>
        </div>

        <div className="flex items-center gap-2">
          {isOwner && (
            <button
              onClick={handleInviteClick}
              disabled={isCreatingInvite}
              className="hidden sm:inline-block bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-50"
            >
              {isCreatingInvite ? 'יוצרת...' : 'הזמן משתתפים'}
            </button>
          )}
          {isOwner && (
            <button
              onClick={handleCloseClick}
              className="hidden sm:inline-block bg-red-900/60 hover:bg-red-800 px-3 py-1.5 rounded-lg text-xs font-medium transition"
            >
              סגור לכולם
            </button>
          )}
          <button
            onClick={onLeaveRoom}
            className="bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg text-xs font-medium transition"
          >
            יציאה מהחדר
          </button>
        </div>
      </header>

      {/* באנר שגיאת מדיה - מוצג רק אם באמת נכשלה הגישה למצלמה/מיקרופון */}
      {mediaError && (
        <div className="bg-red-950/60 border-b border-red-900/50 px-4 py-2 text-center text-xs text-red-300 flex items-center justify-center gap-2">
          <span>⚠️</span>
          <span>{mediaError}</span>
        </div>
      )}

      {/* אזהרה אישית - מוצגת רק למי שהמצלמה/מיקרופון שלה נעצרו ע"י הבדיקה האוטומטית */}
      {moderationWarning && (
        <div className="bg-red-950/80 border-b border-red-900/50 px-4 py-2 text-center text-xs text-red-200 flex items-center justify-center gap-2">
          <span>🚫</span>
          <span>{moderationWarning}</span>
        </div>
      )}

      {/* פאנל התראות - גלוי רק למארחת, מציג דיווחים על משתתפים אחרים */}
      {isOwner && moderationAlerts.length > 0 && (
        <div className="bg-yellow-950/60 border-b border-yellow-900/50 px-4 py-2 text-xs text-yellow-200">
          {moderationAlerts.map((alert, i) => (
            <div key={i} className="flex items-center justify-between gap-2 py-0.5">
              <span>
                ⚠️ {alert.fromName} - זוהה תוכן חשוד (קטגוריה: {alert.category}, ודאות: {Math.round(alert.confidence * 100)}%)
              </span>
              <button
                onClick={() => setModerationAlerts((prev) => prev.filter((_, idx) => idx !== i))}
                className="text-yellow-400 hover:text-yellow-100 shrink-0"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden relative">

        {/* אזור הווידאו הראשי */}
        <main className="flex-1 flex flex-col items-center justify-center relative p-6 overflow-y-auto">
          <div className="flex flex-wrap gap-4 justify-center items-center">

            {/* תצוגת עצמי */}
            <div className="relative w-80 h-52 bg-[#181b20] border border-[#2a2e35] rounded-xl overflow-hidden flex items-center justify-center">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }}
              />
              <span className="absolute top-2 right-2 bg-black/60 text-[10px] px-2 py-0.5 rounded-full">
                את · {displayName}
              </span>
              {isOwner && (
                <span className="absolute top-2 left-2 bg-purple-700 text-[10px] px-2 py-0.5 rounded-full">
                  מנהלת
                </span>
              )}
              {(isMicMuted || isCameraOff) && (
                <span className="absolute bottom-2 right-2 bg-red-700/90 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                  {isMicMuted && '🔇'}
                  {isCameraOff && '📷🚫'}
                </span>
              )}
            </div>

            {/* תצוגת משתתפים מרוחקים */}
            {remotePeerList.map(([key, peer]) => (
              <RemoteVideoTile
                key={key}
                peerKey={key}
                peer={peer}
                isRoomOwner={isOwner}
                onKick={handleKickParticipant}
                onReport={handleReportParticipant}
              />
            ))}
          </div>

          <div className="mt-8 flex gap-4">
            <button
              onClick={toggleMic}
              className={
                'flex items-center gap-2 px-5 py-2.5 rounded-full text-sm transition ' +
                (isMicMuted
                  ? 'bg-red-700 hover:bg-red-600'
                  : 'bg-[#252a31] hover:bg-[#2f353d]')
              }
            >
              🎤 {isMicMuted ? 'בטל השתקה' : 'השתק'}
            </button>
            <button
              onClick={toggleCamera}
              className={
                'flex items-center gap-2 px-5 py-2.5 rounded-full text-sm transition ' +
                (isCameraOff
                  ? 'bg-red-700 hover:bg-red-600'
                  : 'bg-[#252a31] hover:bg-[#2f353d]')
              }
            >
              🎥 {isCameraOff ? 'הפעל מצלמה' : 'כבה מצלמה'}
            </button>
          </div>
        </main>

        {/* Chat toggle button - always visible */}
        <button
          onClick={() => setIsChatOpen(prev => !prev)}
          className="absolute top-4 left-4 z-20 bg-[#252a31] hover:bg-[#2f353d] p-4 rounded-full shadow-lg text-lg"
          title={isChatOpen ? 'סגור צ׳אט' : 'פתח צ׳אט'}
        >
          💬
        </button>

        {/* Sidebar Chat - collapsible, overlay on mobile */}
        {isChatOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/60 z-30 sm:hidden"
              onClick={() => setIsChatOpen(false)}
            />

            <aside
              className="
                fixed sm:relative
                inset-y-0 left-0 sm:inset-auto
                w-full sm:w-72
                border-l border-[#2a2e35] flex flex-col bg-[#14171c]
                z-40 sm:z-auto
              "
            >
              <div className="p-4 border-b border-[#2a2e35] font-bold flex items-center justify-between">
                צ'אט חי
                <button
                  onClick={() => setIsChatOpen(false)}
                  className="sm:hidden text-gray-400 text-lg"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-2">
                {messages.length === 0 && (
                  <p className="text-xs text-gray-500 text-center mt-4">אין עדיין הודעות. תהיי הראשונה לכתוב :)</p>
                )}
                {messages.map((msg) => {
                  const isMine = session
                    ? msg.sender_user_id === session.user.id
                    : (!msg.sender_user_id && msg.sender_display_name === displayName);
                  return (
                    <div key={msg.id} className={'flex flex-col ' + (isMine ? 'items-start' : 'items-end')}>
                      <span className="text-[10px] text-gray-500 px-1">{msg.sender_display_name}</span>
                      <span
                        className={
                          'max-w-[85%] rounded-xl px-3 py-1.5 text-xs break-words ' +
                          (isMine ? 'bg-[#252a31] text-white' : 'bg-blue-600 text-white')
                        }
                      >
                        {msg.content}
                      </span>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={handleSendMessage} className="flex border-t border-[#2a2e35]">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="כתוב הודעה..."
                  className="flex-1 p-4 bg-[#1c2026] outline-none text-white placeholder-gray-400 text-sm"
                />
                <button
                  type="submit"
                  disabled={!messageInput.trim()}
                  className="px-4 bg-[#1c2026] text-blue-400 disabled:opacity-40 text-sm font-medium"
                >
                  שלח
                </button>
              </form>
            </aside>
          </>
        )}
      </div>
    </div>
  );
};

// תצוגת וידאו של משתתף/ת מרוחק/ת - קומפוננטה נפרדת כדי ש-srcObject יתעדכן נכון בכל שינוי stream
const RemoteVideoTile = ({ peerKey, peer, isRoomOwner, onKick, onReport }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && peer.stream) {
      videoRef.current.srcObject = peer.stream;
    }
  }, [peer.stream]);

  return (
    <div className="relative w-80 h-52 bg-[#181b20] border border-[#2a2e35] rounded-xl overflow-hidden flex items-center justify-center">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />
      <span className="absolute top-2 right-2 bg-black/60 text-[10px] px-2 py-0.5 rounded-full">
        {peer.name}
      </span>
      {peer.isOwner && (
        <span className="absolute top-2 left-2 bg-purple-700 text-[10px] px-2 py-0.5 rounded-full">
          מנהל
        </span>
      )}
      <div className="absolute bottom-2 left-2 flex gap-1">
        <button
          onClick={() => onReport(peerKey, peer.name)}
          className="bg-black/60 hover:bg-black/80 text-[10px] px-2 py-1 rounded-full"
          title="דיווח על משתתף/ת זו"
        >
          🚩 דווח
        </button>
        {isRoomOwner && (
          <button
            onClick={() => onKick(peerKey, peer.name)}
            className="bg-red-700/80 hover:bg-red-600 text-[10px] px-2 py-1 rounded-full"
            title="הסרה מהחדר"
          >
            ⛔ הסר
          </button>
        )}
      </div>
    </div>
  );
};

export default RoomPage;