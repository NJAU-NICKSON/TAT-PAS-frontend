import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2, Clock, ShieldCheck, AlertTriangle, Loader2,
  ArrowLeftCircle, FileText, User,
} from 'lucide-react';
import { AuditRecord, AuditSeverity, Prescription } from '../../models/types';
import { auditsApi } from '../../api/audits';
import { prescriptionsApi } from '../../api/prescriptions';
import { useWebSocket, WSEvent } from '../../context/WebSocketContext';
import { CountersignModal } from '../../components/ui/CountersignModal';
import { AuditLogTable } from '../../components/ui/AuditLogTable';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

type Tab = 'review' | 'flags' | 'log' | 'security';

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

interface ResolveModalProps {
  flag: AuditRecord;
  onSuccess: () => void;
  onClose: () => void;
}

function ResolveModal({ flag, onSuccess, onClose }: ResolveModalProps) {
  const [note, setNote] = useState('');
  const [resType, setResType] = useState('accepted_risk');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = note.trim().length >= 20 && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await auditsApi.resolve(flag.prescription_id, note.trim(), resType);
      onSuccess();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: { message?: string } | string } } })
        ?.response?.data?.detail;
      const msg = typeof detail === 'object' ? detail?.message : typeof detail === 'string' ? detail : null;
      setError(msg ?? 'Resolution failed. Ensure all required countersigns are complete.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="w-full max-w-lg mx-4 rounded-2xl overflow-hidden animate-slide-up"
        style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-modal)' }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border-default)' }}>
          <h2 className="text-h3">Resolve Flag</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-base)]" style={{ color: 'var(--text-muted)' }}>
            oe-
          </button>
        </div>

        <div className="px-6 py-4 border-b" style={{ background: 'var(--bg-alert)', borderColor: 'var(--border-default)' }}>
          <div className="flex items-center gap-2 mb-1.5">
            <SeverityBadge severity={flag.severity} />
            {flag.flag_code && (
              <span className="text-mono text-body-sm" style={{ color: 'var(--text-secondary)' }}>{flag.flag_code}</span>
            )}
          </div>
          <p className="text-body-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{flag.issue}</p>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-label mb-1.5" style={{ color: 'var(--text-secondary)' }}>Resolution Type</label>
            <select
              value={resType}
              onChange={e => setResType(e.target.value)}
              className="w-full px-3 py-2 text-body-sm border rounded-xl focus:outline-none"
              style={{ borderColor: 'var(--border-default)', background: 'var(--bg-base)', borderRadius: 'var(--radius-button)' }}
            >
              <option value="accepted_risk">Accepted Risk</option>
              <option value="dose_adjusted">Dose Adjusted</option>
              <option value="drug_changed">Drug Changed</option>
              <option value="prescription_cancelled">Prescription Cancelled</option>
              <option value="false_positive">False Positive</option>
            </select>
          </div>

          <div>
            <label className="block text-label mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Resolution Note
              <span className="ml-1 font-normal normal-case" style={{ color: 'var(--text-muted)' }}>(min. 20 characters)</span>
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={4}
              placeholder="Describe the clinical rationale for this resolution"
              className="w-full px-3 py-2.5 text-body-sm border rounded-xl resize-none focus:outline-none"
              style={{
                borderColor: note.trim().length >= 20 ? 'var(--border-focus)' : 'var(--border-default)',
                background: 'var(--bg-base)',
                borderRadius: 'var(--radius-card)',
              }}
            />
            <p className="text-meta mt-1" style={{ color: note.trim().length >= 20 ? 'var(--sla-safe)' : 'var(--text-disabled)' }}>
              {note.trim().length}/20 minimum
            </p>
          </div>

          {error && (
            <div
              className="p-3 rounded-xl border text-body-sm font-medium"
              style={{ background: 'var(--bg-alert)', borderColor: 'var(--border-breach)', color: 'var(--sla-breached)' }}
            >
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: 'var(--border-default)' }}>
          <button
            onClick={onClose}
            className="px-4 py-2 text-body-sm font-semibold border rounded-xl hover:bg-[var(--bg-base)] transition-colors"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)', borderRadius: 'var(--radius-button)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex items-center gap-2 px-4 py-2 text-body-sm font-semibold text-white rounded-xl transition-colors disabled:opacity-40"
            style={{ background: 'var(--clinical-600)', borderRadius: 'var(--radius-button)' }}
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSubmitting ? 'Resolving' : 'Confirm Resolution'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface FlagRowProps {
  flag: AuditRecord;
  onResolve: (f: AuditRecord) => void;
  onCountersign: (f: AuditRecord) => void;
}

