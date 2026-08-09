import React, { useState, useContext } from 'react';
import { SupabaseContext } from '../main';

export default function ProfileSetupModal({ isOpen, userId, onClose, onProfileSaved, onProfessionalProfileSaved }) {
  const [displayName, setDisplayName] = useState('');
  const [isProfessional, setIsProfessional] = useState(false);
  const [roleTitle, setRoleTitle] = useState('');
  const [specialties, setSpecialties] = useState('');
  const [professionalBio, setProfessionalBio] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabase = useContext(SupabaseContext);

  if (!isOpen) return null;

  const handleSaveProfile = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    if (!displayName) return alert('נא להזין שם תצוגה');

    setIsSubmitting(true);

    const { data, error } = await supabase
      .from('Profile')
      .insert([{ id: userId, display_name: displayName, is_professional: isProfessional }])
      .select()
      .single();

    if (error) {
      setIsSubmitting(false);
      console.error('Error saving profile:', error);
      alert('קרתה שגיאה בשמירת הפרופיל: ' + error.message);
      return;
    }

    if (typeof onProfileSaved === 'function') {
      onProfileSaved(data);
    }

    // אם לא סימנה "גם איש/אשת מקצוע" - סיימנו, אין צורך ליצור שורת ProfessionalProfile
    if (!isProfessional) {
      setIsSubmitting(false);
      onClose();
      return;
    }

    const { data: proData, error: proError } = await supabase
      .from('ProfessionalProfile')
      .insert([{
        id: userId,
        role_title: roleTitle,
        specialties: specialties,
        bio: professionalBio,
      }])
      .select()
      .single();

    setIsSubmitting(false);

    if (proError) {
      console.error('שגיאה בשמירת הפרופיל המקצועי:', proError.message);
      alert('הפרופיל נשמר, אבל קרתה שגיאה בשמירת הפרטים המקצועיים: ' + proError.message);
      onClose();
      return;
    }

    if (typeof onProfessionalProfileSaved === 'function') {
      onProfessionalProfileSaved(proData);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 p-8 rounded-2xl w-full max-w-md text-white shadow-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-2">כמעט סיימנו!</h2>
        <p className="text-sm text-gray-400 mb-6">איך נקרא לך בקהילה?</p>

        <label className="block text-sm text-gray-400 mb-1">שם תצוגה *</label>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="השם שיוצג לאחרים"
          className="w-full bg-gray-800 border border-gray-700 p-3 mb-4 rounded-lg focus:border-green-500 outline-none"
        />

        <label className="flex items-center gap-2 mb-4 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isProfessional}
            onChange={(e) => {
              if (e.target.checked) {
                const confirmed = window.confirm(
                  'שימי לב: לאחר שמירה, לא ניתן יהיה לבטל את הסימון "איש/אשת מקצוע". להמשיך?'
                );
                if (!confirmed) return;
              }
              setIsProfessional(e.target.checked);
            }}
            className="w-4 h-4"
          />
          <span className="text-sm">אני גם איש/אשת מקצוע (מורה, מפיק/ה, טכנאי/ת סאונד...)</span>
        </label>

        {isProfessional ? (
          <div className="border border-gray-700 rounded-lg p-4 mb-4 flex flex-col gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">תפקיד ותחום ההתמחות</label>
              <input
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                placeholder="למשל: טכנאי מיקס ומאסטרינג / מורה לגיטרה"
                className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-lg focus:border-green-500 outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">תגיות תחום (מופרדות בפסיק)</label>
              <input
                value={specialties}
                onChange={(e) => setSpecialties(e.target.value)}
                placeholder="למשל: מיקס, מאסטרינג, גיטרה קלאסית"
                className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-lg focus:border-green-500 outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">ביו מקצועי</label>
              <textarea
                value={professionalBio}
                onChange={(e) => setProfessionalBio(e.target.value)}
                rows={3}
                placeholder="קצת עליך בתור איש/אשת מקצוע - ניסיון, סגנון עבודה"
                className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-lg focus:border-green-500 outline-none text-sm resize-none"
              />
            </div>
          </div>
        ) : null}

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