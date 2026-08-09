import React, { useState, useContext, useEffect } from 'react';
import { SupabaseContext } from '../main';

export default function EditProfileModal(props) {
  var isOpen = props.isOpen;
  var profile = props.profile;
  var professionalProfile = props.professionalProfile;
  var onClose = props.onClose;
  var onProfileUpdated = props.onProfileUpdated;
  var onProfessionalProfileUpdated = props.onProfessionalProfileUpdated;

  var supabase = useContext(SupabaseContext);

  var displayNameState = useState('');
  var displayName = displayNameState[0];
  var setDisplayName = displayNameState[1];

  var bioState = useState('');
  var bio = bioState[0];
  var setBio = bioState[1];

  var isProfessionalState = useState(false);
  var isProfessional = isProfessionalState[0];
  var setIsProfessional = isProfessionalState[1];

  // נקבע פעם אחת בכל פתיחה, מה שהיה כשהמודל נפתח - אם כבר true, ה-checkbox ננעל
  // ולא ניתן לבטל (גיבוי בצד השרת קיים גם בטריגר trg_restrict_is_professional_downgrade)
  var wasAlreadyProfessionalState = useState(false);
  var wasAlreadyProfessional = wasAlreadyProfessionalState[0];
  var setWasAlreadyProfessional = wasAlreadyProfessionalState[1];

  var roleTitleState = useState('');
  var roleTitle = roleTitleState[0];
  var setRoleTitle = roleTitleState[1];

  var specialtiesState = useState('');
  var specialties = specialtiesState[0];
  var setSpecialties = specialtiesState[1];

  var professionalBioState = useState('');
  var professionalBio = professionalBioState[0];
  var setProfessionalBio = professionalBioState[1];

  var isSubmittingState = useState(false);
  var isSubmitting = isSubmittingState[0];
  var setIsSubmitting = isSubmittingState[1];

  useEffect(function () {
    if (!isOpen) return;

    if (profile) {
      setDisplayName(profile.display_name || '');
      setBio(profile.bio || '');
      setIsProfessional(!!profile.is_professional);
      setWasAlreadyProfessional(!!profile.is_professional);
    }

    if (professionalProfile) {
      setRoleTitle(professionalProfile.role_title || '');
      setSpecialties(professionalProfile.specialties || '');
      setProfessionalBio(professionalProfile.bio || '');
    } else {
      setRoleTitle('');
      setSpecialties('');
      setProfessionalBio('');
    }
  }, [profile, professionalProfile, isOpen]);

  if (!isOpen) return null;

  function handleSave(e) {
    if (e && e.preventDefault) e.preventDefault();

    if (!displayName) {
      alert('נא להזין שם תצוגה');
      return;
    }

    setIsSubmitting(true);

    supabase
      .from('Profile')
      .update({
        display_name: displayName,
        bio: bio,
        is_professional: isProfessional,
      })
      .eq('id', profile.id)
      .select()
      .single()
      .then(function (profileResult) {
        if (profileResult.error) {
          setIsSubmitting(false);
          console.error('שגיאה בעדכון הפרופיל:', profileResult.error.message);
          alert('קרתה שגיאה בעדכון הפרופיל: ' + profileResult.error.message);
          return;
        }

        if (typeof onProfileUpdated === 'function') {
          onProfileUpdated(profileResult.data);
        }

        if (!isProfessional) {
          setIsSubmitting(false);
          onClose();
          return;
        }

        var professionalRow = {
          id: profile.id,
          role_title: roleTitle,
          specialties: specialties,
          bio: professionalBio,
        };

        supabase
          .from('ProfessionalProfile')
          .upsert([professionalRow])
          .select()
          .single()
          .then(function (proResult) {
            setIsSubmitting(false);
            if (proResult.error) {
              console.error('שגיאה בשמירת הפרופיל המקצועי:', proResult.error.message);
              alert('הפרופיל נשמר, אבל קרתה שגיאה בשמירת הפרטים המקצועיים: ' + proResult.error.message);
              return;
            }
            if (typeof onProfessionalProfileUpdated === 'function') {
              onProfessionalProfileUpdated(proResult.data);
            }
            onClose();
          });
      });
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 p-8 rounded-2xl w-full max-w-md text-white shadow-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6">עדכון פרטים</h2>

        <label className="block text-sm text-gray-400 mb-1">שם תצוגה *</label>
        <input
          value={displayName}
          onChange={function (e) { setDisplayName(e.target.value); }}
          placeholder="השם שיוצג לאחרים"
          className="w-full bg-gray-800 border border-gray-700 p-3 mb-4 rounded-lg focus:border-green-500 outline-none"
        />

        <label className="block text-sm text-gray-400 mb-1">טאגליין / ביו קצר (אופציונלי)</label>
        <textarea
          value={bio}
          onChange={function (e) { setBio(e.target.value); }}
          placeholder="למשל: מפיקה אלקטרונית, אוהבת ז'אנרים מעורבים"
          rows={2}
          className="w-full bg-gray-800 border border-gray-700 p-3 mb-4 rounded-lg focus:border-green-500 outline-none text-sm resize-none"
        />

        <label className={'flex items-center gap-2 mb-1 select-none' + (wasAlreadyProfessional ? ' opacity-70' : ' cursor-pointer')}>
          <input
            type="checkbox"
            checked={isProfessional}
            disabled={wasAlreadyProfessional}
            onChange={function (e) {
              if (e.target.checked) {
                var confirmed = window.confirm(
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

        {wasAlreadyProfessional ? (
          <p className="text-[11px] text-gray-500 mb-4">🔒 סימון קבוע - לא ניתן לבטל לאחר שנקבע.</p>
        ) : (
          <div className="mb-4" />
        )}

        {isProfessional ? (
          <div className="border border-gray-700 rounded-lg p-4 mb-4 flex flex-col gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">תפקיד ותחום ההתמחות</label>
              <input
                value={roleTitle}
                onChange={function (e) { setRoleTitle(e.target.value); }}
                placeholder="למשל: טכנאי מיקס ומאסטרינג / מורה לגיטרה"
                className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-lg focus:border-green-500 outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">תגיות תחום (מופרדות בפסיק)</label>
              <input
                value={specialties}
                onChange={function (e) { setSpecialties(e.target.value); }}
                placeholder="למשל: מיקס, מאסטרינג, גיטרה קלאסית"
                className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-lg focus:border-green-500 outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">ביו מקצועי</label>
              <textarea
                value={professionalBio}
                onChange={function (e) { setProfessionalBio(e.target.value); }}
                rows={3}
                placeholder="קצת עליך בתור איש/אשת מקצוע - ניסיון, סגנון עבודה"
                className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-lg focus:border-green-500 outline-none text-sm resize-none"
              />
            </div>
          </div>
        ) : null}

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
            onClick={handleSave}
            disabled={isSubmitting}
            className="flex-1 bg-green-600 hover:bg-green-700 p-3 rounded-lg font-bold transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'שומר...' : 'שמירה'}
          </button>
        </div>
      </div>
    </div>
  );
}