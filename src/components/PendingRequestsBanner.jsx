import React from 'react';

export default function PendingRequestsBanner({ requests, onApprove, onReject }) {
  if (!requests || requests.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900 border-t border-gray-700 shadow-2xl">
      <div className="mx-auto max-w-4xl px-4 py-4">
        <p className="text-sm text-gray-400 mb-3">
          {requests.length === 1 ? 'יש בקשת הצטרפות ממתינה:' : `יש ${requests.length} בקשות הצטרפות ממתינות:`}
        </p>
        <div className="flex flex-col gap-2">
          {requests.map(request => (
            <div
              key={request.id}
              className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-3"
            >
              <span className="text-white text-sm">
                <span className="font-bold">{request.requester_username}</span>
                {' '}מבקש/ת להצטרף לחדר{' '}
                <span className="font-bold">{request.room_name}</span>
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onReject(request)}
                  className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-4 py-1.5 rounded-lg transition-colors"
                >
                  דחייה
                </button>
                <button
                  type="button"
                  onClick={() => onApprove(request)}
                  className="bg-green-600 hover:bg-green-700 text-white text-sm px-4 py-1.5 rounded-lg transition-colors"
                >
                  אישור
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}