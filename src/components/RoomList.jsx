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
    <div className="p-6 bg-[#1a1d21] min-h-screen text-white" dir="rtl">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">חדרי לייב פעילים</h1>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded-lg font-bold transition"
        >
          + פתח חדר חדש
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {rooms.map((room) => (
          <div key={room.id} className="bg-gray-800 p-4 rounded-xl border border-gray-700 flex flex-col justify-between min-h-[160px]">
            <div>
              <h3 className="text-xl font-bold mb-2">{room.name}</h3>
              <p className="text-gray-400 text-sm mb-4">מארח: {room.host_username}</p>
            </div>
            
            {/* שורת הכפתורים - מבטיחה ששניהם יוצגו זה לצד זה בבירור */}
            <div className="flex items-center gap-2 w-full mt-auto">
              <button 
                onClick={() => onJoinRoom(room)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium transition-all text-center"
              >
                הצטרף לחדר
              </button>
              
              <button 
                onClick={() => handleDeleteRoom(room.id)}
                className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg transition-all flex items-center justify-center min-w-[40px] h-[40px]"
                title="מחק חדר"
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