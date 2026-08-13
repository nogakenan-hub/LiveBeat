// @ts-nocheck
import React from 'react';
import { getClientId } from '../lib/clientId';

export default function RoomList(props) {
  var rooms = props.rooms || [];
  var pendingRoomIds = props.pendingRoomIds;
  var approvedRoomIds = props.approvedRoomIds;
  var guestRoomIds = props.guestRoomIds;
  var session = props.session;
  var onJoinRoom = props.onJoinRoom; // בקשת הצטרפות לחדר
  var onEnterRoom = props.onEnterRoom; // כניסה ישירה לחדר
  var onDeleteRoom = props.onDeleteRoom; // מחיקת חדר בפועל (אחרי אישור)
  var onTagVisibility = props.onTagVisibility; // פתיחת "מי רואה?" לחדר ספציפי

  function handleJoinClick(room) {
    if (onJoinRoom) onJoinRoom(room);
  }

  function handleEnterClick(room) {
    if (onEnterRoom) onEnterRoom(room);
  }

  function handleDeleteClick(room) {
    var message = 'האם למחוק את החדר ' + room.name + '?';
    var confirmed = window.confirm(message);
    if (confirmed && onDeleteRoom) {
      onDeleteRoom(room.id);
    }
  }

  return (
    <div className="rooms-scrollbar flex flex-col gap-2 sm:gap-3 max-h-[60vh] sm:max-h-[70vh] overflow-y-auto pr-1">
      {rooms.map(function (room) {
        var isPending = pendingRoomIds && pendingRoomIds.has(room.id);
        var isApprovedGuest = approvedRoomIds && approvedRoomIds.has(room.id);
        var isReturningGuest = guestRoomIds && guestRoomIds.has(room.id);
        var isOwner = room.host_user_id
          ? !!(session && session.user.id === room.host_user_id)
          : !!(room.host_client_id && room.host_client_id === getClientId());
        var canEnterDirectly = isOwner || isApprovedGuest || isReturningGuest;

        // ===== שלב 4 של תוכנית העיצוב: כפתור הפעולה בסגנון pill קטן, לפי rezo_redesign_v3.html =====
        var actionButton;
        if (canEnterDirectly) {
          actionButton = (
            <button
              type="button"
              onClick={function () { handleEnterClick(room); }}
              className="shrink-0 rounded-full px-2.5 py-1 text-[10px] sm:text-[11px] font-semibold text-white transition-all hover:opacity-90"
              style={{ background: 'var(--live-hex, #4fd18b)' }}
            >
              כניסה
            </button>
          );
        } else if (isPending) {
          actionButton = (
            <span className="shrink-0 rounded-full bg-secondary/50 px-2.5 py-1 text-[10px] sm:text-[11px] text-muted-foreground">
              ממתין...
            </span>
          );
        } else {
          actionButton = (
            <button
              type="button"
              onClick={function () { handleJoinClick(room); }}
              className="shrink-0 rounded-full px-2.5 py-1 text-[10px] sm:text-[11px] font-semibold transition-all hover:opacity-90"
              style={{ background: 'var(--accent-soft, rgba(138,111,214,0.16))', color: 'var(--accent-text-hex, #c3b0ee)' }}
            >
              הצטרפות
            </button>
          );
        }

        return (
          <div
            key={room.id}
            className="relative shrink-0 overflow-hidden rounded-lg bg-card p-2.5 sm:p-3.5 flex flex-col gap-2 transition-all"
            style={{
              border: '1px solid rgba(107,140,90,0.4)',
              boxShadow: '0 0 18px rgba(79,209,139,0.08), inset 0 0 24px rgba(79,209,139,0.04)'
            }}
          >
            {/* פס ירוק בצד - מקביל ל-::before של המוקאפ, מציין "לייב" גם ויזואלית בלי טקסט */}
            <span
              className="pointer-events-none absolute top-3 right-0 h-[18px] w-[3px] rounded-r-none"
              style={{
                borderRadius: '2px 0 0 2px',
                background: 'var(--live-hex, #4fd18b)',
                boxShadow: '0 0 6px var(--live-glow, rgba(79,209,139,0.35))'
              }}
            />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-1.5 rounded-sm animate-live-pulse"
                  style={{ background: 'var(--live-hex, #4fd18b)', boxShadow: '0 0 5px var(--live-glow, rgba(79,209,139,0.35))' }}
                ></span>
                <span className="text-[10px] sm:text-xs font-bold tracking-wide" style={{ color: 'var(--live-hex, #4fd18b)' }}>LIVE</span>
              </div>
              {actionButton}
            </div>

            <div>
              <p className="font-bold text-xs sm:text-base truncate">{room.name}</p>
              <p className="text-[10px] sm:text-xs truncate">
                {isOwner ? (
                  <span className="font-medium" style={{ color: 'var(--live-hex, #4fd18b)' }}>👑 את מנהלת</span>
                ) : (
                  <span className="text-muted-foreground">מנהל/ת: {room.host_username}</span>
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 min-h-[24px] sm:min-h-[28px]">
              {isOwner ? (
                <React.Fragment>
                  <button
                    type="button"
                    onClick={function () { if (onTagVisibility) onTagVisibility(room.id); }}
                    title="מי רואה את החדר?"
                    className="shrink-0 text-[10px] sm:text-xs bg-white/5 border border-white/10 hover:bg-white/10 text-foreground/80 px-1.5 py-1 sm:px-2 sm:py-1 rounded-md transition-colors"
                  >
                    מי רואה?
                  </button>
                  <button
                    type="button"
                    onClick={function () { handleDeleteClick(room); }}
                    title="מחק חדר"
                    className="shrink-0 w-6 h-6 sm:w-7 sm:h-7 rounded-md bg-destructive/80 hover:bg-destructive text-white flex items-center justify-center text-[10px] sm:text-xs transition-all"
                  >
                    🗑️
                  </button>
                </React.Fragment>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}