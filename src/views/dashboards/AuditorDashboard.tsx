import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2, Clock, ShieldCheck, AlertTriangle,
  FileText, User, ChevronRight,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from 'recharts';
import { AuditRecord, AuditSeverity, Prescription } from '../../models/types';
import { auditsApi } from '../../api/audits';
import { prescriptionsApi } from '../../api/prescriptions';
import { useAnalyticsViewModel } from '../../viewModels/useAnalyticsViewModel';
import { useWebSocket } from '../../context/WebSocketContext';
import { AuditLogTable } from '../../components/ui/AuditLogTable';
import { toast } from 'sonner';
import { cn, withDoctorTitle, formatTimeEAT } from '../../lib/utils';

type Tab = 'review' | 'flags' | 'log' | 'security';
type ListResult<T> = T[] | { items?: T[] };

const SEVERITY_ORDER: Record<AuditSeverity, number> = {
  critical: 0,
  high:     1,
  medium:   2,
  low:      3,
};

const SEVERITY_CONFIG: Record<AuditSeverity, { bg: string; text: string; border: string }> = {
  critical: { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' },
  high:     { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' },
  medium:   { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
  low:      { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0' },
};

function formatAge(dateStr: string): string {
  const diffMin = (Date.now() - new Date(dateStr).getTime()) / 60000;
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${Math.floor(diffMin)}m ago`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function SeverityBadge({ severity }: { severity: AuditSeverity }) {
  const c = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG.low;
  return (
    <span
      className="text-label font-bold px-2 py-0.5 border flex-shrink-0"
      style={{ background: c.bg, color: c.text, borderColor: c.border, borderRadius: 'var(--radius-badge)' }}
    >
      {severity.toUpperCase()}
    </span>
  );
}

interface FlagRowProps {
  flag: AuditRecord;
}

function FlagRow({ flag }: FlagRowProps) {
  const navigate = useNavigate();
  const needsCountersign = flag.esig_required && !flag.countersigned && !flag.resolved;
  const isHighSeverity = flag.severity === 'critical' || flag.severity === 'high';
  const target = `/audits?rx=${encodeURIComponent(flag.rx_number ?? flag.prescription_id)}`;

  return (
    <div
      onClick={() => navigate(target)}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter') navigate(target); }}
      className={cn(
        'flex items-start gap-4 px-6 py-4 cursor-pointer hover:bg-[var(--bg-row-hover)] transition-colors',
        isHighSeverity && 'border-l-[3px]'
      )}
      style={isHighSeverity ? { borderLeftColor: 'var(--sla-breached)' } : {}}
    >
      <SeverityBadge severity={flag.severity} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-body-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {flag.issue}
          </span>
          {needsCountersign && (
            <span
              className="text-label font-bold px-2 py-0.5 border"
              style={{
                background: 'var(--bg-card-stat)',
                color: 'var(--border-stat)',
                borderColor: 'var(--border-stat)',
                borderRadius: 'var(--radius-badge)',
              }}
            >
              COUNTERSIGN REQUIRED
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-meta flex-wrap" style={{ color: 'var(--text-secondary)' }}>
          {flag.flag_code && <span className="text-mono">{flag.flag_code}</span>}
          {flag.drug_name && <span>{flag.drug_name}</span>}
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatAge(flag.created_at)}
          </span>
          <span className="text-mono">{flag.rx_number ?? flag.prescription_id.slice(-8)}</span>
        </div>
        {flag.recommendation && (
          <p className="text-meta mt-1 line-clamp-1" style={{ color: 'var(--text-muted)' }}>
            {flag.recommendation}
          </p>
        )}
      </div>

      <div className="flex-shrink-0 flex items-center self-center gap-2">
        {flag.resolved ? (
          <div className="flex items-center gap-1 text-body-sm font-semibold" style={{ color: 'var(--sla-safe)' }}>
            <CheckCircle2 className="w-4 h-4" />
            Resolved
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-body-sm font-semibold" style={{ color: 'var(--clinical-700)' }}>
            {needsCountersign ? 'Countersign' : 'Resolve'}
            <ChevronRight className="w-4 h-4" />
          </div>
        )}
      </div>
    </div>
  );
}

function fmtAge(dateStr: string): string {
  const diffMin = (Date.now() - new Date(dateStr).getTime()) / 60000;
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${Math.floor(diffMin)}m ago`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

interface RxReviewRowProps {
  rx: Prescription;
}

function RxReviewRow({ rx }: RxReviewRowProps) {
  const navigate = useNavigate();
  const elapsed = (Date.now() - new Date(rx.submitted_at ?? rx.created_at).getTime()) / 60000;
  const isUrgent = elapsed > 20 || rx.priority === 'stat' || rx.priority === 'urgent';

  return (
    <div
      onClick={() => navigate(`/prescriptions/${rx.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter') navigate(`/prescriptions/${rx.id}`); }}
      className={cn(
        'flex items-start gap-4 px-6 py-4 cursor-pointer hover:bg-[var(--bg-row-hover)] transition-colors',
        isUrgent && 'border-l-[3px]'
      )}
      style={isUrgent ? { borderLeftColor: 'var(--sla-breached)' } : {}}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: '#EFF6FF' }}
      >
        <FileText className="w-4 h-4" style={{ color: '#178A3D' }} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-body-sm font-bold" style={{ color: 'var(--clinical-700)' }}>
            {rx.rx_number ?? rx.id.slice(0, 8).toUpperCase()}
          </span>
          {rx.priority && (
            <span
              className="text-micro font-bold px-1.5 py-0.5 rounded-full"
              style={{
                background: rx.priority === 'stat' ? '#FEE2E2' : rx.priority === 'urgent' ? '#FEF3C7' : '#F0F9FF',
                color: rx.priority === 'stat' ? '#991B1B' : rx.priority === 'urgent' ? '#92400E' : '#0369A1',
              }}
            >
              {rx.priority.toUpperCase()}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-meta flex-wrap" style={{ color: 'var(--text-secondary)' }}>
          {rx.patient_name && (
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {rx.patient_name}
            </span>
          )}
          {rx.doctor_name && <span>{withDoctorTitle(rx.doctor_name)}</span>}
          {rx.department && <span>{rx.department}</span>}
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {fmtAge(rx.submitted_at ?? rx.created_at)}
          </span>
        </div>

        {rx.medications?.length > 0 && (
          <p className="text-meta mt-1 line-clamp-1" style={{ color: 'var(--text-muted)' }}>
            {rx.medications.map(m => `${m.name} ${m.dose}`).join(' · ')}
          </p>
        )}
      </div>

      <div className="flex-shrink-0 flex items-center gap-1.5 self-center text-body-sm font-semibold" style={{ color: 'var(--clinical-700)' }}>
        Review
        <ChevronRight className="w-4 h-4" />
      </div>
    </div>
  );
}

const SEVERITY_FILL: Record<AuditSeverity, string> = {
  critical: '#DC2626',
  high:     '#EA580C',
  medium:   '#D97706',
  low:      '#178A3D',
};

function fmtMin(min: number): string {
  if (!min || isNaN(min)) return '0m';
  if (min < 60) return `${Math.round(min)}m`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function AuditorCharts({ flags }: { flags: AuditRecord[] }) {
  const vm = useAnalyticsViewModel();
  useEffect(() => { vm.loadMetrics(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const stageData = vm.metrics ? [
    { stage: 'Order to Verify',    minutes: Math.round(vm.metrics.average_order_to_verify_minutes ?? 0) },
    { stage: 'Verify to Dispense', minutes: Math.round(vm.metrics.average_verify_to_dispense_minutes ?? 0) },
    { stage: 'Dispense to Admin',  minutes: Math.round(vm.metrics.average_dispense_to_administer_minutes ?? 0) },
  ] : [];

  const severityData = (['critical', 'high', 'medium', 'low'] as AuditSeverity[])
    .map(sev => ({ sev, label: sev.charAt(0).toUpperCase() + sev.slice(1), count: flags.filter(f => f.severity === sev).length }))
    .filter(d => d.count > 0);

  return (
    <div className="flex-shrink-0 grid grid-cols-1 lg:grid-cols-2 gap-4 px-6 py-4 border-b" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-base)' }}>
      <div className="rounded-lg p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        <h3 className="text-body-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Average TAT per Stage</h3>
        {stageData.every(d => d.minutes === 0) ? (
          <div className="flex items-center justify-center h-44 text-sm" style={{ color: 'var(--text-muted)' }}>No TAT data yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={stageData} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-3)" vertical={false} />
              <XAxis dataKey="stage" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} unit=" m" />
              <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} formatter={(v: number) => [fmtMin(v), 'Avg TAT']} />
              <Bar dataKey="minutes" fill="#178A3D" radius={[6, 6, 0, 0]} maxBarSize={64} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="rounded-lg p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        <h3 className="text-body-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Open Flags by Severity</h3>
        {severityData.length === 0 ? (
          <div className="flex items-center justify-center h-44 text-sm" style={{ color: 'var(--text-muted)' }}>No open flags.</div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={severityData} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-3)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} formatter={(v: number) => [v, 'Flags']} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={64}>
                {severityData.map(d => <Cell key={d.sev} fill={SEVERITY_FILL[d.sev]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export function AuditorDashboard() {
  const { subscribe } = useWebSocket();
  const [activeTab, setActiveTab] = useState<Tab>('review');
  const [pendingRx, setPendingRx] = useState<Prescription[]>([]);
  const [rxLoading, setRxLoading] = useState(true);
  const [flags, setFlags] = useState<AuditRecord[]>([]);
  const [logRecords, setLogRecords] = useState<AuditRecord[]>([]);
  const [securityEvents, setSecurityEvents] = useState<AuditRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [logLoading, setLogLoading] = useState(false);
  const [secLoading, setSecLoading] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState<AuditSeverity | 'all'>('all');

  const loadPendingRx = useCallback(async () => {
    setRxLoading(true);
    try {
      const res = await prescriptionsApi.list({ status: 'submitted', limit: 100 });
      const data = res.data as ListResult<Prescription>;
      const items = Array.isArray(data) ? data : data.items ?? [];
      setPendingRx(items.sort((a: Prescription, b: Prescription) =>
        new Date(a.submitted_at ?? a.created_at).getTime() - new Date(b.submitted_at ?? b.created_at).getTime()
      ));
    } catch {
      toast.error('Failed to load prescription queue.');
    } finally {
      setRxLoading(false);
    }
  }, []);

  const loadFlags = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await auditsApi.unresolved({ limit: 200 });
      const items = Array.isArray(res.data) ? res.data : [];
      setFlags(items.sort((a, b) =>
        (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99) ||
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      ));
    } catch {
      toast.error('Failed to load flags.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadLog = useCallback(async () => {
    setLogLoading(true);
    try {
      const res = await auditsApi.log({ limit: 200 });
      setLogRecords(Array.isArray(res.data) ? res.data : []);
    } catch {}
    finally { setLogLoading(false); }
  }, []);

  const loadSecurity = useCallback(async () => {
    setSecLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await auditsApi.getSecurityEvents(today);
      setSecurityEvents(Array.isArray(res.data) ? res.data : []);
    } catch {}
    finally { setSecLoading(false); }
  }, []);

  useEffect(() => { loadPendingRx(); loadFlags(); }, [loadPendingRx, loadFlags]);

  useEffect(() => {
    if (activeTab === 'log') loadLog();
    if (activeTab === 'security') loadSecurity();
  }, [activeTab, loadLog, loadSecurity]);

  useEffect(() => {
    const auditEvents = ['audit.flag_created', 'audit.flag_resolved', 'audit.countersigned', 'audit.flag_escalated'];
    const rxEvents = ['prescription.created', 'prescription.status_changed'];
    const unsubs = [
      ...auditEvents.map(ev => subscribe(ev, () => loadFlags())),
      ...rxEvents.map(ev => subscribe(ev, () => loadPendingRx())),
    ];
    return () => unsubs.forEach(u => u());
  }, [subscribe, loadFlags, loadPendingRx]);

  const handleAcknowledge = async (ids: string[]) => {
    try {
      await auditsApi.reviewSecurityEvents(ids);
      await loadSecurity();
      toast.success(`${ids.length} event${ids.length > 1 ? 's' : ''} acknowledged`);
    } catch {
      toast.error('Acknowledge failed');
    }
  };

  const stats = {
    pendingReview: pendingRx.length,
    open: flags.length,
    critical: flags.filter(f => f.severity === 'critical' || f.severity === 'high').length,
    countersignPending: flags.filter(f => f.esig_required && !f.countersigned && !f.resolved).length,
  };

  const oldestFlag = flags[flags.length - 1];
  const visibleFlags = filterSeverity === 'all' ? flags : flags.filter(f => f.severity === filterSeverity);

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: 'review',   label: 'Rx Review',      count: stats.pendingReview },
    { id: 'flags',    label: 'Open Flags',     count: stats.open },
    { id: 'log',      label: 'Audit Log' },
    { id: 'security', label: 'Security Review', count: securityEvents.length },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {stats.critical > 0 && (
        <div
          className="flex-shrink-0 flex items-center gap-3 px-6 py-2.5 animate-breach-pulse"
          style={{ background: 'var(--sla-breached)', borderBottom: '1px solid rgba(0,0,0,0.15)' }}
        >
          <AlertTriangle className="w-4 h-4 text-white flex-shrink-0" />
          <span className="text-body-sm font-bold text-white">
            {stats.critical} high-severity flag{stats.critical !== 1 ? 's' : ''} require attention
            {oldestFlag && ` - oldest: ${formatAge(oldestFlag.created_at)}`}
          </span>
          {stats.countersignPending > 0 && (
            <span
              className="ml-1 text-label font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}
            >
              {stats.countersignPending} countersign pending
            </span>
          )}
        </div>
      )}

      <div
        className="flex-shrink-0 grid grid-cols-2 lg:grid-cols-4 border-b"
        style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}
      >
        {[
          { label: 'Pending Review',   value: stats.pendingReview,      danger: stats.pendingReview > 0 },
          { label: 'Open Flags',       value: stats.open,               danger: stats.open > 0 },
          { label: 'High / Critical',  value: stats.critical,           danger: stats.critical > 0 },
          { label: 'Countersign Queue', value: stats.countersignPending, danger: stats.countersignPending > 0 },
        ].map(({ label, value, danger }, i) => (
          <div
            key={label}
            className={`px-6 py-3 ${i > 0 ? 'border-l' : ''}`}
            style={{ borderColor: 'var(--border-default)' }}
          >
            <p className="text-label" style={{ color: 'var(--text-secondary)' }}>{label}</p>
            <p
              className="text-time-card tabular-nums mt-0.5"
              style={{ color: danger && value > 0 ? 'var(--sla-breached)' : 'var(--text-primary)' }}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      <AuditorCharts flags={flags} />

      <div
        className="flex-shrink-0 flex gap-0 border-b"
        style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}
      >
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              'flex items-center gap-2 px-6 py-3 text-body-sm font-semibold border-b-2 transition-colors',
              activeTab === t.id
                ? 'border-[var(--clinical-600)] text-[var(--clinical-700)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            )}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span
                className="text-meta font-bold px-1.5 py-0.5 rounded-full"
                style={{
                  background: activeTab === t.id ? 'var(--clinical-100)' : 'var(--surface-3)',
                  color: activeTab === t.id ? 'var(--clinical-700)' : 'var(--text-secondary)',
                }}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">

        {activeTab === 'review' && (
          <div className="flex flex-col h-full">
            <div
              className="flex-shrink-0 flex items-center gap-3 px-6 py-3 border-b"
              style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}
            >
              <ShieldCheck className="w-4 h-4" style={{ color: 'var(--clinical-600)' }} />
              <p className="text-body-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                Review submitted prescriptions before they reach the pharmacy. Approve or return to the prescribing doctor.
              </p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {rxLoading ? (
                <div className="space-y-2 p-4">
                  {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-lg animate-shimmer" />)}
                </div>
              ) : pendingRx.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48">
                  <CheckCircle2 className="w-10 h-10 mb-2" style={{ color: 'var(--sla-safe)' }} />
                  <p className="text-body-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                    No prescriptions pending review
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-default)]">
                  {pendingRx.map(rx => (
                    <RxReviewRow key={rx.id} rx={rx} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'flags' && (
          <div className="flex flex-col h-full">
            <div
              className="flex-shrink-0 flex items-center gap-2 px-6 py-2.5 border-b sticky top-0"
              style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)', zIndex: 1 }}
            >
              <span className="text-label" style={{ color: 'var(--text-secondary)' }}>Filter:</span>
              {(['all', 'critical', 'high', 'medium', 'low'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setFilterSeverity(s)}
                  className={cn(
                    'px-3 py-1 text-body-sm font-semibold rounded-full transition-colors',
                    filterSeverity === s
                      ? 'text-white'
                      : 'border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-base)]'
                  )}
                  style={filterSeverity === s ? {
                    background: s === 'all' ? 'var(--clinical-600)' :
                      s === 'critical' || s === 'high' ? 'var(--sla-breached)' :
                      s === 'medium' ? 'var(--sla-warning)' : 'var(--sla-safe)',
                  } : {}}
                >
                  {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="space-y-2 p-4">
                  {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-lg animate-shimmer" />)}
                </div>
              ) : visibleFlags.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48">
                  <CheckCircle2 className="w-10 h-10 mb-2" style={{ color: 'var(--sla-safe)' }} />
                  <p className="text-body-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                    {filterSeverity === 'all' ? 'No open flags' : `No ${filterSeverity} flags`}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-default)]">
                  {visibleFlags.map(f => (
                    <FlagRow key={f.id} flag={f} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'log' && (
          <AuditLogTable records={logRecords} isLoading={logLoading} />
        )}

        {activeTab === 'security' && (
          <div className="h-full overflow-y-auto px-6 py-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-h3" style={{ color: 'var(--text-primary)' }}>Today's Security Events</h3>
                <p className="text-body-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
              </div>
              {securityEvents.length > 0 && (
                <button
                  onClick={() => handleAcknowledge(securityEvents.map(e => e.id))}
                  className="flex items-center gap-1.5 px-3 py-2 text-body-sm font-semibold text-white rounded-lg transition-colors"
                  style={{ background: 'var(--sla-safe)', borderRadius: 'var(--radius-button)' }}
                >
                  <ShieldCheck className="w-4 h-4" />
                  Acknowledge All
                </button>
              )}
            </div>

            {secLoading ? (
              <div className="space-y-2">
                {[1, 2].map(i => <div key={i} className="h-12 rounded-lg animate-shimmer" />)}
              </div>
            ) : securityEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <ShieldCheck className="w-10 h-10 mb-2" style={{ color: 'var(--sla-safe)' }} />
                <p className="text-body-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  No unreviewed security events today
                </p>
              </div>
            ) : (
              <div
                className="rounded-lg border overflow-hidden"
                style={{ borderColor: 'var(--border-default)' }}
              >
                <div className="divide-y divide-[var(--border-default)]">
                  {securityEvents.map(ev => (
                    <div
                      key={ev.id}
                      className="flex items-center gap-4 px-4 py-3 hover:bg-[var(--bg-row-hover)] transition-colors"
                    >
                      <span className="text-mono text-meta flex-shrink-0 w-20" style={{ color: 'var(--text-secondary)' }}>
                        {formatTimeEAT(ev.created_at)}
                      </span>
                      <span className="text-body-sm font-semibold flex-1" style={{ color: 'var(--text-primary)' }}>
                        {ev.issue}
                      </span>
                      <span className="text-meta flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                        {ev.created_by_role}
                      </span>
                      <button
                        onClick={() => handleAcknowledge([ev.id])}
                        className="text-body-sm font-semibold px-2.5 py-1 border rounded-lg hover:bg-[var(--bg-base)] transition-colors flex-shrink-0"
                        style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)', borderRadius: 'var(--radius-badge)' }}
                      >
                        Ack
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