function FlagRow({ flag, onResolve, onCountersign }: FlagRowProps) {
  const needsCountersign = flag.esig_required && !flag.countersigned && !flag.resolved;
  const isHighSeverity = flag.severity === 'critical' || flag.severity === 'high';

  return (
    <div
      className={cn(
        'flex items-start gap-4 px-6 py-4 hover:bg-[var(--bg-row-hover)] transition-colors',
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

      <div className="flex-shrink-0 flex items-center gap-2">
        {flag.resolved ? (
          <div className="flex items-center gap-1 text-body-sm font-semibold" style={{ color: 'var(--sla-safe)' }}>
            <CheckCircle2 className="w-4 h-4" />
            Resolved
          </div>
        ) : (
          <>
            {needsCountersign && (
              <button
                onClick={() => onCountersign(flag)}
                className="px-3 py-1.5 text-body-sm font-semibold text-white rounded-lg transition-colors"
                style={{ background: 'var(--border-stat)', borderRadius: 'var(--radius-button)' }}
              >
                <ShieldCheck className="inline w-3.5 h-3.5 mr-1" />
                Countersign
              </button>
            )}
            <button
              onClick={() => onResolve(flag)}
              disabled={needsCountersign}
              className="px-3 py-1.5 text-body-sm font-semibold text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'var(--clinical-600)', borderRadius: 'var(--radius-button)' }}
            >
              Resolve
            </button>
          </>
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
  onApprove: (id: string) => void;
  onReturn: (rx: Prescription) => void;
  isActing: boolean;
}

function RxReviewRow({ rx, onApprove, onReturn, isActing }: RxReviewRowProps) {
  const elapsed = (Date.now() - new Date(rx.submitted_at ?? rx.created_at).getTime()) / 60000;
  const isUrgent = elapsed > 20 || rx.priority === 'stat' || rx.priority === 'urgent';

  return (
    <div
      className={cn(
        'flex items-start gap-4 px-6 py-4 hover:bg-[var(--bg-row-hover)] transition-colors',
        isUrgent && 'border-l-[3px]'
      )}
      style={isUrgent ? { borderLeftColor: 'var(--sla-breached)' } : {}}
    >
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: '#EFF6FF' }}
      >
        <FileText className="w-4 h-4" style={{ color: '#2563EB' }} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <Link
            to={`/prescriptions/${rx.id}`}
            className="text-body-sm font-bold hover:underline"
            style={{ color: 'var(--clinical-700)' }}
          >
            {rx.rx_number ?? rx.id.slice(0, 8).toUpperCase()}
          </Link>
          {rx.priority && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
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
          {rx.doctor_name && <span>Dr. {rx.doctor_name}</span>}
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

      <div className="flex-shrink-0 flex items-center gap-2">
        <button
          onClick={() => onReturn(rx)}
          disabled={isActing}
          className="px-3 py-1.5 text-body-sm font-semibold rounded-lg border transition-colors disabled:opacity-40"
          style={{
            background: '#FFFBEB',
            borderColor: '#FDE68A',
            color: '#92400E',
            borderRadius: 'var(--radius-button)',
          }}
        >
          <ArrowLeftCircle className="inline w-3.5 h-3.5 mr-1" />
          Return
        </button>
        <button
          onClick={() => onApprove(rx.id)}
          disabled={isActing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-body-sm font-semibold text-white rounded-lg transition-colors disabled:opacity-40"
          style={{ background: 'var(--clinical-600)', borderRadius: 'var(--radius-button)' }}
        >
          {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
          Approve
        </button>
      </div>
    </div>
  );
}

interface ReturnModalProps {
  rx: Prescription;
  onSuccess: () => void;
  onClose: () => void;
}

function ReturnModal({ rx, onSuccess, onClose }: ReturnModalProps) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (reason.trim().length < 10) return;
    setIsSubmitting(true);
    try {
      await prescriptionsApi.returnToDoctor(rx.id, reason.trim());
      toast.success('Prescription returned to doctor');
      onSuccess();
    } catch {
      toast.error('Failed to return prescription');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="w-full max-w-lg mx-4 rounded-2xl overflow-hidden animate-slide-up"
        style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-modal)' }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border-default)' }}>
          <div className="flex items-center gap-2">
            <ArrowLeftCircle className="w-5 h-5 text-amber-600" />
            <h2 className="text-h3">Return for Amendment</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-base)]" style={{ color: 'var(--text-muted)' }}>oe-</button>
        </div>

        <div className="px-6 py-4 border-b" style={{ background: 'rgba(245,158,11,0.06)', borderColor: 'var(--border-default)' }}>
          <p className="text-body-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {rx.rx_number ?? rx.id.slice(0, 8).toUpperCase()}  -  {rx.patient_name ?? 'Unknown Patient'}
          </p>
          <p className="text-meta mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Prescribed by Dr. {rx.doctor_name ?? 'Unknown Doctor'}
          </p>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-label mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Reason for Amendment <span className="text-[var(--sla-breached)]">*</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={4}
              placeholder="Explain why this prescription needs to be amended by the doctor..."
              className="w-full px-3 py-2.5 text-body-sm border rounded-xl resize-none focus:outline-none"
              style={{
                borderColor: reason.trim().length >= 10 ? 'var(--border-focus)' : 'var(--border-default)',
                background: 'var(--bg-base)',
                borderRadius: 'var(--radius-card)',
              }}
            />
            <p className="text-meta mt-1" style={{ color: reason.trim().length >= 10 ? 'var(--sla-safe)' : 'var(--text-disabled)' }}>
              {reason.trim().length}/10 minimum characters
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: 'var(--border-default)' }}>
          <button
            onClick={onClose}
            className="px-4 py-2 text-body-sm font-semibold border rounded-xl"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)', borderRadius: 'var(--radius-button)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={reason.trim().length < 10 || isSubmitting}
            className="flex items-center gap-2 px-4 py-2 text-body-sm font-semibold text-white rounded-xl disabled:opacity-40"
            style={{ background: '#D97706', borderRadius: 'var(--radius-button)' }}
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Return to Doctor
          </button>
        </div>
      </div>
    </div>
  );
}

