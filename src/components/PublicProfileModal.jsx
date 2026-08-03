import React, { useState, useContext, useEffect } from 'react';
import { SupabaseContext } from '../main';

export default function PublicProfileModal(props) {
  var isOpen = props.isOpen;
  var userId = props.userId;
  var currentUserId = props.currentUserId;
  var onClose = props.onClose;
  var onOpenDirectMessage = props.onOpenDirectMessage;

  var supabase = useContext(SupabaseContext);

  var profileState = useState(null);
  var profileData = profileState[0];
  var setProfileData = profileState[1];

  var professionalState = useState(null);
  var professionalData = professionalState[0];
  var setProfessionalData = professionalState[1];

  var isLoadingState = useState(false);
  var isLoading = isLoadingState[0];
  var setIsLoading = isLoadingState[1];

  useEffect(function () {
    if (!isOpen || !userId) {
      setProfileData(null);
      setProfessionalData(null);
      return;
    }

    setIsLoading(true);

    supabase
      .from('Profile')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
      .then(function (result) {
        setProfileData(result.data || null);
      });

    supabase
      .from('ProfessionalProfile')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
      .then(function (result) {
        setProfessionalData(result.data || null);
        setIsLoading(false);
      });
  }, [isOpen, userId]);

  if (!isOpen) return null;

  var isOwnProfile = currentUserId && userId === currentUserId;

  function handleMessageClick() {
    if (onOpenDirectMessage && profileData) {
      onOpenDirectMessage(userId, profileData.display_name);
    }
    onClose();
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 p-6 rounded-2xl w-full max-w-md text-white shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={function (e) { e.stopPropagation(); }}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-800 text-xl shrink-0">👤</div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">
                  {profileData ? profileData.display_name : '...'}
                  {profileData && profileData.is_professional ? ' 🎓' : ''}
                </h2>
                {!isLoading && !isOwnProfile && currentUserId ? (
                  <button
                    type="button"
                    onClick={handleMessageClick}
                    title="שליחת הודעה"
                    className="flex items-center justify-center h-7 w-7 rounded-full bg-gray-800 border border-gray-700 hover:bg-green-700 hover:border-green-600 transition-colors text-sm"
                  >
                    ✉️
                  </button>
                ) : null}
              </div>
              {profileData && profileData.bio ? (
                <p className="text-xs text-gray-400">{profileData.bio}</p>
              ) : null}
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">X</button>
        </div>

        {isLoading ? (
          <p className="text-sm text-gray-500 text-center py-4">טוענת פרופיל...</p>
        ) : null}

        {!isLoading && professionalData ? (
          <div className="border border-gray-700 rounded-lg p-4 mb-4">
            <p className="text-xs text-gray-500 mb-2">פרופיל מקצועי</p>
            {professionalData.role_title ? (
              <p className="text-sm font-medium mb-2">{professionalData.role_title}</p>
            ) : null}
            {professionalData.specialties ? (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {professionalData.specialties.split(',').map(function (tag, index) {
                  var trimmed = tag.trim();
                  if (!trimmed) return null;
                  return (
                    <span key={index} className="text-[11px] bg-gray-800 px-2 py-0.5 rounded-full">
                      {trimmed}
                    </span>
                  );
                })}
              </div>
            ) : null}
            {professionalData.bio ? (
              <p className="text-sm text-gray-300">{professionalData.bio}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}