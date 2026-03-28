import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Thermometer, Search, RefreshCw, Clock, AlertTriangle,
  ChevronRight, Activity, User, CheckCircle2, Loader2, ShieldOff,
} from 'lucide-react';
import { visitsApi, Visit } from '../api/visits';
import { useAuth } from '../context/AuthContext';

const PRIORITY_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  routine:   { bg: '#F0FDF4', color: '#166534', border: '#86EFAC' },
  urgent:    { bg: '#FFFBEB', color: '#92400E', border: '#FCD34D' },
  critical:  { bg: '#FEF2F2', color: '#991B1B', border: '#FCA5A5' },
  immediate: { bg: '#FFF1F2', color: '#9F1239', border: '#FDA4AF' },
};

const TRIAGE_SLA_MIN = 10; // target: triage within 10 min of registration

function useNow(intervalMs = 10000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function ElapsedBadge({ registeredAt }: { registeredAt: string }) {
  const now = useNow(10000);
  const min = Math.floor((now - new Date(registeredAt).getTime()) / 60000);
  const breached = min >= TRIAGE_SLA_MIN;
  const critical = min >= TRIAGE_SLA_MIN * 2;

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold tabular-nums"
      style={{
        background: critical ? '#7F1D1D' : breached ? '#FEF2F2' : '#F0FDF4',
        color: critical ? '#FCA5A5' : breached ? '#DC2626' : '#166534',
        border: `1px solid ${critical ? '#991B1B' : breached ? '#FCA5A5' : '#86EFAC'}`,
      }}
    >
      <Clock className="w-3 h-3" />
      {min < 60 ? `${min}m` : `${Math.floor(min / 60)}h ${min % 60}m`}
      {breached && <AlertTriangle className="w-3 h-3" />}
    </span>
  );
}

const VISIT_TYPE_LABEL: Record<string, string> = {
  opd: 'OPD', ipd: 'IPD', emergency: 'Emergency',
  day_surgery: 'Day Surgery', maternity: 'Maternity',
  paediatric: 'Paediatric', nicu: 'NICU',
};

