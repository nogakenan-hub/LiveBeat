import React, { createContext, useState, useEffect, useRef } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import RoomPage from './RoomPage.jsx'
import CreateRoomModal from './components/CreateRoomModal.jsx'
import JoinRoomModal from './components/JoinRoomModal.jsx'
import AuthModal from './components/AuthModal.jsx'
import ProfileSetupModal from './components/ProfileSetupModal.jsx'
import EditProfileModal from './components/EditProfileModal.jsx'
import DeleteAccountConfirmModal from './components/DeleteAccountConfirmModal.jsx'
import PendingRequestsBanner from './components/PendingRequestsBanner.jsx'
import GuestJoinModal from './components/GuestJoinModal.jsx'
import UploadSketchModal from './components/UploadSketchModal.jsx'
import InboxModal from './components/InboxModal.jsx'
import DirectMessageModal from './components/DirectMessageModal.jsx'
import PublicProfileModal from './components/PublicProfileModal.jsx'
import { supabase } from './lib/supabaseClient'
import { saveGuestRoomAccess, getGuestRoomName, getAllGuestRooms } from './lib/guestAccess'
import './index.css'

export const SupabaseContext = createContext(supabase);

function RootComponent() {
  const [rooms, setRooms] = useState([]);
  const [sketches, setSketches] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [guestName, setGuestName] = useState(null);

  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [professionalProfile, setProfessionalProfile] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [joinRequestRoom, setJoinRequestRoom] = useState(null);
  const [pendingRoomIds, setPendingRoomIds] = useState(function () { return new Set(); });
  const [approvedRoomIds, setApprovedRoomIds] = useState(function () { return new Set(); });
  const [guestRoomIds, setGuestRoomIds] = useState(function () { return new Set(Object.keys(getAllGuestRooms())); });
  const [pendingRequests, setPendingRequests] = useState([]);

  const [pendingAction, setPendingAction] = useState(null);
  const [pendingInvite, setPendingInvite] = useState(null);

  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [isInboxOpen, setIsInboxOpen] = useState(false);
  const [activeConversation, setActiveConversation] = useState(null);
  const [viewingProfileUserId, setViewingProfileUserId] = useState(null);

  const roomsRef = useRef(rooms);
  useEffect(function () {
    roomsRef.current = rooms;
  }, [rooms]);

  const sessionRef = useRef(session);
  useEffect(function () {
    sessionRef.current = session;
  }, [session]);

  function fetchRooms() {
    return supabase.from('LiveRoom').select('*').then(function (result) {
      if (result.data) setRooms(result.data);
      return result.data || [];
    });
  }

  function fetchSketches() {
    supabase
      .from('Sketch')
      .select('*')
      .order('created_at', { ascending: false })
      .then(function (result) {
        if (result.data) setSketches(result.data);
      });
  }

  function fetchProfile(userId) {
    return supabase
      .from('Profile')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
      .then(function (result) {
        setProfile(result.data || null);
      });
  }

  function fetchProfessionalProfile(userId) {
    return supabase
      .from('ProfessionalProfile')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
      .then(function (result) {
        setProfessionalProfile(result.data || null);
      });
  }

  function fetchPendingRequests(userId) {
    if (!userId) {
      setPendingRequests([]);
      return;
    }

    const ownedRoomIds = roomsRef.current
      .filter(function (r) { return r.host_user_id === userId; })
      .map(function (r) { return r.id; });

    if (ownedRoomIds.length === 0) {
      setPendingRequests([]);
      return;
    }

    supabase
      .from('RoomJoinRequest')
      .select('*')
      .eq('status', 'pending')
      .in('room_id', ownedRoomIds)
      .then(function (result) {
        if (result.data) {
          const withRoomName = result.data.map(function (req) {
            const room = roomsRef.current.find(function (r) { return r.id === req.room_id; });
            const copy = Object.assign({}, req);
            copy.room_name = room ? room.name : '';
            return copy;
          });
          setPendingRequests(withRoomName);
        }
      });
  }

  function fetchApprovedRoomIds(userId) {
    if (!userId) {
      setApprovedRoomIds(new Set());
      return;
    }

    supabase
      .from('RoomJoinRequest')
      .select('room_id')
      .eq('requester_user_id', userId)
      .eq('status', 'approved')
      .then(function (result) {
        if (result.data) {
          setApprovedRoomIds(new Set(result.data.map(function (r) { return r.room_id; })));
        }
      });
  }

  function fetchUnreadCount(userId) {
    supabase
      .from('DirectMessage')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', userId)
      .is('read_at', null)
      .then(function (result) {
        setUnreadMessageCount(result.count || 0);
      });
  }

  function checkInviteInUrl() {
    const params = new URLSearchParams(window.location.search);
    const inviteId = params.get('invite');
    if (!inviteId) return;

    supabase
      .from('RoomInvite')
      .select('*')
      .eq('id', inviteId)
      .maybeSingle()
      .then(function (inviteResult) {
        if (inviteResult.error || !inviteResult.data || inviteResult.data.used) {
          alert('קישור ההזמנה לא תקין או שכבר נוצל.');
          window.history.replaceState({}, '', window.location.pathname);
          return;
        }

        const invite = inviteResult.data;

        supabase
          .from('LiveRoom')
          .select('*')
          .eq('id', invite.room_id)
          .maybeSingle()
          .then(function (roomResult) {
            if (!roomResult.data) {
              alert('החדר שאליו הוזמנת כבר לא קיים.');
              window.history.replaceState({}, '', window.location.pathname);
              return;
            }

            setPendingInvite({ inviteId: invite.id, room: roomResult.data });
          });
      });
  }

  useEffect(function () {
    fetchRooms();
    fetchSketches();
    checkInviteInUrl();

    supabase.auth.getSession().then(function (result) {
      const currentSession = result.data.session;
      setSession(currentSession);
      if (currentSession) {
        fetchProfile(currentSession.user.id).then(function () {
          setAuthChecked(true);
        });
        fetchProfessionalProfile(currentSession.user.id);
        fetchUnreadCount(currentSession.user.id);
      } else {
        setAuthChecked(true);
      }
    });

    const authListenerResult = supabase.auth.onAuthStateChange(function (event, newSession) {
      setSession(newSession);
      if (newSession) {
        fetchProfile(newSession.user.id);
        fetchProfessionalProfile(newSession.user.id);
        fetchUnreadCount(newSession.user.id);
      } else {
        setProfile(null);
        setProfessionalProfile(null);
        setPendingRequests([]);
        setApprovedRoomIds(new Set());
        setUnreadMessageCount(0);
      }
    });

    return function () {
      authListenerResult.data.subscription.unsubscribe();
    };
  }, []);

  // --- Realtime subscription לחדרי לייב (LiveRoom) ---
  // בלי זה, חדר חדש שנוצר ע"י משתמשת אחרת לא מופיע עד לרענון ידני.
  // מטפל ב-INSERT/UPDATE/DELETE ומעדכן את ה-state המקומי ישירות,
  // בלי לקרוא ל-fetchRooms מחדש בכל שינוי (חוסך שאילתה מיותרת).
  useEffect(function () {
    const channel = supabase
      .channel('live-room-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'LiveRoom' }, function (payload) {
        if (payload.eventType === 'INSERT') {
          setRooms(function (prev) {
            const alreadyExists = prev.some(function (r) { return r.id === payload.new.id; });
            if (alreadyExists) return prev;
            return [payload.new].concat(prev);
          });
        } else if (payload.eventType === 'UPDATE') {
          setRooms(function (prev) {
            return prev.map(function (r) {
              return r.id === payload.new.id ? payload.new : r;
            });
          });
        } else if (payload.eventType === 'DELETE') {
          setRooms(function (prev) {
            return prev.filter(function (r) { return r.id !== payload.old.id; });
          });
        }
      })
      .subscribe();

    return function () {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(function () {
    const channel = supabase
      .channel('room-join-requests-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'RoomJoinRequest' }, function (payload) {
        const currentSession = sessionRef.current;

        if (currentSession) {
          fetchPendingRequests(currentSession.user.id);
          fetchApprovedRoomIds(currentSession.user.id);
        }

        if (
          payload.eventType === 'UPDATE' &&
          payload.new &&
          payload.new.status === 'approved' &&
          currentSession &&
          payload.new.requester_user_id === currentSession.user.id
        ) {
          const room = roomsRef.current.find(function (r) { return r.id === payload.new.room_id; });
          if (room) {
            setSelectedRoom(room);
          } else {
            supabase
              .from('LiveRoom')
              .select('*')
              .eq('id', payload.new.room_id)
              .single()
              .then(function (result) {
                if (result.data) setSelectedRoom(result.data);
              });
          }
        }
      })
      .subscribe();

    return function () {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(function () {
    if (session) {
      fetchPendingRequests(session.user.id);
      fetchApprovedRoomIds(session.user.id);
    }
  }, [session, rooms]);

  useEffect(function () {
    const channel = supabase
      .channel('direct-message-inbox')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'DirectMessage' }, function (payload) {
        const currentSession = sessionRef.current;
        if (currentSession && payload.new.recipient_id === currentSession.user.id) {
          setUnreadMessageCount(function (prev) { return prev + 1; });
        }
      })
      .subscribe();

    return function () {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(function () {
    if (!pendingAction) return;
    if (!session) return;
    if (!profile) return;

    if (pendingAction === 'create') {
      setIsModalOpen(true);
    } else if (pendingAction === 'upload') {
      setIsUploadModalOpen(true);
    } else if (pendingAction.type === 'join') {
      setJoinRequestRoom(pendingAction.room);
    }
    setPendingAction(null);
    setIsAuthModalOpen(false);
  }, [session, profile]);

  function handleRoomCreated(newRoom) {
    fetchRooms();
    if (newRoom) {
      setSelectedRoom(newRoom);
    }
  }

  function handleSketchUploaded(newSketch) {
    setSketches(function (prev) {
      return [newSketch].concat(prev);
    });
  }

  function handleDeleteSketch(sketch) {
    supabase
      .from('Sketch')
      .delete()
      .eq('id', sketch.id)
      .then(function (result) {
        if (result.error) {
          console.error('שגיאה במחיקת הקטע:', result.error.message);
          alert('קרתה שגיאה במחיקת הקטע');
          return;
        }
        setSketches(function (prev) {
          return prev.filter(function (s) { return s.id !== sketch.id; });
        });
      });
  }

  function handleUpdateSketch(updatedSketch) {
    setSketches(function (prev) {
      return prev.map(function (s) {
        if (s.id === updatedSketch.id) {
          return updatedSketch;
        }
        return s;
      });
    });
  }

  function handleLeaveRoom() {
    setSelectedRoom(null);
    setGuestName(null);
  }

  function handleCloseRoom() {
    if (!selectedRoom) return;

    supabase
      .from('LiveRoom')
      .delete()
      .eq('id', selectedRoom.id)
      .then(function (result) {
        if (result.error) {
          console.error('שגיאה בסגירת החדר:', result.error.message);
          alert('קרתה שגיאה בסגירת החדר');
        } else {
          fetchRooms();
        }
      });

    setSelectedRoom(null);
    setGuestName(null);
  }

  function handleDeleteRoom(roomId) {
    supabase
      .from('LiveRoom')
      .delete()
      .eq('id', roomId)
      .then(function (result) {
        if (result.error) {
          console.error('שגיאה במחיקת החדר:', result.error.message);
          alert('קרתה שגיאה במחיקת החדר');
          return;
        }
        fetchRooms();
      });
  }

  function handleOpenCreateModal() {
    if (!session) {
      setPendingAction('create');
      setIsAuthModalOpen(true);
    } else if (!profile) {
      setPendingAction('create');
    } else {
      setIsModalOpen(true);
    }
  }

  function handleOpenUploadModal() {
    if (!session) {
      setPendingAction('upload');
      setIsAuthModalOpen(true);
    } else if (!profile) {
      setPendingAction('upload');
    } else {
      setIsUploadModalOpen(true);
    }
  }

  function handleRequestJoin(room) {
    if (!session) {
      setPendingAction({ type: 'join', room: room });
      setIsAuthModalOpen(true);
    } else if (!profile) {
      setPendingAction({ type: 'join', room: room });
    } else {
      setJoinRequestRoom(room);
    }
  }

  function handleEnterRoom(room) {
    const isOwnerOrAuthGuest = session && (room.host_user_id === session.user.id || approvedRoomIds.has(room.id));

    if (!isOwnerOrAuthGuest) {
      const storedName = getGuestRoomName(room.id);
      if (storedName) {
        setGuestName(storedName);
      }
    }

    setSelectedRoom(room);
  }

  function handleProfileSaved(newProfile) {
    setProfile(newProfile);
  }

  function handleProfileUpdated(updatedProfile) {
    setProfile(updatedProfile);
  }

  function handleProfessionalProfileUpdated(updatedProfessionalProfile) {
    if (updatedProfessionalProfile) {
      setProfessionalProfile(updatedProfessionalProfile);
    }
  }

  function handleRequestSent(requestData) {
    setPendingRoomIds(function (prev) {
      const next = new Set(prev);
      next.add(requestData.room_id);
      return next;
    });
  }

  function handleOpenAuth() {
    setIsAuthModalOpen(true);
  }

  function handleOpenEditProfile() {
    setIsEditProfileOpen(true);
  }

  function handleOpenDeleteAccount() {
    setIsDeleteAccountModalOpen(true);
  }

  function handleDeactivateAccount() {
    supabase
      .from('Profile')
      .update({ deactivated_at: new Date().toISOString() })
      .eq('id', profile.id)
      .select()
      .single()
      .then(function (result) {
        if (result.error) {
          console.error('שגיאה בהשהיית החשבון:', result.error.message);
          alert('קרתה שגיאה בהשהיית החשבון: ' + result.error.message);
          return;
        }
        setProfile(result.data);
      });
  }

  function handleOpenInbox() {
    setIsInboxOpen(true);
  }

  function handleCloseInbox() {
    setIsInboxOpen(false);
  }

  function handleOpenConversation(partnerId, partnerUsername) {
    setActiveConversation({ partnerId: partnerId, partnerUsername: partnerUsername });
    setIsInboxOpen(false);
  }

  function handleCloseConversation() {
    setActiveConversation(null);
    if (session) {
      fetchUnreadCount(session.user.id);
    }
  }

  function handleOpenProfile(userId) {
    setViewingProfileUserId(userId);
  }

  function handleCloseProfile() {
    setViewingProfileUserId(null);
  }

  function handleSignOut() {
    supabase.auth.signOut().then(function () {
      setSession(null);
      setProfile(null);
      setProfessionalProfile(null);
    });
  }

  function handleApproveRequest(request) {
    supabase
      .from('RoomJoinRequest')
      .update({ status: 'approved' })
      .eq('id', request.id)
      .then(function (updateResult) {
        if (updateResult.error) {
          console.error('שגיאה באישור הבקשה:', updateResult.error.message);
          alert('קרתה שגיאה באישור הבקשה');
          return;
        }

        supabase
          .from('Room_Participant')
          .insert([{
            room_id: request.room_id,
            username: request.requester_username,
            room_name: request.room_name,
          }])
          .then(function (insertResult) {
            if (insertResult.error) {
              console.error('שגיאה באישור הבקשה:', insertResult.error.message);
              alert('קרתה שגיאה באישור הבקשה');
              return;
            }
            fetchPendingRequests(session.user.id);
          });
      });
  }

  function handleRejectRequest(request) {
    supabase
      .from('RoomJoinRequest')
      .update({ status: 'rejected' })
      .eq('id', request.id)
      .then(function (result) {
        if (result.error) {
          console.error('שגיאה בדחיית הבקשה:', result.error.message);
          alert('קרתה שגיאה בדחיית הבקשה');
          return;
        }
        fetchPendingRequests(session.user.id);
      });
  }

  function handleGuestJoin(name) {
    if (!pendingInvite) return;

    supabase
      .from('RoomInvite')
      .update({ used: true })
      .eq('id', pendingInvite.inviteId)
      .then(function () {
        saveGuestRoomAccess(pendingInvite.room.id, name);
        setGuestRoomIds(new Set(Object.keys(getAllGuestRooms())));

        setGuestName(name);
        setSelectedRoom(pendingInvite.room);
        setPendingInvite(null);
        window.history.replaceState({}, '', window.location.pathname);
      });
  }

  return (
    <SupabaseContext.Provider value={supabase}>
      {selectedRoom ? (
        <RoomPage
          room={selectedRoom}
          session={session}
          profile={profile}
          guestName={guestName}
          onLeaveRoom={handleLeaveRoom}
          onCloseRoom={handleCloseRoom}
        />
      ) : (
        <React.Fragment>
          <App
            rooms={rooms}
            sketches={sketches}
            onOpenCreateModal={handleOpenCreateModal}
            onDeleteRoom={handleDeleteRoom}
            onRequestJoin={handleRequestJoin}
            onEnterRoom={handleEnterRoom}
            onOpenUploadModal={handleOpenUploadModal}
            onDeleteSketch={handleDeleteSketch}
            onUpdateSketch={handleUpdateSketch}
            pendingRoomIds={pendingRoomIds}
            approvedRoomIds={approvedRoomIds}
            guestRoomIds={guestRoomIds}
            session={session}
            profile={profile}
            onOpenAuth={handleOpenAuth}
            onSignOut={handleSignOut}
            onOpenEditProfile={handleOpenEditProfile}
            onOpenDeleteAccount={handleOpenDeleteAccount}
            onDeactivateAccount={handleDeactivateAccount}
            unreadMessageCount={unreadMessageCount}
            onOpenInbox={handleOpenInbox}
            onOpenDirectMessage={handleOpenConversation}
            onOpenProfile={handleOpenProfile}
          />
          <CreateRoomModal
            isOpen={isModalOpen}
            onClose={function () { setIsModalOpen(false); }}
            onRoomCreated={handleRoomCreated}
            profile={profile}
            session={session}
          />
          <UploadSketchModal
            isOpen={isUploadModalOpen}
            onClose={function () { setIsUploadModalOpen(false); }}
            onSketchUploaded={handleSketchUploaded}
            profile={profile}
            session={session}
          />
          <JoinRoomModal
            isOpen={!!joinRequestRoom}
            room={joinRequestRoom}
            onClose={function () { setJoinRequestRoom(null); }}
            onRequestSent={handleRequestSent}
            profile={profile}
            session={session}
          />
          <AuthModal
            isOpen={isAuthModalOpen}
            onClose={function () {
              setIsAuthModalOpen(false);
              setPendingAction(null);
            }}
          />
          <EditProfileModal
            isOpen={isEditProfileOpen}
            profile={profile}
            professionalProfile={professionalProfile}
            onClose={function () { setIsEditProfileOpen(false); }}
            onProfileUpdated={handleProfileUpdated}
            onProfessionalProfileUpdated={handleProfessionalProfileUpdated}
          />
          <DeleteAccountConfirmModal
            isOpen={isDeleteAccountModalOpen}
            onClose={function () { setIsDeleteAccountModalOpen(false); }}
          />
          <InboxModal
            isOpen={isInboxOpen}
            currentUserId={session ? session.user.id : null}
            onClose={handleCloseInbox}
            onOpenConversation={handleOpenConversation}
          />
          <DirectMessageModal
            isOpen={!!activeConversation}
            currentUserId={session ? session.user.id : null}
            currentUsername={profile ? profile.display_name : (session ? session.user.email : '')}
            partnerId={activeConversation ? activeConversation.partnerId : null}
            partnerUsername={activeConversation ? activeConversation.partnerUsername : ''}
            onClose={handleCloseConversation}
          />
          <PublicProfileModal
            isOpen={!!viewingProfileUserId}
            userId={viewingProfileUserId}
            currentUserId={session ? session.user.id : null}
            onClose={handleCloseProfile}
            onOpenDirectMessage={handleOpenConversation}
          />
          {session && !profile && authChecked && (pendingAction || isModalOpen || joinRequestRoom || isUploadModalOpen) ? (
            <ProfileSetupModal
              isOpen={true}
              userId={session.user.id}
              onClose={function () { setPendingAction(null); }}
              onProfileSaved={handleProfileSaved}
              onProfessionalProfileSaved={handleProfessionalProfileUpdated}
            />
          ) : null}
        </React.Fragment>
      )}

      <GuestJoinModal
        isOpen={!!pendingInvite}
        roomName={pendingInvite ? pendingInvite.room.name : ''}
        onJoin={handleGuestJoin}
      />

      <PendingRequestsBanner
        requests={pendingRequests}
        onApprove={handleApproveRequest}
        onReject={handleRejectRequest}
      />
    </SupabaseContext.Provider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RootComponent />
  </React.StrictMode>
)