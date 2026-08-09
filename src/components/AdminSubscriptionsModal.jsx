import React, { useState, useContext, useEffect } from 'react';
import { SupabaseContext } from '../main';

export default function AdminSubscriptionsModal(props) {
  var isOpen = props.isOpen;
  var onClose = props.onClose;

  var supabase = useContext(SupabaseContext);

  var rowsState = useState([]);
  var rows = rowsState[0];
  var setRows = rowsState[1];

  var isLoadingState = useState(false);
  var isLoading = isLoadingState[0];
  var setIsLoading = isLoadingState[1];

  var loadErrorState = useState(null);
  var loadError = loadErrorState[0];
  var setLoadError = loadErrorState[1];

  var savingIdState = useState(null);
  var savingId = savingIdState[0];
  var setSavingId = savingIdState[1];

  // המרה בין timestamptz (מה-DB) לפורמט yyyy-mm-dd (עבור <input type="date">)
  function toDateInputValue(isoString) {
    if (!isoString) return '';
    return isoString.slice(0, 10);
  }

  function loadProfessionals() {
    setIsLoading(true);
    setLoadError(null);

    supabase
      .from('ProfessionalProfile')
      .select('id, role_title, subscription_status, subscription_expires_at')
      .then(function (professionalResult) {
        if (professionalResult.error) {
          setIsLoading(false);
          setLoadError(professionalResult.error.message);
          return;
        }

        var professionalRows = professionalResult.data || [];
        var ids = professionalRows.map(function (r) { return r.id; });

        if (ids.length === 0) {
          setRows([]);
          setIsLoading(false);
          return;
        }

        supabase
          .from('Profile')
          .select('id, display_name')
          .in('id', ids)
          .then(function (profileResult) {
            setIsLoading(false);

            if (profileResult.error) {
              setLoadError(profileResult.error.message);
              return;
            }

            var nameById = {};
            (profileResult.data || []).forEach(function (p) {
              nameById[p.id] = p.display_name;
            });

            var merged = professionalRows.map(function (r) {
              return {
                id: r.id,
                displayName: nameById[r.id] || '(ללא שם)',
                role: r.role_title || '',
                statusDraft: r.subscription_status || 'inactive',
                expiresAtDraft: toDateInputValue(r.subscription_expires_at),
                savedStatus: r.subscription_status || 'inactive',
                savedExpiresAt: r.subscription_expires_at,
              };
            });

            merged.sort(function (a, b) {
              return a.displayName.localeCompare(b.displayName, 'he');
            });

            setRows(merged);
          });
      });
  }

  useEffect(function () {
    if (isOpen) {
      loadProfessionals();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  function handleStatusChange(rowId, newStatus) {
    setRows(function (prev) {
      return prev.map(function (r) {
        if (r.id !== rowId) return r;
        var copy = Object.assign({}, r);
        copy.statusDraft = newStatus;
        return copy;
      });
    });
  }

  function handleExpiresAtChange(rowId, newValue) {
    setRows(function (prev) {
      return prev.map(function (r) {
        if (r.id !== rowId) return r;
        var copy = Object.assign({}, r);
        copy.expiresAtDraft = newValue;
        return copy;
      });
    });
  }

  function handleSave(row) {
    setSavingId(row.id);

    var expiresAtToSend = row.expiresAtDraft ? row.expiresAtDraft : null;

    supabase.functions
      .invoke('admin-set-subscription', {
        body: {
          professional_user_id: row.id,
          subscription_status: row.statusDraft,
          subscription_expires_at: expiresAtToSend,
        },
      })
      .then(function (result) {
        setSavingId(null);

        if (result.error) {
          console.error('שגיאה בעדכון המנוי:', result.error.message);
          alert('קרתה שגיאה בעדכון המנוי: ' + result.error.message);
          return;
        }

        setRows(function (prev) {
          return prev.map(function (r) {
            if (r.id !== row.id) return r;
            var copy = Object.assign({}, r);
            copy.savedStatus = row.statusDraft;
            copy.savedExpiresAt = expiresAtToSend;
            return copy;
          });
        });
      });
  }

  function hasUnsavedChanges(row) {
    var expiresChanged = (row.expiresAtDraft || null) !== (toDateInputValue(row.savedExpiresAt) || null);
    return row.statusDraft !== row.savedStatus || expiresChanged;
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-card border border-border p-6 sm:p-8 rounded-2xl w-full max-w-2xl mt-8 mb-8 shadow-2xl">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl font-bold">ניהול מנויים (אדמין)</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-secondary hover:bg-secondary/70 transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-5">
          עדכון סטטוס מנוי לאנשי/נשות מקצוע. השינוי נכנס לתוקף מיד.
        </p>

        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-8">טוענת...</p>
        ) : null}

        {loadError ? (
          <p className="text-sm text-red-400 text-center py-4">שגיאה בטעינה: {loadError}</p>
        ) : null}

        {!isLoading && !loadError && rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">אין עדיין אנשי/נשות מקצוע רשומים.</p>
        ) : null}

        <div className="flex flex-col gap-3">
          {rows.map(function (row) {
            var unsaved = hasUnsavedChanges(row);
            var isSavingThisRow = savingId === row.id;

            return (
              <div key={row.id} className="border border-border rounded-xl p-3 sm:p-4">
                <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                  <div>
                    <p className="font-bold text-sm">{row.displayName}</p>
                    {row.role ? <p className="text-xs text-muted-foreground">{row.role}</p> : null}
                  </div>
                  <span
                    className={
                      'text-[11px] px-2 py-0.5 rounded-full font-medium ' +
                      (row.savedStatus === 'active'
                        ? 'bg-live/15 text-live'
                        : 'bg-secondary text-muted-foreground')
                    }
                  >
                    {row.savedStatus === 'active' ? 'מנוי פעיל' : 'ללא מנוי'}
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={row.statusDraft}
                    onChange={function (e) { handleStatusChange(row.id, e.target.value); }}
                    className="bg-secondary/50 border border-border rounded-lg px-2.5 py-1.5 text-xs outline-none"
                  >
                    <option value="inactive">ללא מנוי</option>
                    <option value="active">מנוי פעיל</option>
                  </select>

                  <input
                    type="date"
                    value={row.expiresAtDraft}
                    onChange={function (e) { handleExpiresAtChange(row.id, e.target.value); }}
                    disabled={row.statusDraft !== 'active'}
                    title="תאריך תפוגה (רלוונטי רק למנוי פעיל, אפשר להשאיר ריק = בלי תפוגה)"
                    className="bg-secondary/50 border border-border rounded-lg px-2.5 py-1.5 text-xs outline-none disabled:opacity-40"
                  />

                  <button
                    type="button"
                    onClick={function () { handleSave(row); }}
                    disabled={!unsaved || isSavingThisRow}
                    className="mr-auto bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-40 transition-opacity"
                  >
                    {isSavingThisRow ? 'שומרת...' : 'שמירה'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}