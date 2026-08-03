import React, { useState, useContext } from 'react';
import { SupabaseContext } from '../main';
import { getClientId } from '../lib/clientId';

export default function JoinRoomModal({ isOpen, room, onClose, onRequestSent, profile, session }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabase = useContext(SupabaseContext);

  if (!isOpen || !room) return null;

  const handleSendRequest = async () => {
    if (!profile || !profile.display_name) return alert('חסר שם תצוגה בפרופיל');

    setIsSubmitting(true);

    const { data, error } = await supabase
      .from('RoomJoinRequest')
      .insert([{
        room_id: room.id,
        requester_username: profile.display_name,
        requester_client_id: getClientId(),
        requester_user_id: session ? session.user.id : null,
        status: 'pending',
      }])
      .select()
      .single();

    setIsSubmitting(false);

    if (error) {
      console.error('Error creating join request:', error);
      alert('קרתה שגיאה בשליחת בקשת ההצטרפות: ' + error.message);
    } else {
      if (typeof onRequestSent === 'function') {
        onRequestSent(data);
      }
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 p-8 rounded-2xl w-full max-w-md text-white shadow-2xl">
        <h2 className="text-2xl font-bold mb-2">בקשת הצטרפות לחדר</h2>
        <p className="text-sm text-gray-400 mb-6">"{room.name}" · מנהל: {room.host_username}</p>

        <p className="text-sm text-gray-300 mb-6">
          הבקשה תישלח בשם: <span className="font-bold">{profile ? profile.display_name : '...'}</span>
        </p>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 bg-gray-700 hover:bg-gray-600 p-3 rounded-lg font-bold transition-colors disabled:opacity-50"
          >
            ביטול
          </button>
          <button
            onClick={handleSendRequest}
            disabled={isSubmitting}
            className="flex-1 bg-green-600 hover:bg-green-700 p-3 rounded-lg font-bold transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'שולח...' : 'שלח בקשת הצטרפות'}
          </button>
        </div>
      </div>
    </div>
  );
}