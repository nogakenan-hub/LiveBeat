import React, { useState, useContext, useEffect } from 'react';
import { SupabaseContext } from '../main';

export default function InboxModal(props) {
  var isOpen = props.isOpen;
  var currentUserId = props.currentUserId;
  var onClose = props.onClose;
  var onOpenConversation = props.onOpenConversation;

  var supabase = useContext(SupabaseContext);

  var conversationsState = useState([]);
  var conversations = conversationsState[0];
  var setConversations = conversationsState[1];

  function loadConversations() {
    if (!currentUserId) return;

    supabase
      .from('DirectMessage')
      .select('*')
      .or('sender_id.eq.' + currentUserId + ',recipient_id.eq.' + currentUserId)
      .order('created_at', { ascending: false })
      .then(function (result) {
        if (!result.data) return;

        var map = {};
        result.data.forEach(function (m) {
          var isMine = m.sender_id === currentUserId;
          var partnerId = isMine ? m.recipient_id : m.sender_id;
          var partnerUsername = isMine ? m.recipient_username : m.sender_username;

          if (!map[partnerId]) {
            map[partnerId] = {
              partnerId: partnerId,
              partnerUsername: partnerUsername,
              lastMessage: m.content,
              unreadCount: 0,
            };
          }

          if (!isMine && !m.read_at) {
            map[partnerId].unreadCount = map[partnerId].unreadCount + 1;
          }
        });

        var list = Object.keys(map).map(function (key) { return map[key]; });
        setConversations(list);
      });
  }

  useEffect(function () {
    if (!isOpen) return;
    loadConversations();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" dir="rtl">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md text-white shadow-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="font-bold">הודעות</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">X</button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {conversations.map(function (c) {
            return (
              <button
                key={c.partnerId}
                type="button"
                onClick={function () { onOpenConversation(c.partnerId, c.partnerUsername); }}
                className="w-full text-right flex items-center justify-between gap-2 p-3 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{c.partnerUsername}</p>
                  <p className="text-xs text-gray-400 truncate">{c.lastMessage}</p>
                </div>
                {c.unreadCount > 0 ? (
                  <span className="bg-red-600 text-white text-[10px] rounded-full h-5 w-5 flex items-center justify-center shrink-0">
                    {c.unreadCount}
                  </span>
                ) : null}
              </button>
            );
          })}
          {conversations.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">עדיין אין הודעות</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}