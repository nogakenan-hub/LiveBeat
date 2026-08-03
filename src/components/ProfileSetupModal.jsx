import React, { useState, useContext } from 'react';
import { SupabaseContext } from '../main';

export default function ProfileSetupModal({ isOpen, userId, onClose, onProfileSaved }) {
  const [displayName, setDisplayName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabase = useContext(SupabaseContext);

  if (!isOpen) return null;

  const handleSaveProfile = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    if (!displayName) return alert('נא להזין שם תצוגה');

    setIsSubmitting(true);

    const { data, error } = await supabase
      .from('Profile')
      .insert([{ id: userId, display_name: displayName }])
      .select()
      .single();

    setIsSubmitting(false);

    if (error) {
      console.error('Error saving profile:', error);
      alert('קרתה שגיאה בשמירת הפרופיל: ' + error.message);
    } else {
      if (typeof onProfileSaved === 'function') {
        onProfileSaved(data);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 p-8 rounded-2xl w-full max-w-md text-white shadow-2xl">
        <h2 className="text-2xl font-bold mb-2">כמעט סיימנו!</h2>
        <p className="text-sm text-gray-400 mb-6">איך נקרא לך בקהילה?</p>

        <label className="block text-sm text-gray-400 mb-1">שם תצוגה *</label>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="השם שיוצג לאחרים"
          className="w-full bg-gray-800 border border-gray-700 p-3 mb-6 rounded-lg focus:border-green-500 outline-none"
        />

        <button
          onClick={handleSaveProfile}
          disabled={isSubmitting}
          className="w-full bg-green-600 hover:bg-green-700 p-3 rounded-lg font-bold transition-colors disabled:opacity-50"
        >
          {isSubmitting ? 'שומר...' : 'המשך'}
        </button>
      </div>
    </div>
  );
}