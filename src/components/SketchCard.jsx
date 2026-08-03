import React from 'react';

var fileTypeIcons = { sound: '🎵', video: '🎬', text: '📄' };

export default function SketchCard(props) {
  var sketch = props.sketch;
  var onOpenModal = props.onOpenModal;
  var onDelete = props.onDelete;
  var session = props.session;

  var isOwner = session && sketch.uploader_user_id === session.user.id;
  var isPrivate = sketch.is_public === false;

  function handleDeleteClick(e) {
    e.stopPropagation();
    var confirmed = window.confirm('האם למחוק את הקטע ' + sketch.title + '?');
    if (confirmed && onDelete) {
      onDelete(sketch);
    }
  }

  return (
    <div
      onClick={function () { onOpenModal(sketch); }}
      className="rounded-xl border border-border bg-card p-5 hover:border-primary/30 transition-all cursor-pointer relative"
    >
      {isOwner ? (
        <button
          type="button"
          onClick={handleDeleteClick}
          title="מחק קטע"
          className="absolute top-3 left-3 text-xs bg-red-600/80 hover:bg-red-600 text-white px-2 py-1 rounded-lg"
        >
          🗑️
        </button>
      ) : null}
      {isPrivate ? (
        <span
          title="קטע פרטי - נראה רק לך"
          className="absolute top-3 right-3 text-[10px] font-medium bg-yellow-700/70 text-white px-2 py-0.5 rounded-lg"
        >
          🔒 פרטי
        </span>
      ) : null}
      <div className="flex items-center gap-2 mb-1">
        <span>{fileTypeIcons[sketch.file_type] || '🎵'}</span>
        <h3 className="font-bold">{sketch.title}</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-3">
        {sketch.uploader_username}
        {sketch.genre ? ' - ' + sketch.genre : ''}
      </p>
      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-secondary">
        {sketch.status}
      </span>
    </div>
  );
}