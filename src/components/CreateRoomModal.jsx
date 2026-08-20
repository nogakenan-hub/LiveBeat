import React, { useState, useContext, useEffect } from 'react';
import { SupabaseContext } from '../main';
import { getClientId } from '../lib/clientId';

export default function CreateRoomModal(props) {
  var isOpen = props.isOpen;
  var onClose = props.onClose;
  var onRoomCreated = props.onRoomCreated;
  var profile = props.profile;
  var session = props.session;
  var sketchId = props.sketchId || null; // אופציונלי - כשהחדר נפתח מתוך סקיצה ספציפית (כפתור "פתח חדר" בכרטיס)
  var sketchTitle = props.sketchTitle || '';

  var supabase = useContext(SupabaseContext);

  var roomNameState = useState('');
  var roomName = roomNameState[0];
  var setRoomName = roomNameState[1];

  var isSubmittingState = useState(false);
  var isSubmitting = isSubmittingState[0];
  var setIsSubmitting = isSubmittingState[1];

  // כשנפתח מתוך סקיצה עם כותרת - מציעות שם ברירת מחדל לחדר, ניתן לעריכה חופשית
  useEffect(function () {
    if (isOpen && sketchTitle) {
      setRoomName(sketchTitle + ' - חדר לייב');
    }
  }, [isOpen, sketchTitle]);

  if (!isOpen) return null;

  function handleCreateRoom(e) {
    if (e && e.preventDefault) e.preventDefault();

    if (!roomName) {
      alert('נא למלא את שם החדר');
      return;
    }
    if (!profile || !profile.display_name) {
      alert('חסר שם תצוגה בפרופיל');
      return;
    }

    setIsSubmitting(true);

    var row = {
      name: roomName,
      host_username: profile.display_name,
      host_client_id: getClientId(),
      host_user_id: session ? session.user.id : null,
      sketch_id: sketchId,
    };

    supabase
      .from('LiveRoom')
      .insert([row])
      .select()
      .single()
      .then(function (result) {
        setIsSubmitting(false);

        if (result.error) {
          console.error('Error creating room:', result.error);
          alert('קרתה שגיאה ביצירת החדר: ' + result.error.message);
          return;
        }

        if (typeof onRoomCreated === 'function') {
          onRoomCreated(result.data);
        }
        setRoomName('');
        onClose();
      });
  }

  var titleText = sketchTitle ? 'פתיחת חדר לייב לסקיצה "' + sketchTitle + '"' : 'פתח חדר לייב חדש';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 p-8 rounded-2xl w-full max-w-md text-white shadow-2xl">
        <h2 className="text-2xl font-bold mb-6">{titleText}</h2>

        <label className="block text-sm text-gray-400 mb-1">שם החדר *</label>
        <input
          value={roomName}
          onChange={function (e) { setRoomName(e.target.value); }}
          placeholder="למשל: סשן בטיסוקס ביוט"
          className="w-full bg-gray-800 border border-gray-700 p-3 mb-6 rounded-lg focus:border-green-500 outline-none"
        />

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 bg-gray-700 hover:bg-gray-600 p-3 rounded-lg font-bold transition-colors disabled:opacity-50"
          >
            ביטול
          </button>
          <button
            type="button"
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