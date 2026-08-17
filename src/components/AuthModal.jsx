import React, { useState, useContext } from 'react';
import { SupabaseContext } from '../main';

// מיפוי בין קוד סיבה (מחרוזת קצרה, נשלחת מהמקום שקורא ל-onOpenAuth) לבין
// טקסט ההקשר שיוצג למשתמשת. אם מתווספת סיבה חדשה בעתיד (למשל חסימת
// פעולה ספציפית אחרת) - מוסיפים כאן שורה נוספת, בלי לגעת בשאר הקובץ.
var REASON_MESSAGES = {
  preview: 'זו הייתה תצוגה מקדימה של 20 שניות. כדי להאזין/לצפות בקטע במלואו, צריך להתחבר או להירשם.',
};

export default function AuthModal({ isOpen, onClose, reason }) {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const supabase = useContext(SupabaseContext);

  if (!isOpen) return null;

  var contextMessage = reason ? REASON_MESSAGES[reason] : null;

  const handleSendLink = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    if (!email) return alert('נא להזין כתובת אימייל');

    setIsSubmitting(true);

    const { error } = await supabase.auth.signInWithOtp({
      email: email,
    });

    setIsSubmitting(false);

    if (error) {
      console.error('Error sending magic link:', error);
      alert('קרתה שגיאה בשליחת הקישור: ' + error.message);
    } else {
      setLinkSent(true);
    }
  };

  const handleClose = () => {
    setEmail('');
    setLinkSent(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 p-8 rounded-2xl w-full max-w-md text-white shadow-2xl">
        {linkSent ? (
          <>
            <h2 className="text-2xl font-bold mb-4">שלחנו לך קישור להתחברות!</h2>
            <p className="text-gray-400 mb-6">
              בדקי את תיבת המייל שלך ({email}) ולחצי על הקישור כדי להתחבר.
            </p>
            <button
              onClick={handleClose}
              className="w-full bg-gray-700 hover:bg-gray-600 p-3 rounded-lg font-bold transition-colors"
            >
              סגירה
            </button>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold mb-2">התחברות</h2>

            {contextMessage ? (
              <p className="text-sm text-primary/90 bg-primary/10 border border-primary/20 rounded-lg px-3 py-2 mb-4">
                {contextMessage}
              </p>
            ) : (
              <div className="mb-6" />
            )}

            <label className="block text-sm text-gray-400 mb-1">כתובת אימייל *</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              type="email"
              className="w-full bg-gray-800 border border-gray-700 p-3 mb-6 rounded-lg focus:border-green-500 outline-none"
            />

            <div className="flex gap-2">
              <button
                onClick={handleClose}
                disabled={isSubmitting}
                className="flex-1 bg-gray-700 hover:bg-gray-600 p-3 rounded-lg font-bold transition-colors disabled:opacity-50"
              >
                ביטול
              </button>
              <button
                onClick={handleSendLink}
                disabled={isSubmitting}
                className="flex-1 bg-green-600 hover:bg-green-700 p-3 rounded-lg font-bold transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'שולח...' : 'שלח קישור התחברות'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}