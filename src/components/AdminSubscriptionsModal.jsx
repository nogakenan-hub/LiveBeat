import React, { useState, useContext, useEffect } from 'react';
import { SupabaseContext } from '../main';

export default function AdminSubscriptionsModal(props) {
  var isOpen = props.isOpen;
  var onClose = props.onClose;

  var supabase = useContext(SupabaseContext);

  // חדש 20.08.2026 - טאב פנימי: מנויים (כמו קודם) או דיווחים (חדש - מאחד SketchReport+RoomReport)
  var activeTabState = useState('subscriptions');
  var activeTab = activeTabState[0];
  var setActiveTab = activeTabState[1];

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

  // חדש 20.08.2026 - state נפרד לרשימת הדיווחים המאוחדת
  var reportsState = useState([]);
  var reports = reportsState[0];
  var setReports = reportsState[1];

  var isLoadingReportsState = useState(false);
  var isLoadingReports = isLoadingReportsState[0];
  var setIsLoadingReports = isLoadingReportsState[1];

  var reportsErrorState = useState(null);
  var reportsError = reportsErrorState[0];
  var setReportsError = reportsErrorState[1];

  var reportsLoadedOnceState = useState(false);
  var reportsLoadedOnce = reportsLoadedOnceState[0];
  var setReportsLoadedOnce = reportsLoadedOnceState[1];

  // חדש 20.08.2026 - הצגת דיווחים בארכיון או לא. ברירת מחדל: מציגות רק פעילים (resolved=false).
  var showArchivedReportsState = useState(false);
  var showArchivedReports = showArchivedReportsState[0];
  var setShowArchivedReports = showArchivedReportsState[1];

  // חדש 20.08.2026 - id של הדיווח שנמצא כרגע בתהליך ארכוב/מחיקה, למניעת לחיצה כפולה
  var reportActionIdState = useState(null);
  var reportActionId = reportActionIdState[0];
  var setReportActionId = reportActionIdState[1];

  // המרה בין timestamptz (מה-DB) לפורמט yyyy-mm-dd (עבור <input type="date">)
  function toDateInputValue(isoString) {
    if (!isoString) return '';
    return isoString.slice(0, 10);
  }

  function formatDateTime(isoString) {
    if (!isoString) return '';
    return new Date(isoString).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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

  // חדש 20.08.2026 - טוענת בו-זמנית משתי הטבלאות (SketchReport + RoomReport), מאחדת למערך
  // אחד עם שדה type משותף, וממיינת מהחדש לישן לפי created_at. דורש שתי policies חדשות ל-SELECT
  // (מוגבלות ל-auth.uid() של האדמין בלבד) - בלעדיהן השאילתות יחזרו ריקות בשקט (לא שגיאה).
  function loadReports() {
    setIsLoadingReports(true);
    setReportsError(null);

    Promise.all([
      supabase.from('SketchReport').select('*').order('created_at', { ascending: false }),
      supabase.from('RoomReport').select('*').order('created_at', { ascending: false }),
    ]).then(function (results) {
      setIsLoadingReports(false);
      setReportsLoadedOnce(true);

      var sketchResult = results[0];
      var roomResult = results[1];

      if (sketchResult.error || roomResult.error) {
        var message = sketchResult.error ? sketchResult.error.message : roomResult.error.message;
        setReportsError(message);
        return;
      }

      var sketchReports = (sketchResult.data || []).map(function (r) {
        return {
          id: 'sketch-' + r.id,
          rawId: r.id,
          table: 'SketchReport',
          type: 'sketch',
          title: r.sketch_title || '(סקיצה שנמחקה)',
          subtitle: r.uploader_username ? 'יוצר/ת: ' + r.uploader_username : '',
          reporterDisplayName: r.reporter_display_name || 'אנונימי',
          reason: r.reason,
          createdAt: r.created_at,
          resolved: !!r.resolved,
        };
      });

      var roomReports = (roomResult.data || []).map(function (r) {
        return {
          id: 'room-' + r.id,
          rawId: r.id,
          table: 'RoomReport',
          type: 'room',
          title: r.reported_display_name ? 'דיווח על ' + r.reported_display_name : 'דיווח בחדר לייב',
          subtitle: '',
          reporterDisplayName: r.reporter_display_name || 'אנונימי',
          reason: r.reason,
          createdAt: r.created_at,
          resolved: !!r.resolved,
        };
      });

      var merged = sketchReports.concat(roomReports);
      merged.sort(function (a, b) {
        return new Date(b.createdAt) - new Date(a.createdAt);
      });

      setReports(merged);
    });
  }

  // חדש 20.08.2026 - ארכוב/שחזור דיווח (עדכון עמודת resolved), ומחיקה מוחלטת
  function handleToggleArchiveReport(report) {
    setReportActionId(report.id);

    supabase
      .from(report.table)
      .update({ resolved: !report.resolved })
      .eq('id', report.rawId)
      .then(function (result) {
        setReportActionId(null);
        if (result.error) {
          console.error('שגיאה בעדכון סטטוס הדיווח:', result.error.message);
          alert('קרתה שגיאה בעדכון הדיווח: ' + result.error.message);
          return;
        }
        setReports(function (prev) {
          return prev.map(function (r) {
            if (r.id !== report.id) return r;
            return Object.assign({}, r, { resolved: !report.resolved });
          });
        });
      });
  }

  function handleDeleteReport(report) {
    var confirmed = window.confirm('למחוק את הדיווח הזה לצמיתות? אי אפשר לשחזר.');
    if (!confirmed) return;

    setReportActionId(report.id);

    supabase
      .from(report.table)
      .delete()
      .eq('id', report.rawId)
      .then(function (result) {
        setReportActionId(null);
        if (result.error) {
          console.error('שגיאה במחיקת הדיווח:', result.error.message);
          alert('קרתה שגיאה במחיקת הדיווח: ' + result.error.message);
          return;
        }
        setReports(function (prev) {
          return prev.filter(function (r) { return r.id !== report.id; });
        });
      });
  }

  useEffect(function () {
    if (isOpen && activeTab === 'subscriptions') {
      loadProfessionals();
    }
    if (isOpen && activeTab === 'reports' && !reportsLoadedOnce) {
      loadReports();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeTab]);

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

  function tabButtonClass(isActive) {
    var base = 'px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ';
    if (isActive) {
      return base + 'bg-primary text-primary-foreground';
    }
    return base + 'bg-secondary text-muted-foreground hover:text-foreground';
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

        {/* חדש 20.08.2026 - מעבר בין מנויים לדיווחים */}
        <div className="flex gap-2 mb-4 mt-3">
          <button type="button" onClick={function () { setActiveTab('subscriptions'); }} className={tabButtonClass(activeTab === 'subscriptions')}>
            מנויים
          </button>
          <button type="button" onClick={function () { setActiveTab('reports'); }} className={tabButtonClass(activeTab === 'reports')}>
            דיווחים{(function () {
              var unresolvedCount = reports.filter(function (r) { return !r.resolved; }).length;
              return unresolvedCount > 0 ? ' (' + unresolvedCount + ')' : '';
            })()}
          </button>
        </div>

        {activeTab === 'subscriptions' ? (
          <React.Fragment>
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
          </React.Fragment>
        ) : (
          <React.Fragment>
            {/* חדש 20.08.2026 - טאב הדיווחים: מאחד SketchReport + RoomReport, מיון מהחדש לישן */}
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <p className="text-xs text-muted-foreground">
                דיווחים על סקיצות וחדרי לייב, מהחדש לישן.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={function () { setShowArchivedReports(function (prev) { return !prev; }); }}
                  className={tabButtonClass(showArchivedReports)}
                >
                  {showArchivedReports ? 'מציגה: בארכיון' : 'מציגה: פעילים'}
                </button>
                <button
                  type="button"
                  onClick={loadReports}
                  disabled={isLoadingReports}
                  className="text-xs bg-secondary hover:bg-secondary/70 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isLoadingReports ? 'מרעננת...' : 'רענון'}
                </button>
              </div>
            </div>

            {isLoadingReports ? (
              <p className="text-sm text-muted-foreground text-center py-8">טוענת...</p>
            ) : null}

            {reportsError ? (
              <p className="text-sm text-red-400 text-center py-4">שגיאה בטעינה: {reportsError}</p>
            ) : null}

            {(function () {
              var visibleReports = reports.filter(function (r) { return r.resolved === showArchivedReports; });

              if (!isLoadingReports && !reportsError && visibleReports.length === 0) {
                return (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    {showArchivedReports ? 'אין דיווחים בארכיון.' : 'אין דיווחים פעילים כרגע.'}
                  </p>
                );
              }

              return (
                <div className="flex flex-col gap-3">
                  {visibleReports.map(function (report) {
                    var typeLabel = report.type === 'sketch' ? 'סקיצה' : 'חדר לייב';
                    var typeBadgeClass = report.type === 'sketch'
                      ? 'text-[10px] font-medium bg-violet-700/60 text-white px-2 py-0.5 rounded-full'
                      : 'text-[10px] font-medium px-2 py-0.5 rounded-full'
                    var typeBadgeStyle = report.type === 'room' ? { background: 'var(--live-hex, #4fd18b)', color: '#0f1115' } : undefined;
                    var isActingOnThisRow = reportActionId === report.id;

                    return (
                      <div key={report.id} className="border border-border rounded-xl p-3 sm:p-4">
                        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className={typeBadgeClass} style={typeBadgeStyle}>{typeLabel}</span>
                            <p className="font-bold text-sm">{report.title}</p>
                          </div>
                          <span className="text-[11px] text-muted-foreground shrink-0">{formatDateTime(report.createdAt)}</span>
                        </div>
                        {report.subtitle ? (
                          <p className="text-xs text-muted-foreground mb-1.5">{report.subtitle}</p>
                        ) : null}
                        <p className="text-sm text-foreground/90 mb-1.5">{report.reason}</p>
                        <p className="text-[11px] text-muted-foreground mb-3">דווח על ידי: {report.reporterDisplayName}</p>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={function () { handleToggleArchiveReport(report); }}
                            disabled={isActingOnThisRow}
                            className="text-xs bg-secondary hover:bg-secondary/70 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {isActingOnThisRow ? '...' : (report.resolved ? 'שחזור מהארכיון' : 'העברה לארכיון')}
                          </button>
                          <button
                            type="button"
                            onClick={function () { handleDeleteReport(report); }}
                            disabled={isActingOnThisRow}
                            className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                          >
                            מחיקה
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </React.Fragment>
        )}
      </div>
    </div>
  );
}