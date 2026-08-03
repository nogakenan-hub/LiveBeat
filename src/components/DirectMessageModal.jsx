import React, { useState, useContext, useEffect } from 'react';
import { SupabaseContext } from '../main';

export default function DirectMessageModal(props) {
  var isOpen = props.isOpen;
  var currentUserId = props.currentUserId;
  var currentUsername = props.currentUsername;
  var partnerId = props.partnerId;
  var partnerUsername = props.partnerUsername;
  var onClose = props.onClose;

  var supabase = useContext(SupabaseContext);

  var messagesState = useState([]);
  var messages = messagesState[0];
  var setMessages = messagesState[1];

  var textState = useState('');
  var text = textState[0];
  var setText = textState[1];

  var isSendingState = useState(false);
  var isSending = isSendingState[0];
  var setIsSending = isSendingState[1];

  var showArchivedState = useState(false);
  var showArchived = showArchivedState[0];
  var setShowArchived = showArchivedState[1];

  function markThreadRead() {
    supabase
      .from('DirectMessage')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_id', currentUserId)
      .eq('sender_id', partnerId)
      .is('read_at', null)
      .then(function () {});
  }

  function loadMessages() {
    if (!currentUserId || !partnerId) return;

    supabase
      .from('DirectMessage')
      .select('*')
      .or(
        'and(sender_id.eq.' + currentUserId + ',recipient_id.eq.' + partnerId + '),' +
        'and(sender_id.eq.' + partnerId + ',recipient_id.eq.' + currentUserId + ')'
      )
      .order('created_at', { ascending: true })
      .then(function (result) {
        if (result.data) {
          setMessages(result.data);
        }
      });

    markThreadRead();
  }

  useEffect(function () {
    if (!isOpen) {
      setMessages([]);
      return;
    }
    loadMessages();
  }, [isOpen, partnerId]);

  useEffect(function () {
    if (!isOpen || !currentUserId || !partnerId) return;

    var channel = supabase
      .channel('dm-thread-' + currentUserId + '-' + partnerId)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'DirectMessage', filter: 'recipient_id=eq.' + currentUserId },
        function (payload) {
          if (payload.new.sender_id === partnerId) {
            setMessages(function (prev) { return prev.concat([payload.new]); });
            markThreadRead();
          }
        }
      )
      .subscribe();

    return function () {
      supabase.removeChannel(channel);
    };
  }, [isOpen, currentUserId, partnerId]);

  if (!isOpen) return null;

  function handleToggleArchive(message) {
    var isMeSender = message.sender_id === currentUserId;
    var currentlyArchived = isMeSender ? message.archived_by_sender : message.archived_by_recipient;
    var updateObj = isMeSender
      ? { archived_by_sender: !currentlyArchived }
      : { archived_by_recipient: !currentlyArchived };

    supabase
      .from('DirectMessage')
      .update(updateObj)
      .eq('id', message.id)
      .select()
      .single()
      .then(function (result) {
        if (result.error) {
          console.error('שגיאה בעדכון הארכיון:', result.error.message);
          return;
        }
        setMessages(function (prev) {
          return prev.map(function (m) {
            if (m.id === result.data.id) return result.data;
            return m;
          });
        });
      });
  }

  function handleSend() {
    if (!text) return;
    if (!currentUserId || !partnerId) return;

    setIsSending(true);

    var row = {
      sender_id: currentUserId,
      sender_username: currentUsername,
      recipient_id: partnerId,
      recipient_username: partnerUsername,
      content: text,
    };

    supabase
      .from('DirectMessage')
      .insert([row])
      .select()
      .single()
      .then(function (result) {
        setIsSending(false);
        if (result.error) {
          console.error('שגיאה בשליחת ההודעה:', result.error.message);
          alert('קרתה שגיאה בשליחת ההודעה');
          return;
        }
        setMessages(function (prev) { return prev.concat([result.data]); });
        setText('');
      });
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" dir="rtl">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md text-white shadow-2xl flex flex-col h-[70vh]">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="font-bold">{partnerUsername}</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={function () { setShowArchived(function (prev) { return !prev; }); }}
              title="ארכיון הודעות"
              className="text-xs px-2 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
            >
              {showArchived ? 'הצג פעילות' : '🗄️ ארכיון'}
            </button>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">X</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
          {messages
            .filter(function (m) {
              var archivedForMe = m.sender_id === currentUserId ? m.archived_by_sender : m.archived_by_recipient;
              return showArchived ? archivedForMe : !archivedForMe;
            })
            .map(function (m) {
              var isMine = m.sender_id === currentUserId;
              var archivedForMe = isMine ? m.archived_by_sender : m.archived_by_recipient;
              var wrapperClass = isMine ? 'flex flex-col gap-0.5 items-start' : 'flex flex-col gap-0.5 items-end';
              var bubbleClass = isMine
                ? 'bg-green-700 text-white rounded-lg px-3 py-2 text-sm max-w-[80%]'
                : 'bg-gray-800 text-white rounded-lg px-3 py-2 text-sm max-w-[80%]';
              return (
                <div key={m.id} className={wrapperClass}>
                  <div className={bubbleClass}>{m.content}</div>
                  <button
                    type="button"
                    onClick={function () { handleToggleArchive(m); }}
                    className="text-[10px] text-gray-500 hover:text-gray-300"
                  >
                    {archivedForMe ? 'שחזור מהארכיון' : 'העברה לארכיון'}
                  </button>
                </div>
              );
            })}
          {messages.filter(function (m) {
            var archivedForMe = m.sender_id === currentUserId ? m.archived_by_sender : m.archived_by_recipient;
            return showArchived ? archivedForMe : !archivedForMe;
          }).length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              {showArchived ? 'אין הודעות בארכיון' : 'עדיין אין הודעות - תתחילו לדבר!'}
            </p>
          ) : null}
        </div>

        <div className="p-3 border-t border-gray-800 flex gap-2">
          <input
            type="text"
            value={text}
            onChange={function (e) { setText(e.target.value); }}
            onKeyDown={function (e) { if (e.key === 'Enter') handleSend(); }}
            placeholder="כתבי הודעה..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-500"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={isSending}
            className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
          >
            שליחה
          </button>
        </div>
      </div>
    </div>
  );
}