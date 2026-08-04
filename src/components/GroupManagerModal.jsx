import React, { useState, useContext, useEffect, useCallback } from 'react';
import { SupabaseContext } from '../main';

export default function GroupManagerModal({ isOpen, onClose, session }) {
  const supabase = useContext(SupabaseContext);

  const [groups, setGroups] = useState([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [members, setMembers] = useState([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const loadGroups = useCallback(() => {
    if (!session) return;
    setIsLoadingGroups(true);
    supabase
      .from('Group')
      .select('*')
      .eq('owner_user_id', session.user.id)
      .order('created_at', { ascending: false })
      .then((result) => {
        setIsLoadingGroups(false);
        if (result.error) {
          console.error('שגיאה בטעינת קבוצות:', result.error.message);
          return;
        }
        setGroups(result.data || []);
      });
  }, [session, supabase]);

  const loadMembers = useCallback((groupId) => {
    setIsLoadingMembers(true);
    supabase
      .from('GroupMember')
      .select('*')
      .eq('group_id', groupId)
      .then((result) => {
        if (result.error || !result.data || result.data.length === 0) {
          setIsLoadingMembers(false);
          setMembers([]);
          return;
        }
        const memberRows = result.data;
        const ids = memberRows.map((m) => m.member_user_id);
        supabase
          .from('Profile')
          .select('id, display_name')
          .in('id', ids)
          .then((profResult) => {
            setIsLoadingMembers(false);
            const nameById = {};
            (profResult.data || []).forEach((p) => {
              nameById[p.id] = p.display_name;
            });
            const merged = memberRows.map((m) => ({
              id: m.id,
              member_user_id: m.member_user_id,
              display_name: nameById[m.member_user_id] || 'משתמש/ת',
            }));
            setMembers(merged);
          });
      });
  }, [supabase]);

  useEffect(() => {
    if (isOpen) {
      loadGroups();
      setSelectedGroupId(null);
      setMembers([]);
      setSearchQuery('');
      setSearchResults([]);
    }
  }, [isOpen, loadGroups]);

  useEffect(() => {
    if (selectedGroupId) {
      loadMembers(selectedGroupId);
    }
  }, [selectedGroupId, loadMembers]);

  // חיפוש משתמשות/ים לפי שם - עם דיליי קטן כדי לא לירות שאילתה על כל תו
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
          if (result.error) {
            console.error('שגיאה בחיפוש משתמשות:', result.error.message);
            return;
          }
          const existingMemberIds = members.map((m) => m.member_user_id);
          const filtered = (result.data || []).filter(
            (p) => p.id !== session.user.id && existingMemberIds.indexOf(p.id) === -1
          );
          setSearchResults(filtered);
        });
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, members, session, supabase]);

  if (!isOpen) return null;

  const handleCreateGroup = () => {
    const trimmed = newGroupName.trim();
    if (!trimmed) return;

    setIsCreatingGroup(true);
    supabase
      .from('Group')
      .insert([{ owner_user_id: session.user.id, name: trimmed }])
      .select()
      .single()
      .then((result) => {
        setIsCreatingGroup(false);
        if (result.error) {
          console.error('שגיאה ביצירת קבוצה:', result.error.message);
          alert('קרתה שגיאה ביצירת הקבוצה');
          return;
        }
        setNewGroupName('');
        setGroups((prev) => [result.data, ...prev]);
      });
  };

  const handleDeleteGroup = (group) => {
    const confirmed = window.confirm(`למחוק את הקבוצה "${group.name}"? התיוגים שהיא שימשה עבורם יוסרו.`);
    if (!confirmed) return;

    supabase
      .from('Group')
      .delete()
      .eq('id', group.id)
      .then((result) => {
        if (result.error) {
          console.error('שגיאה במחיקת קבוצה:', result.error.message);
          alert('קרתה שגיאה במחיקת הקבוצה');
          return;
        }
        setGroups((prev) => prev.filter((g) => g.id !== group.id));
        if (selectedGroupId === group.id) {
          setSelectedGroupId(null);
          setMembers([]);
        }
      });
  };

  const handleAddMember = (profile) => {
    supabase
      .from('GroupMember')
      .insert([{ group_id: selectedGroupId, member_user_id: profile.id }])
      .select()
      .single()
      .then((result) => {
        if (result.error) {
          console.error('שגיאה בהוספת חברה לקבוצה:', result.error.message);
          alert('קרתה שגיאה בהוספה');
          return;
        }
        setMembers((prev) => [...prev, { id: result.data.id, member_user_id: profile.id, display_name: profile.display_name }]);
        setSearchResults((prev) => prev.filter((p) => p.id !== profile.id));
      });
  };

  const handleRemoveMember = (memberRow) => {
    supabase
      .from('GroupMember')
      .delete()
      .eq('id', memberRow.id)
      .then((result) => {
        if (result.error) {
          console.error('שגיאה בהסרת חברה מהקבוצה:', result.error.message);
          alert('קרתה שגיאה בהסרה');
          return;
        }
        setMembers((prev) => prev.filter((m) => m.id !== memberRow.id));
      });
  };

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="w-full max-w-3xl bg-background border border-border rounded-2xl shadow-2xl mt-4 sm:mt-8 mb-4 sm:mb-8 flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 p-4 sm:p-5 border-b border-border shrink-0">
          <h2 className="text-base sm:text-xl font-bold">ניהול קבוצות</h2>
          <button
            type="button"
            onClick={onClose}
            title="סגירה"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-secondary hover:bg-secondary/70 transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-5">
          {/* עמודת הקבוצות */}
          <div>
            <div className="flex gap-1.5 mb-3">
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateGroup(); }}
                placeholder="שם קבוצה חדשה..."
                className="flex-1 bg-secondary/40 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
              />
              <button
                type="button"
                onClick={handleCreateGroup}
                disabled={isCreatingGroup || !newGroupName.trim()}
                className="shrink-0 bg-primary text-primary-foreground rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50"
              >
                +
              </button>
            </div>

            {isLoadingGroups ? (
              <p className="text-sm text-muted-foreground">טוענת קבוצות...</p>
            ) : groups.length === 0 ? (
              <p className="text-sm text-muted-foreground">עדיין אין לך קבוצות. צרי אחת למעלה.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {groups.map((group) => (
                  <div
                    key={group.id}
                    onClick={() => setSelectedGroupId(group.id)}
                    className={
                      'flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ' +
                      (selectedGroupId === group.id
                        ? 'bg-primary/15 border-primary/40'
                        : 'bg-card border-border hover:border-primary/30')
                    }
                  >
                    <span className="truncate">{group.name}</span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group); }}
                      title="מחיקת קבוצה"
                      className="shrink-0 text-muted-foreground hover:text-red-400 transition-colors"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* עמודת החברים בקבוצה הנבחרת */}
          <div className="border-t sm:border-t-0 sm:border-r border-border pt-4 sm:pt-0 sm:pr-5">
            {!selectedGroup ? (
              <p className="text-sm text-muted-foreground text-center py-8">בחרי קבוצה מהרשימה כדי לנהל את החברים בה</p>
            ) : (
              <React.Fragment>
                <h3 className="font-bold text-sm mb-3">חברות/ים ב"{selectedGroup.name}"</h3>

                <div className="mb-4">
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
                          onClick={() => handleAddMember(profile)}
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

                {isLoadingMembers ? (
                  <p className="text-sm text-muted-foreground">טוענת חברות...</p>
                ) : members.length === 0 ? (
                  <p className="text-sm text-muted-foreground">אין עדיין אף אחת בקבוצה הזו.</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {members.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm"
                      >
                        <span className="truncate">{member.display_name}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(member)}
                          title="הסרה מהקבוצה"
                          className="shrink-0 text-muted-foreground hover:text-red-400 transition-colors text-xs"
                        >
                          הסרה
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </React.Fragment>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}