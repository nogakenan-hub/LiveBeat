import React, { useState, useContext, useEffect, useCallback } from 'react';
import { SupabaseContext } from '../main';

// contentType: 'sketch' | 'room'
// tagTable/idColumn נגזרים אוטומטית מ-contentType, אין צורך להעביר אותם מבחוץ
const CONFIG_BY_TYPE = {
  sketch: { tagTable: 'SketchVisibilityTag', idColumn: 'sketch_id' },
  room: { tagTable: 'RoomVisibilityTag', idColumn: 'room_id' },
};

export default function VisibilityTagModal({
  isOpen,
  onClose,
  session,
  contentType,
  contentId,
  contentTitle,
  isContentPublic,
  allowInviteOverride,
  onToggleInviteOverride,
}) {
  const supabase = useContext(SupabaseContext);
  const config = CONFIG_BY_TYPE[contentType] || CONFIG_BY_TYPE.sketch;

  const [groups, setGroups] = useState([]);
  const [taggedGroupIds, setTaggedGroupIds] = useState([]); // group_id -> tag row id
  const [tagRowByGroupId, setTagRowByGroupId] = useState({});
  const [taggedUsers, setTaggedUsers] = useState([]); // [{ tagId, userId, display_name }]
  const [isLoading, setIsLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const loadData = useCallback(() => {
    if (!session || !contentId) return;
    setIsLoading(true);

    Promise.all([
      supabase.from('Group').select('*').eq('owner_user_id', session.user.id).order('created_at', { ascending: false }),
      supabase.from(config.tagTable).select('*').eq(config.idColumn, contentId),
    ]).then(([groupsResult, tagsResult]) => {
      setGroups(groupsResult.data || []);

      const tagRows = tagsResult.data || [];
      const groupTagMap = {};
      const groupIds = [];
      const userTagRows = [];

      tagRows.forEach((row) => {
        if (row.group_id) {
          groupTagMap[row.group_id] = row.id;
          groupIds.push(row.group_id);
        } else if (row.user_id) {
          userTagRows.push(row);
        }
      });

      setTagRowByGroupId(groupTagMap);
      setTaggedGroupIds(groupIds);

      if (userTagRows.length === 0) {
        setTaggedUsers([]);
        setIsLoading(false);
        return;
      }

      const userIds = userTagRows.map((r) => r.user_id);
      supabase.from('Profile').select('id, display_name').in('id', userIds).then((profResult) => {
        setIsLoading(false);
        const nameById = {};
        (profResult.data || []).forEach((p) => { nameById[p.id] = p.display_name; });
        setTaggedUsers(
          userTagRows.map((r) => ({ tagId: r.id, userId: r.user_id, display_name: nameById[r.user_id] || 'משתמש/ת' }))
        );
      });
    });
  }, [session, contentId, config, supabase]);

  useEffect(() => {
    if (isOpen) {
      loadData();
      setSearchQuery('');
      setSearchResults([]);
    }
  }, [isOpen, loadData]);

  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    const timeoutId = setTimeout(() => {
      supabase
        .from('Profile')
        .select('id, display_name')
        .ilike('display_name', `%${searchQuery.trim()}%`)
        .limit(8)
        .then((result) => {
          setIsSearching(false);
          const alreadyTaggedIds = taggedUsers.map((u) => u.userId);
          const filtered = (result.data || []).filter(
            (p) => p.id !== session.user.id && alreadyTaggedIds.indexOf(p.id) === -1
          );
          setSearchResults(filtered);
        });
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, taggedUsers, session, supabase]);

  const [inviteOverrideValue, setInviteOverrideValue] = useState(!!allowInviteOverride);

  useEffect(() => {
    setInviteOverrideValue(!!allowInviteOverride);
  }, [allowInviteOverride, isOpen]);

  const handleToggleInviteOverride = (checked) => {
    setInviteOverrideValue(checked); // עדכון אופטימי - מרגיש מיידי
    supabase
      .from('LiveRoom')
      .update({ allow_invite_override: checked })
      .eq('id', contentId)
      .then((result) => {
        if (result.error) {
          console.error('שגיאה בעדכון allow_invite_override:', result.error.message);
          setInviteOverrideValue(!checked); // מחזירה אחורה אם נכשל
          alert('קרתה שגיאה בעדכון ההגדרה');
          return;
        }
        if (onToggleInviteOverride) onToggleInviteOverride(checked);
      });
  };

  if (!isOpen) return null;

  const handleToggleGroup = (group) => {
    const existingTagId = tagRowByGroupId[group.id];

    if (existingTagId) {
      supabase.from(config.tagTable).delete().eq('id', existingTagId).then((result) => {
        if (result.error) {
          console.error('שגיאה בהסרת תיוג הקבוצה:', result.error.message);
          return;
        }
        setTaggedGroupIds((prev) => prev.filter((id) => id !== group.id));
        setTagRowByGroupId((prev) => {
          const next = { ...prev };
          delete next[group.id];
          return next;
        });
      });
    } else {
      const row = { group_id: group.id };
      row[config.idColumn] = contentId;
      supabase.from(config.tagTable).insert([row]).select().single().then((result) => {
        if (result.error) {
          console.error('שגיאה בתיוג הקבוצה:', result.error.message);
          return;
        }
        setTaggedGroupIds((prev) => [...prev, group.id]);
        setTagRowByGroupId((prev) => ({ ...prev, [group.id]: result.data.id }));
      });
    }
  };

  const handleAddUser = (profile) => {
    const row = { user_id: profile.id };
    row[config.idColumn] = contentId;
    supabase.from(config.tagTable).insert([row]).select().single().then((result) => {
      if (result.error) {
        console.error('שגיאה בתיוג המשתמש/ת:', result.error.message);
        alert('קרתה שגיאה בהוספה');
        return;
      }
      setTaggedUsers((prev) => [...prev, { tagId: result.data.id, userId: profile.id, display_name: profile.display_name }]);
      setSearchResults((prev) => prev.filter((p) => p.id !== profile.id));
    });
  };

  const handleRemoveUser = (taggedUser) => {
    supabase.from(config.tagTable).delete().eq('id', taggedUser.tagId).then((result) => {
      if (result.error) {
        console.error('שגיאה בהסרת התיוג:', result.error.message);
        return;
      }
      setTaggedUsers((prev) => prev.filter((u) => u.tagId !== taggedUser.tagId));
    });
  };

  const hasAnyTag = taggedGroupIds.length > 0 || taggedUsers.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="w-full max-w-lg bg-background border border-border rounded-2xl shadow-2xl mt-4 sm:mt-8 mb-4 sm:mb-8 flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 p-4 sm:p-5 border-b border-border shrink-0">
          <div>
            <h2 className="text-base sm:text-lg font-bold">מי רואה את זה?</h2>
            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[280px]">{contentTitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="סגירה"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-secondary hover:bg-secondary/70 transition-colors text-lg leading-none shrink-0"
          >
            ✕
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto">
          <p className="text-xs text-muted-foreground mb-4">
            {contentType === 'sketch' && isContentPublic
              ? 'זו סקיצה ציבורית - כולם כבר רואים אותה. תיוג כאן הוא סימון בלבד (כמו תיוג בפייסבוק), לא הגבלת צפייה.'
              : 'זה פרטי, אבל את יכולה לבחור בדיוק מי כן רואה אותו - קבוצה שלמה, אדם ספציפי, או שניהם.'}
          </p>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">טוענת...</p>
          ) : (
            <React.Fragment>
              <h3 className="font-bold text-sm mb-2">קבוצות</h3>
              {groups.length === 0 ? (
                <p className="text-xs text-muted-foreground mb-4">אין לך עדיין קבוצות. אפשר ליצור אחת דרך "ניהול קבוצות" בתפריט הפרופיל.</p>
              ) : (
                <div className="flex flex-col gap-1.5 mb-4">
                  {groups.map((group) => {
                    const isChecked = taggedGroupIds.indexOf(group.id) !== -1;
                    return (
                      <label
                        key={group.id}
                        className={
                          'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ' +
                          (isChecked ? 'bg-primary/15 border-primary/40' : 'bg-card border-border hover:border-primary/30')
                        }
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleGroup(group)}
                          className="accent-primary"
                        />
                        <span className="truncate">{group.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              <h3 className="font-bold text-sm mb-2">אנשים ספציפיים</h3>
              <div className="mb-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="חיפוש לפי שם כדי להוסיף..."
                  className="w-full bg-secondary/40 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
                />
                {isSearching ? (
                  <p className="text-xs text-muted-foreground mt-1.5">מחפשת...</p>
                ) : searchResults.length > 0 ? (
                  <div className="mt-1.5 flex flex-col gap-1 border border-border rounded-lg overflow-hidden">
                    {searchResults.map((profile) => (
                      <button
                        key={profile.id}
                        type="button"
                        onClick={() => handleAddUser(profile)}
                        className="flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-secondary transition-colors text-right"
                      >
                        <span>{profile.display_name}</span>
                        <span className="text-primary text-xs shrink-0">+ הוספה</span>
                      </button>
                    ))}
                  </div>
                ) : searchQuery.trim().length >= 2 ? (
                  <p className="text-xs text-muted-foreground mt-1.5">לא נמצאו משתמשות/ים תואמים.</p>
                ) : null}
              </div>

              {taggedUsers.length > 0 ? (
                <div className="flex flex-col gap-1.5 mb-2">
                  {taggedUsers.map((u) => (
                    <div
                      key={u.tagId}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm"
                    >
                      <span className="truncate">{u.display_name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveUser(u)}
                        className="shrink-0 text-muted-foreground hover:text-red-400 transition-colors text-xs"
                      >
                        הסרה
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              {contentType === 'room' ? (
                <div className="mt-5 pt-4 border-t border-border">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={inviteOverrideValue}
                      onChange={(e) => handleToggleInviteOverride(e.target.checked)}
                      className="accent-primary"
                    />
                    <span>קישור הזמנה יכול לעקוף את ההגבלה הזו</span>
                  </label>
                  <p className="text-xs text-muted-foreground mt-1 mr-6">
                    אם כבוי, רק מי שמתויג/ת למעלה (או שאת) יכולים להיכנס - גם עם קישור הזמנה.
                  </p>
                </div>
              ) : null}

              {!hasAnyTag ? (
                contentType === 'room' ? (
                  <p className="text-xs text-muted-foreground mt-3">
                    אין עדיין תיוג לחדר הזה - הוא פתוח לכל משתמשת מחוברת, בדיוק כמו כל חדר אחר. תייגי קבוצה או אדם כדי להגביל מי רואה אותו.
                  </p>
                ) : (
                  <p className="text-xs text-amber-400/90 mt-3">
                    ⚠️ עדיין לא תייגת אף אחד - אם הסקיצה מוגדרת פרטית, כרגע רק את רואה אותה.
                  </p>
                )
              ) : null}
            </React.Fragment>
          )}
        </div>
      </div>
    </div>
  );
}