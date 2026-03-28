import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, CalendarDays, Users, Clock, ChevronRight } from 'lucide-react';
import { visitsApi, Visit, VisitStatus } from '../../api/visits';

function formatDate(): string {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatRegisteredTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function visitStatusStyle(status: VisitStatus): { bg: string; text: string } {
  switch (status) {
    case 'registered':
      return { bg: 'var(--status-info-bg, rgba(59,130,246,0.1))', text: 'var(--status-info-text, #2563eb)' };
    case 'in_consultation':
      return { bg: 'var(--status-flagged-bg, rgba(109,40,217,0.1))', text: 'var(--status-flagged-text, #6d28d9)' };
    case 'discharged':
      return { bg: 'rgba(16,185,129,0.1)', text: 'var(--sla-safe)' };
    case 'cancelled':
      return { bg: 'var(--status-critical-bg, rgba(220,38,38,0.1))', text: 'var(--status-critical-text, var(--sla-breached))' };
    default:
      return { bg: 'var(--status-neutral-bg, var(--bg-base))', text: 'var(--status-neutral-text, var(--text-muted))' };
  }
}

type VisitPriority = 'routine' | 'urgent' | 'critical' | 'immediate';

function priorityStyle(priority: VisitPriority): { bg: string; text: string } {
  switch (priority) {
    case 'critical':
    case 'immediate':
      return { bg: 'rgba(220,38,38,0.1)', text: 'var(--sla-breached)' };
    case 'urgent':
      return { bg: 'rgba(245,158,11,0.1)', text: 'var(--sla-warning)' };
    default: // routine
      return { bg: 'rgba(16,185,129,0.1)', text: 'var(--sla-safe)' };
  }
}

function humanStatus(status: VisitStatus): string {
  return status.replace(/_/g, ' ');
}

// Collect distinct statuses across all visits for the breakdown panel
const STATUS_ORDER: VisitStatus[] = [
  'registered',
  'triaged',
  'waiting_for_doctor',
  'in_consultation',
  'awaiting_results',
  'treatment_in_progress',
  'admitted',
  'in_ward',
  'ready_for_discharge',
  'discharged',
  'cancelled',
];

function StatTile({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string | number;
  danger?: boolean;
}) {
  return (
    <div
      className="p-4 rounded-2xl border"
      style={{
        background: danger ? 'var(--bg-alert)' : 'var(--bg-card)',
        borderColor: danger ? 'var(--border-breach)' : 'var(--border-default)',
        boxShadow: 'var(--shadow-card)',
        borderRadius: 'var(--radius-card)',
      }}
    >
      <p className="text-label" style={{ color: 'var(--text-secondary)' }}>{label}</p>
      <p
        className="text-time-card tabular-nums mt-1"
        style={{ color: danger ? 'var(--sla-breached)' : 'var(--text-primary)' }}
      >
        {value}
      </p>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div
      className="h-12 rounded-xl animate-shimmer"
      style={{ borderRadius: 'var(--radius-card)' }}
    />
  );
}

export function ReceptionistDashboard() {
  const navigate = useNavigate();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadVisits = async () => {
    setIsLoading(true);
    try {
      const res = await visitsApi.list();
      const items = Array.isArray(res.data) ? res.data : (res.data as any).items ?? [];
      setVisits(items);
    } catch {
      // show empty state
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadVisits();
  }, []);

  const today = new Date().toDateString();
  const todayVisits = visits.filter(
    (v) => new Date(v.registered_at).toDateString() === today
  );
  const activeVisits = visits.filter(
    (v) => !['discharged', 'cancelled'].includes(v.status)
  );
  const waitingForTriage = visits.filter((v) => v.status === 'registered');

  // Status breakdown counts
  const statusCounts = STATUS_ORDER.reduce<Record<string, number>>((acc, s) => {
    const c = visits.filter((v) => v.status === s).length;
    if (c > 0) acc[s] = c;
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div
        className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}
      >
        <div>
          <h1 className="text-h1" style={{ color: 'var(--text-primary)' }}>
            Reception
          </h1>
          <p className="text-body-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {formatDate()}
          </p>
        </div>
        <button
          onClick={() => navigate('/patients')}
          className="flex items-center gap-2 px-4 py-2 text-body-sm font-semibold text-white hover:opacity-90 transition-opacity"
          style={{ background: 'var(--clinical-600)', borderRadius: 'var(--radius-button)' }}
        >
          <Plus size={15} />
          Register Patient
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <StatTile
              label="TODAY'S VISITS"
              value={isLoading ? ' - ' : todayVisits.length}
            />
            <StatTile
              label="ACTIVE PATIENTS"
              value={isLoading ? ' - ' : activeVisits.length}
            />
            <StatTile
              label="WAITING FOR TRIAGE"
              value={isLoading ? ' - ' : waitingForTriage.length}
              danger={waitingForTriage.length > 3}
            />
          </div>

          <div>
            <h2 className="text-h2 mb-3" style={{ color: 'var(--text-primary)' }}>
              Today's Visits
            </h2>

            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <SkeletonRow key={i} />
                ))}
              </div>
            ) : visits.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: 'var(--clinical-100)' }}
                >
                  <CalendarDays size={32} style={{ color: 'var(--clinical-600)' }} />
                </div>
                <p className="text-h3 mb-1" style={{ color: 'var(--text-primary)' }}>
                  No visits registered yet
                </p>
                <p className="text-body-sm mb-5" style={{ color: 'var(--text-muted)' }}>
                  Register a patient to get started.
                </p>
                <button
                  onClick={() => navigate('/patients')}
                  className="flex items-center gap-2 px-4 py-2 text-body-sm font-semibold text-white hover:opacity-90 transition-opacity"
                  style={{
                    background: 'var(--clinical-600)',
                    borderRadius: 'var(--radius-button)',
                  }}
                >
                  <Plus size={15} />
                  Register Patient
                </button>
              </div>
            ) : (
              <div
                className="rounded-2xl border overflow-hidden"
                style={{
                  borderColor: 'var(--border-default)',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <table className="w-full text-body-sm">
                  <thead>
                    <tr
                      className="border-b"
                      style={{
                        borderColor: 'var(--border-default)',
                        background: 'var(--bg-base)',
                      }}
                    >
                      {['Visit #', 'Patient', 'Type', 'Status', 'Priority', 'Registered', ''].map(
                        (col, i) => (
                          <th
                            key={i}
                            className="px-5 py-2.5 text-left text-label"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            {col}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody
                    className="divide-y"
                    style={{ borderColor: 'var(--border-default)' }}
                  >
                    {visits.map((visit) => {
                      const sBadge = visitStatusStyle(visit.status);
                      const pBadge = priorityStyle(visit.priority as VisitPriority);
                      return (
                        <tr
                          key={visit.id}
                          className="hover:bg-[var(--bg-row-hover)] transition-colors cursor-pointer"
                          onClick={() => navigate(`/visits/${visit.id}`)}
                        >
                          <td className="px-5 py-3">
                            <span
                              className="text-mono"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              {visit.visit_number}
                            </span>
                          </td>
                          <td
                            className="px-5 py-3 font-medium"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {visit.patient_name ?? 'Unknown Patient'}
                          </td>
                          <td
                            className="px-5 py-3 capitalize"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            {visit.visit_type.replace(/_/g, ' ')}
                          </td>
                          <td className="px-5 py-3">
                            <span
                              className="inline-flex items-center px-2 py-0.5 text-label font-semibold capitalize rounded-full"
                              style={{
                                background: sBadge.bg,
                                color: sBadge.text,
                                borderRadius: 'var(--radius-badge)',
                              }}
                            >
                              {humanStatus(visit.status)}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <span
                              className="inline-flex items-center px-2 py-0.5 text-label font-semibold capitalize rounded-full"
                              style={{
                                background: pBadge.bg,
                                color: pBadge.text,
                                borderRadius: 'var(--radius-badge)',
                              }}
                            >
                              {visit.priority}
                            </span>
                          </td>
                          <td
                            className="px-5 py-3"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            {formatRegisteredTime(visit.registered_at)}
                          </td>
                          <td className="px-5 py-3">
                            <ChevronRight
                              size={16}
                              style={{ color: 'var(--text-disabled)' }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div
          className="w-72 flex-shrink-0 flex flex-col border-l overflow-y-auto"
          style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}
        >
          <div className="px-4 pt-5 pb-4 border-b" style={{ borderColor: 'var(--border-default)' }}>
            <p className="text-label mb-3" style={{ color: 'var(--text-secondary)' }}>
              QUICK ACTIONS
            </p>
            <div className="space-y-2">
              <button
                onClick={() => navigate('/patients')}
                className="w-full flex items-center gap-3 p-3 rounded-xl border hover:bg-[var(--bg-row-hover)] transition-colors text-left"
                style={{
                  borderColor: 'var(--border-default)',
                  borderRadius: 'var(--radius-badge)',
                }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--clinical-100)' }}
                >
                  <Users size={15} style={{ color: 'var(--clinical-600)' }} />
                </div>
                <div>
                  <p className="text-body-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Register Patient
                  </p>
                  <p className="text-meta" style={{ color: 'var(--text-muted)' }}>
                    Add a new patient record
                  </p>
                </div>
              </button>
              <button
                onClick={() => navigate('/visits')}
                className="w-full flex items-center gap-3 p-3 rounded-xl border hover:bg-[var(--bg-row-hover)] transition-colors text-left"
                style={{
                  borderColor: 'var(--border-default)',
                  borderRadius: 'var(--radius-badge)',
                }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(16,185,129,0.1)' }}
                >
                  <CalendarDays size={15} style={{ color: 'var(--sla-safe)' }} />
                </div>
                <div>
                  <p className="text-body-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Manage Visits
                  </p>
                  <p className="text-meta" style={{ color: 'var(--text-muted)' }}>
                    View and update visits
                  </p>
                </div>
              </button>
              <button
                onClick={() => navigate('/visits?new=1')}
                className="w-full flex items-center gap-3 p-3 rounded-xl border hover:bg-[var(--bg-row-hover)] transition-colors text-left"
                style={{
                  borderColor: 'var(--border-default)',
                  borderRadius: 'var(--radius-badge)',
                }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(124,58,237,0.1)' }}
                >
                  <Plus size={15} style={{ color: '#7C3AED' }} />
                </div>
                <div>
                  <p className="text-body-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    New Visit
                  </p>
                  <p className="text-meta" style={{ color: 'var(--text-muted)' }}>
                    Open visit creation form
                  </p>
                </div>
              </button>
            </div>
          </div>

          <div className="px-4 py-4 flex-1">
            <p className="text-label mb-3" style={{ color: 'var(--text-secondary)' }}>
              STATUS BREAKDOWN
            </p>
            {Object.keys(statusCounts).length === 0 ? (
              <p className="text-body-sm" style={{ color: 'var(--text-disabled)' }}>
                No visits loaded yet.
              </p>
            ) : (
              <div className="space-y-2">
                {(Object.entries(statusCounts) as [VisitStatus, number][]).map(
                  ([status, count]) => {
                    const { text } = visitStatusStyle(status);
                    return (
                      <div
                        key={status}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: text }}
                          />
                          <span
                            className="text-body-sm capitalize"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            {humanStatus(status)}
                          </span>
                        </div>
                        <span
                          className="text-body-sm font-semibold tabular-nums"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {count}
                        </span>
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </div>

          <div
            className="px-4 py-4 border-t"
            style={{ borderColor: 'var(--border-default)', background: 'var(--bg-base)' }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Clock size={12} style={{ color: 'var(--text-muted)' }} />
                <span className="text-label" style={{ color: 'var(--text-secondary)' }}>
                  TODAY
                </span>
              </div>
              <span
                className="text-body-sm font-semibold tabular-nums"
                style={{ color: 'var(--text-primary)' }}
              >
                {todayVisits.length} visits
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