function PatientCard({ visit, onClick }: { visit: Visit; onClick: () => void }) {
  const p = PRIORITY_STYLE[visit.priority] ?? PRIORITY_STYLE.routine;
  const now = useNow(10000);
  const waitMin = Math.floor((now - new Date(visit.registered_at).getTime()) / 60000);
  const breached = waitMin >= TRIAGE_SLA_MIN;

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl p-4 transition-all hover:shadow-md group"
      style={{
        background: 'white',
        border: `1.5px solid ${breached ? '#FCA5A5' : '#E2E8F0'}`,
      }}
    >
      <div className="flex items-start gap-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: p.bg, border: `1.5px solid ${p.border}` }}
        >
          <Activity className="w-5 h-5" style={{ color: p.color }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-sm font-bold text-gray-900">
              {visit.patient_name ?? 'Unknown Patient'}
            </span>
            <span
              className="text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider"
              style={{ background: p.bg, color: p.color, border: `1px solid ${p.border}` }}
            >
              {visit.priority}
            </span>
            {visit.visit_type === 'emergency' && (
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider" style={{ background: '#FEE2E2', color: '#DC2626' }}>
                Emergency
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-gray-400 font-mono">#{visit.visit_number}</span>
            <span className="text-xs text-gray-400">·</span>
            <span className="text-xs text-gray-500">{VISIT_TYPE_LABEL[visit.visit_type] ?? visit.visit_type}</span>
            {visit.chief_complaint && (
              <>
                <span className="text-xs text-gray-400">·</span>
                <span className="text-xs text-gray-600 truncate max-w-[200px]">{visit.chief_complaint}</span>
              </>
            )}
          </div>

          {visit.registered_by_name && (
            <div className="flex items-center gap-1 mt-1">
              <User className="w-3 h-3 text-gray-300" />
              <span className="text-[11px] text-gray-400">Registered by {visit.registered_by_name}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <ElapsedBadge registeredAt={visit.registered_at} />
          <span className="text-xs text-gray-400">
            {new Date(visit.registered_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <ChevronRight
            className="w-4 h-4 transition-transform group-hover:translate-x-0.5"
            style={{ color: '#94A3B8' }}
          />
        </div>
      </div>
    </button>
  );
}

function CompletedCard({ visit }: { visit: Visit }) {
  return (
    <div
      className="w-full text-left rounded-2xl p-4"
      style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', opacity: 0.75 }}
    >
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#F0FDF4' }}>
          <CheckCircle2 className="w-5 h-5 text-green-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="text-sm font-semibold text-gray-700">{visit.patient_name ?? 'Unknown'}</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#DCFCE7', color: '#166534' }}>
              Triaged
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="font-mono">#{visit.visit_number}</span>
            {visit.triage_nurse_name && <><span>·</span><span>by {visit.triage_nurse_name}</span></>}
            {visit.triaged_at && (
              <><span>·</span><span>{new Date(visit.triaged_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span></>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TriageQueuePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [pending,   setPending]   = useState<Visit[]>([]);
  const [completed, setCompleted] = useState<Visit[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pendingRes, recentRes] = await Promise.allSettled([
        visitsApi.list({ status: 'registered',         limit: 100 }),
        visitsApi.list({ status: 'waiting_for_doctor', limit: 50  }),
      ]);

      const pendingList: Visit[] = pendingRes.status === 'fulfilled'
        ? (Array.isArray(pendingRes.value.data)
            ? pendingRes.value.data
            : (pendingRes.value.data as { items: Visit[] }).items ?? [])
        : [];

      const recentList: Visit[] = recentRes.status === 'fulfilled'
        ? (Array.isArray(recentRes.value.data)
            ? recentRes.value.data
            : (recentRes.value.data as { items: Visit[] }).items ?? [])
        : [];

      // Sort pending: immediate first, then critical, urgent, routine; within same priority by wait time
      const PRIORITY_ORDER: Record<string, number> = { immediate: 0, critical: 1, urgent: 2, routine: 3 };
      pendingList.sort((a, b) => {
        const pd = (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3);
        if (pd !== 0) return pd;
        return new Date(a.registered_at).getTime() - new Date(b.registered_at).getTime();
      });

      // Completed = triaged today (waiting_for_doctor), sorted most recent first
      recentList.sort((a, b) =>
        new Date(b.triaged_at ?? b.updated_at).getTime() - new Date(a.triaged_at ?? a.updated_at).getTime()
      );

      setPending(pendingList);
      setCompleted(recentList.slice(0, 20));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const q = search.toLowerCase();
  const filteredPending = pending.filter(v =>
    !q ||
    (v.patient_name ?? '').toLowerCase().includes(q) ||
    v.visit_number.toLowerCase().includes(q) ||
    (v.chief_complaint ?? '').toLowerCase().includes(q)
  );

  const breachedCount = pending.filter(v => {
    const min = Math.floor((Date.now() - new Date(v.registered_at).getTime()) / 60000);
    return min >= TRIAGE_SLA_MIN;
  }).length;

  if (!user || !['nurse', 'admin'].includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F1F5F9' }}>
        <div className="flex flex-col items-center gap-3 text-center p-8">
          <ShieldOff className="w-10 h-10 text-gray-400" />
          <p className="text-base font-semibold text-gray-700">Access Restricted</p>
          <p className="text-sm text-gray-400">Your role (<strong>{user?.role ?? 'unknown'}</strong>) does not have access to the Triage Queue.</p>
          <button onClick={() => navigate('/dashboard')} className="mt-2 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: '#2563EB' }}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#F1F5F9' }}>
      <div style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 60%, #2563EB 100%)' }}>
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(217,119,6,0.3)' }}
              >
                <Thermometer className="w-6 h-6 text-amber-300" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Triage Queue</h1>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  {loading ? 'Loading' : `${pending.length} patient${pending.length !== 1 ? 's' : ''} awaiting triage`}
                  {breachedCount > 0 && (
                    <span className="ml-2 font-bold text-red-300">
                      · {breachedCount} overdue
                    </span>
                  )}
                </p>
              </div>
            </div>

            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{ background: 'rgba(255,255,255,0.12)', color: 'white' }}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Refresh
            </button>
          </div>

          <div className="grid grid-cols-4 gap-3 mt-5">
            {[
              { label: 'Pending',   value: pending.length,  color: '#FCD34D', bg: 'rgba(217,119,6,0.2)'  },
              { label: 'SLA Breach',value: breachedCount,   color: '#FCA5A5', bg: 'rgba(220,38,38,0.2)'  },
              { label: 'Immediate', value: pending.filter(v => v.priority === 'immediate').length, color: '#FDA4AF', bg: 'rgba(159,18,57,0.25)' },
              { label: 'Critical',  value: pending.filter(v => v.priority === 'critical').length,  color: '#FCA5A5', bg: 'rgba(220,38,38,0.2)'  },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className="rounded-xl px-3 py-2.5 text-center" style={{ background: bg }}>
                <p className="text-2xl font-extrabold tabular-nums" style={{ color }}>{value}</p>
                <p className="text-[11px] font-semibold mt-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">

        <div
          className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-white"
          style={{ border: '1.5px solid #E2E8F0' }}
        >
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search by patient name, visit number, or complaint"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 text-sm text-gray-800 bg-transparent outline-none placeholder:text-gray-400"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600 text-xs font-medium">
              Clear
            </button>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold text-white"
                style={{ background: pending.length > 0 ? '#D97706' : '#94A3B8' }}
              >
                {filteredPending.length}
              </span>
              Awaiting Triage
            </h2>
            <span className="text-xs text-gray-400">SLA target: {TRIAGE_SLA_MIN} min from arrival</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
            </div>
          ) : filteredPending.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-12 rounded-2xl"
              style={{ background: 'white', border: '1.5px dashed #E2E8F0' }}
            >
              <CheckCircle2 className="w-10 h-10 text-green-400 mb-3" />
              <p className="text-sm font-semibold text-gray-600">
                {search ? 'No patients match your search' : 'No patients awaiting triage'}
              </p>
              <p className="text-xs text-gray-400 mt-1">Queue is clear</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredPending.map(v => (
                <PatientCard
                  key={v.id}
                  visit={v}
                  onClick={() => navigate(`/visits/${v.id}/triage`)}
                />
              ))}
            </div>
          )}
        </div>

        {completed.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              Recently Triaged
            </h2>
            <div className="space-y-2">
              {completed.map(v => (
                <CompletedCard key={v.id} visit={v} />
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
