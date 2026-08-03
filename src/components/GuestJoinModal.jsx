import React, { useState } from 'react';

export default function GuestJoinModal({ isOpen, roomName, onJoin }) {
  const [guestName, setGuestName] = useState('');

  if (!isOpen) return null;

  const handleJoinClick = (e) => {
    if (e && e.preventDefault) e.preventDefault();

    if (!guestName) return alert('נא להזין שם');

    onJoin(guestName);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 p-8 rounded-2xl w-full max-w-md text-white shadow-2xl">
        <h2 className="text-2xl font-bold mb-2">הוזמנת לחדר!</h2>
        <p className="text-sm text-gray-400 mb-6">
          {roomName ? `"${roomName}"` : 'טוענת פרטי חדר...'}
        </p>

        <label className="block text-sm text-gray-400 mb-1">איך קוראים לך? *</label>
        <input
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          placeholder="השם שיוצג לאחרים בחדר"
          className="w-full bg-gray-800 border border-gray-700 p-3 mb-6 rounded-lg focus:border-green-500 outline-none"
        />

        <button
          onClick={handleJoinClick}
          className="w-full bg-green-600 hover:bg-green-700 p-3 rounded-lg font-bold transition-colors"
        >
          הצטרפות לחדר
        </button>
      </div>
    </div>
  );
}