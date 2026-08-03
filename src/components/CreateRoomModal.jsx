import React, { useState, useContext } from 'react';
import { SupabaseContext } from '../main'; 
import { getClientId } from '../lib/clientId';

export default function CreateRoomModal({ isOpen, onClose, onRoomCreated, profile, session }) {
  const [roomName, setRoomName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabase = useContext(SupabaseContext);

  if (!isOpen) return null;

  const handleCreateRoom = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    if (!roomName) return alert('נא למלא את שם החדר');
    if (!profile || !profile.display_name) return alert('חסר שם תצוגה בפרופיל');

    setIsSubmitting(true);

    const { data, error } = await supabase
      .from('LiveRoom') 
      .insert([{
        name: roomName,
        host_username: profile.display_name,
        host_client_id: getClientId(),
        host_user_id: session ? session.user.id : null,
      }])
      .select()
      .single();

    setIsSubmitting(false);

    if (error) {
      console.error('Error creating room:', error);
      alert('קרתה שגיאה ביצירת החדר: ' + error.message);
    } else {
      if (typeof onRoomCreated === 'function') {
        onRoomCreated(data);
      }
      onClose(); 
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 p-8 rounded-2xl w-full max-w-md text-white shadow-2xl">
        <h2 className="text-2xl font-bold mb-6">פתח חדר לייב חדש</h2>
        
        <label className="block text-sm text-gray-400 mb-1">שם החדר *</label>
        <input 
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
          placeholder="למשל: סשן בטיסוקס ביוט" 
          className="w-full bg-gray-800 border border-gray-700 p-3 mb-6 rounded-lg focus:border-green-500 outline-none" 
        />

        <div className="flex gap-2">
          <button 
            onClick={onClose} 
            disabled={isSubmitting}
            className="flex-1 bg-gray-700 hover:bg-gray-600 p-3 rounded-lg font-bold transition-colors disabled:opacity-50"
          >
            ביטול
          </button>
          <button 
            onClick={handleCreateRoom} 
            disabled={isSubmitting}
            className="flex-1 bg-green-600 hover:bg-green-700 p-3 rounded-lg font-bold transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'יוצר...' : 'פתח חדר לייב'}
          </button>
        </div>
      </div>
    </div>
  );
}