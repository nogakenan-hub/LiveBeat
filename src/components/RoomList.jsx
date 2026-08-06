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

        var actionButton;
        if (canEnterDirectly) {
          actionButton = (
            <button
              type="button"
              onClick={function () { handleEnterClick(room); }}
              className="text-[10px] sm:text-xs bg-live hover:bg-live/90 text-white px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg transition-all"
            >
              כניסה
            </button>
          );
        } else if (isPending) {
          actionButton = (
            <span className="text-[10px] sm:text-xs bg-secondary/50 text-muted-foreground px-2 py-1 rounded-lg">
              ממתין...
            </span>
          );
        } else {
          actionButton = (
            <button
              type="button"
              onClick={function () { handleJoinClick(room); }}
              className="text-[10px] sm:text-xs bg-secondary hover:bg-primary hover:text-primary-foreground px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg transition-all"
            >
              הצטרפות
            </button>
          );
        }

        return (
          <div key={room.id} className="rounded-2xl border border-border bg-card p-2.5 sm:p-3.5 flex flex-col gap-2 hover:border-live/30 transition-all">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-live animate-live-pulse"></span>
              <span className="text-[10px] sm:text-xs font-bold text-live">LIVE</span>
            </div>
            <div>
              <p className="font-bold text-xs sm:text-base truncate">{room.name}</p>
              <p className="text-[10px] sm:text-xs truncate">
                {isOwner ? (
                  <span className="text-live font-medium">👑 את מנהלת</span>
                ) : (
                  <span className="text-muted-foreground">מנהל/ת: {room.host_username}</span>
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {actionButton}
              {isOwner ? (
                <button
                  type="button"
                  onClick={function () { if (onTagVisibility) onTagVisibility(room.id); }}
                  title="מי רואה את החדר?"
                  className="shrink-0 text-[10px] sm:text-xs bg-white/5 border border-white/10 hover:bg-white/10 text-foreground/80 px-1.5 py-1 sm:px-2 sm:py-1 rounded-md transition-colors"
                >
                  מי רואה?
                </button>
              ) : null}
              {isOwner ? (
                <button
                  type="button"
                  onClick={function () { handleDeleteClick(room); }}
                  title="מחק חדר"
                  className="shrink-0 w-6 h-6 sm:w-7 sm:h-7 rounded-md bg-destructive/80 hover:bg-destructive text-white flex items-center justify-center text-[10px] sm:text-xs transition-all"
                >
                  🗑️
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}