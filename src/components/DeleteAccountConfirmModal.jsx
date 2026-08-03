import React, { useState, useContext } from 'react';
import { SupabaseContext } from '../main';

export default function DeleteAccountConfirmModal(props) {
  var isOpen = props.isOpen;
  var onClose = props.onClose;

  var supabase = useContext(SupabaseContext);

  var confirmTextState = useState('');
  var confirmText = confirmTextState[0];
  var setConfirmText = confirmTextState[1];

  var isDeletingState = useState(false);
  var isDeleting = isDeletingState[0];
  var setIsDeleting = isDeletingState[1];

  if (!isOpen) return null;

  function handleClose() {
    if (isDeleting) return;
    setConfirmText('');
    onClose();
  }

  function handlePermanentDelete() {
    if (confirmText !== 'מחק לצמיתות') return;

    setIsDeleting(true);

    supabase.functions
      .invoke('delete-account')
      .then(function (result) {
        if (result.error) {
          setIsDeleting(false);
          console.error('שגיאה במחיקת החשבון:', result.error.message);
          alert('קרתה שגיאה במחיקת החשבון: ' + result.error.message);
          return;
        }

        supabase.auth.signOut().then(function () {
          alert('החשבון נמחק לצמיתות. תודה שהיית איתנו.');
          window.location.reload();
        });
      });
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-red-900/50 p-8 rounded-2xl w-full max-w-md text-white shadow-2xl">
        <h2 className="text-xl font-bold mb-3 text-red-400">מחיקת חשבון לצמיתות</h2>
        <p className="text-sm text-red-300 mb-4">
          פעולה זו בלתי הפיכה: הפרופיל, הסקיצות והקבצים שלך יימחקו לצמיתות. כדי לאשר, הקלידי בדיוק את המשפט:
          <br />
          <span className="font-bold">מחק לצמיתות</span>
        </p>
        <input
          value={confirmText}
          onChange={function (e) { setConfirmText(e.target.value); }}
          placeholder="מחק לצמיתות"
          disabled={isDeleting}
          className="w-full bg-gray-800 border border-red-900/50 p-2.5 mb-4 rounded-lg text-sm outline-none focus:border-red-500 disabled:opacity-50"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={isDeleting}
            className="flex-1 bg-gray-700 hover:bg-gray-600 p-3 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={handlePermanentDelete}
            disabled={isDeleting || confirmText !== 'מחק לצמיתות'}
            className="flex-1 bg-red-700 hover:bg-red-600 p-3 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
          >
            {isDeleting ? 'מוחקת...' : 'מחקי לצמיתות'}
          </button>
        </div>
      </div>
    </div>
  );
}