export function AuditorDashboard() {
  const { subscribe } = useWebSocket();
  const [activeTab, setActiveTab] = useState<Tab>('review');
  const [pendingRx, setPendingRx] = useState<Prescription[]>([]);
  const [rxLoading, setRxLoading] = useState(true);
  const [actingRxId, setActingRxId] = useState<string | null>(null);
  const [returnTarget, setReturnTarget] = useState<Prescription | null>(null);
  const [flags, setFlags] = useState<AuditRecord[]>([]);
  const [logRecords, setLogRecords] = useState<AuditRecord[]>([]);
  const [securityEvents, setSecurityEvents] = useState<AuditRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [logLoading, setLogLoading] = useState(false);
  const [secLoading, setSecLoading] = useState(false);
  const [resolveTarget, setResolveTarget] = useState<AuditRecord | null>(null);
  const [countersignTarget, setCountersignTarget] = useState<AuditRecord | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<AuditSeverity | 'all'>('all');

  const loadPendingRx = useCallback(async () => {
    setRxLoading(true);
    try {
      const res = await prescriptionsApi.list({ status: 'submitted', limit: 100 });
      const items = Array.isArray(res.data) ? res.data : (res.data as any).items ?? [];
      setPendingRx(items.sort((a: Prescription, b: Prescription) =>
        new Date(a.submitted_at ?? a.created_at).getTime() - new Date(b.submitted_at ?? b.created_at).getTime()
      ));
    } catch {
      toast.error('Failed to load prescription queue.');
    } finally {
      setRxLoading(false);
    }
  }, []);

  const handleApprove = async (id: string) => {
    setActingRxId(id);
    try {
      await prescriptionsApi.approveForPharmacy(id);
      toast.success('Prescription approved for pharmacy');
      await loadPendingRx();
    } catch {
      toast.error('Failed to approve prescription');
    } finally {
      setActingRxId(null);
    }
  };

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
    } catch { /* non-critical */ }
    finally { setLogLoading(false); }
  }, []);

  const loadSecurity = useCallback(async () => {
    setSecLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await auditsApi.getSecurityEvents(today);
      setSecurityEvents(Array.isArray(res.data) ? res.data : []);
    } catch { /* non-critical */ }
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
      ...auditEvents.map(ev => subscribe(ev, (_: WSEvent) => loadFlags())),
      ...rxEvents.map(ev => subscribe(ev, (_: WSEvent) => loadPendingRx())),
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
            {oldestFlag && `  -  oldest: ${formatAge(oldestFlag.created_at)}`}
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
        className="flex-shrink-0 grid grid-cols-4 border-b"
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
                  {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl animate-shimmer" />)}
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
                    <RxReviewRow
                      key={rx.id}
                      rx={rx}
                      onApprove={handleApprove}
                      onReturn={rx => setReturnTarget(rx)}
                      isActing={actingRxId === rx.id}
                    />
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
                  {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl animate-shimmer" />)}
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
                    <FlagRow
                      key={f.id}
                      flag={f}
                      onResolve={flag => setResolveTarget(flag)}
                      onCountersign={flag => setCountersignTarget(flag)}
                    />
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
                  className="flex items-center gap-1.5 px-3 py-2 text-body-sm font-semibold text-white rounded-xl transition-colors"
                  style={{ background: 'var(--sla-safe)', borderRadius: 'var(--radius-button)' }}
                >
                  <ShieldCheck className="w-4 h-4" />
                  Acknowledge All
                </button>
              )}
            </div>

            {secLoading ? (
              <div className="space-y-2">
                {[1, 2].map(i => <div key={i} className="h-12 rounded-xl animate-shimmer" />)}
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
                className="rounded-2xl border overflow-hidden"
                style={{ borderColor: 'var(--border-default)' }}
              >
                <div className="divide-y divide-[var(--border-default)]">
                  {securityEvents.map(ev => (
                    <div
                      key={ev.id}
                      className="flex items-center gap-4 px-4 py-3 hover:bg-[var(--bg-row-hover)] transition-colors"
                    >
                      <span className="text-mono text-meta flex-shrink-0 w-20" style={{ color: 'var(--text-secondary)' }}>
                        {new Date(ev.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
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

      {returnTarget && (
        <ReturnModal
          rx={returnTarget}
          onSuccess={() => { setReturnTarget(null); loadPendingRx(); }}
          onClose={() => setReturnTarget(null)}
        />
      )}
      {resolveTarget && (
        <ResolveModal
          flag={resolveTarget}
          onSuccess={() => { setResolveTarget(null); loadFlags(); toast.success('Flag resolved'); }}
          onClose={() => setResolveTarget(null)}
        />
      )}
      {countersignTarget && (
        <CountersignModal
          flag={countersignTarget}
          onSuccess={() => { setCountersignTarget(null); loadFlags(); toast.success('Flag countersigned'); }}
          onClose={() => setCountersignTarget(null)}
        />
      )}
    </div>
  );
}
