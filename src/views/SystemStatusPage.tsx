import { useState, useEffect } from 'react';
import { Activity, Database, Server, Cpu, RefreshCw, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi, SystemHealth } from '../api/admin';

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

const COLLECTION_LABELS: Record<string, string> = {
  users: 'Users',
  patients: 'Patients',
  visits: 'Visits',
  prescriptions: 'Prescriptions',
  audit_records: 'Audit Records',
  beds: 'Beds',
  consultation_rooms: 'Consultation Rooms',
  departments: 'Departments',
  bills: 'Bills',
};

function StatusPill({ ok, okLabel, badLabel }: { ok: boolean; okLabel: string; badLabel: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{
        background: ok ? '#F0FDF4' : '#FEF2F2',
        color: ok ? '#15803D' : '#B91C1C',
        border: `1px solid ${ok ? '#86EFAC' : '#FCA5A5'}`,
      }}
    >
      {ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
      {ok ? okLabel : badLabel}
    </span>
  );
}

function StatCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-card)' }}>
      <div className="flex items-center gap-2 px-5 py-3.5" style={{ borderBottom: '1px solid var(--border-default)' }}>
        <span style={{ color: 'var(--clinical-600)' }}>{icon}</span>
        <span className="text-body-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</span>
      </div>
      <div className="px-5 py-4 space-y-2.5">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-caption" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="text-body-sm font-semibold text-right" style={{ color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}

export default function SystemStatusPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    adminApi.health()
      .then(res => setHealth(res.data))
      .catch(() => toast.error('Failed to load system status'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  const dbOk = health?.database === 'ok';
  const schedOk = health?.scheduler === 'ok';
  const overallOk = health?.status === 'ok';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-h1" style={{ color: 'var(--text-primary)' }}>System Status</h1>
          <p className="text-body-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Live health of the backend, database, and background jobs. Auto-refreshes every 30s.
          </p>
        </div>
        <button
          onClick={load} disabled={loading}
          className="p-2 rounded-lg border transition-colors hover:bg-[var(--bg-base)] disabled:opacity-60"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {!health ? (
        <div className="flex items-center gap-2 text-sm px-5 py-10" style={{ color: 'var(--text-muted)' }}>
          <Loader2 className="w-4 h-4 animate-spin" /> Loading system status…
        </div>
      ) : (
        <>
          <div
            className="flex items-center justify-between gap-3 px-5 py-4 flex-wrap"
            style={{
              background: overallOk ? '#F0FDF4' : '#FFFBEB',
              border: `1px solid ${overallOk ? '#86EFAC' : '#FCD34D'}`,
              borderRadius: 'var(--radius-card)',
            }}
          >
            <div className="flex items-center gap-3">
              {overallOk
                ? <CheckCircle2 className="w-6 h-6" style={{ color: '#15803D' }} />
                : <AlertTriangle className="w-6 h-6" style={{ color: '#B45309' }} />}
              <div>
                <p className="text-body font-semibold" style={{ color: overallOk ? '#15803D' : '#B45309' }}>
                  {overallOk ? 'All systems operational' : 'System degraded'}
                </p>
                <p className="text-caption" style={{ color: 'var(--text-muted)' }}>
                  Last checked {new Date(health.timestamp + 'Z').toLocaleTimeString()}
                </p>
              </div>
            </div>
            <StatusPill ok={overallOk} okLabel="Operational" badLabel="Degraded" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <StatCard icon={<Server className="w-4 h-4" />} title="Backend (API)">
              <Row label="Status" value={<StatusPill ok={true} okLabel="Running" badLabel="Down" />} />
              <Row label="Version" value={`v${health.version}`} />
              <Row label="Uptime" value={formatUptime(health.uptime_seconds)} />
              <Row label="Active modules" value={`${Object.values(health.modules).filter(c => c > 0).length} / ${Object.keys(health.modules).length}`} />
            </StatCard>

            <StatCard icon={<Database className="w-4 h-4" />} title="Database (MongoDB)">
              <Row label="Connection" value={<StatusPill ok={dbOk} okLabel="Connected" badLabel="Error" />} />
              <Row label="Database" value={health.database_name} />
              <Row label="Ping latency" value={health.database_latency_ms != null ? `${health.database_latency_ms} ms` : '-'} />
              <Row label="Collections" value={Object.keys(health.collection_counts).length} />
            </StatCard>

            <StatCard icon={<Cpu className="w-4 h-4" />} title="Background Jobs (Scheduler)">
              <Row label="Status" value={<StatusPill ok={schedOk} okLabel="Running" badLabel="Stopped" />} />
              <p className="text-caption pt-1" style={{ color: 'var(--text-muted)' }}>
                Runs the SLA breach scanner, daily report generation, and flag escalation.
              </p>
            </StatCard>

            <StatCard icon={<Activity className="w-4 h-4" />} title="Data Volume">
              {Object.entries(health.collection_counts).map(([coll, count]) => (
                <Row
                  key={coll}
                  label={COLLECTION_LABELS[coll] ?? coll}
                  value={<span className="tabular-nums">{count != null ? count.toLocaleString() : '-'}</span>}
                />
              ))}
            </StatCard>
          </div>
        </>
      )}
    </div>
  );
}
