import React, { useState, useEffect, useContext } from 'react';
import { SupabaseContext } from '../main';
import CreateRoomModal from './CreateRoomModal';

export default function RoomList({ onJoinRoom }) {
  const [rooms, setRooms] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const supabase = useContext(SupabaseContext);

  // פונקציה למשיכת החדרים מהדאטהבייס
  const fetchRooms = async () => {
    const { data, error } = await supabase
      .from('LiveRoom')
      .select('*');

    if (error) {
      console.error('Error fetching rooms:', error);
    } else {
      setRooms(data || []);
    }
  };

  // פונקציה למחיקת חדר
  const handleDeleteRoom = async (roomId) => {
    if (!confirm('האם את בטוחה שברצונך למחוק את החדר הזה?')) return;

    try {
      const { error } = await supabase
        .from('LiveRoom')
        .delete()
        .eq('id', roomId);

      if (error) throw error;

      // עדכון ה-State כדי להסיר את החדר מיד מהמסך
      setRooms(prevRooms => prevRooms.filter(room => room.id !== roomId));
    } catch (error) {
      console.error('Error deleting room:', error.message);
      alert('שגיאה במחיקת החדר');
    }
  };

  // משיכה ראשונית בטעינת הקומפוננטה
  useEffect(() => {
    fetchRooms();
  }, []);

  return (
    <div className="p-6 bg-background min-h-screen text-foreground" dir="rtl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">חדרי לייב פעילים</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2 rounded-lg font-bold text-sm transition"
        >
          + פתח חדר חדש
        </button>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
        {rooms.map((room) => (
          <div
            key={room.id}
            className="bg-card border border-border rounded-xl p-2.5 flex flex-col justify-between hover:border-primary/30 transition-all"
          >
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-live animate-live-pulse"></span>
                <span className="text-[10px] font-bold text-live">LIVE</span>
              </div>

              <h3 className="font-bold text-sm truncate mb-0.5">{room.name}</h3>
              <p className="text-[11px] text-muted-foreground truncate mb-2">מארחת: {room.host_username}</p>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => onJoinRoom(room)}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground py-1 rounded-md font-medium text-[11px] transition-all text-center"
              >
                הצטרפות
              </button>

              <button
                onClick={() => handleDeleteRoom(room.id)}
                title="מחק חדר"
                className="shrink-0 w-6 h-6 rounded-md bg-destructive/80 hover:bg-destructive text-white flex items-center justify-center text-[10px] transition-all"
              >
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>

      <CreateRoomModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onRoomCreated={fetchRooms}
      />
    </div>
  );
}