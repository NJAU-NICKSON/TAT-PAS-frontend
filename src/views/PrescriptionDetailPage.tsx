import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  AlertTriangle, User, ShieldCheck, Loader2, ChevronLeft,
  CheckCircle2, ArrowLeftCircle, Syringe, FileText, Printer,
  FlaskConical, RefreshCw, X,
} from 'lucide-react';
import { prescriptionsApi } from '../api/prescriptions';
import { auditsApi } from '../api/audits';
import { visitsApi } from '../api/visits';
import { useAuth } from '../context/AuthContext';
import { Prescription, AuditRecord } from '../models/types';
import { cn } from '../lib/utils';
import { printPrescription, printDispensingReceipt, FollowUp } from '../lib/printDocs';
import { toast } from 'sonner';

type ListResult<T> = T[] | { items?: T[] };

function looksLikeObjectId(value?: string | null): boolean {
  return Boolean(value && /^[a-f0-9]{24}$/i.test(value));
}

function displayName(value?: string | null, fallback = 'Unknown user'): string {
  if (!value || !value.trim()) return fallback;
  return looksLikeObjectId(value) ? fallback : value.trim();
}

function fmt(iso?: string): string {
  if (!iso) return ' - ';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtTime(iso?: string): string {
  if (!iso) return ' - ';
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function fmtDuration(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  draft:              { label: 'Draft',            bg: '#F8FAFC', text: '#64748B', border: '#CBD5E1' },
  submitted:          { label: 'Submitted',        bg: '#F0FDF4', text: '#0F6E2F', border: '#BFDBFE' },
  pending_amendment:  { label: 'Amend Required',   bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' },
  flagged:            { label: 'Flagged',           bg: '#FAF5FF', text: '#6B21A8', border: '#E9D5FF' },
  verified:           { label: 'Auditor Approved',  bg: '#F0FDF4', text: '#166534', border: '#BBF7D0' },
  dispensed:          { label: 'Dispensed',         bg: '#F0F9FF', text: '#075985', border: '#BAE6FD' },
  administered:       { label: 'Administered',      bg: '#F0FDF4', text: '#166534', border: '#BBF7D0' },
  archived:           { label: 'Archived',          bg: '#F8FAFC', text: '#64748B', border: '#CBD5E1' },
};

function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border"
      style={{ background: cfg.bg, color: cfg.text, borderColor: cfg.border }}
    >
      {cfg.label}
    </span>
  );
}

interface TimelineEntry {
  id: string;
  status: string;
  label: string;
  actor?: string;
  actorRole?: string;
  time?: string;
  note?: string;
  isAmendment?: boolean;
  isFlag?: boolean;
  isCurrent?: boolean;
}

function buildTimeline(rx: Prescription, flags: AuditRecord[]): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  entries.push({
    id: 'ordered',
    status: 'ordered',
    label: 'Prescription Ordered',
    actor: displayName(rx.doctor_name, 'Doctor'),
    actorRole: 'doctor',
    time: rx.ordered_at ?? rx.created_at,
  });

  if (rx.submitted_at) {
    entries.push({
      id: 'submitted',
      status: 'submitted',
      label: 'Submitted for Audit Review',
      actor: displayName(rx.doctor_name, 'Doctor'),
      actorRole: 'doctor',
      time: rx.submitted_at,
    });
  }

  for (const flag of flags) {
    entries.push({
      id: `flag-${flag.id}`,
      status: 'flagged',
      label: `Flag Raised: ${flag.issue}`,
      actor: displayName(flag.created_by, flag.created_by_role || 'System'),
      actorRole: flag.created_by_role,
      time: flag.created_at,
      note: flag.recommendation,
      isFlag: true,
    });
    if (flag.resolved && flag.resolved_at) {
      entries.push({
        id: `flag-resolved-${flag.id}`,
        status: 'resolved',
        label: `Flag Resolved: ${flag.resolution_type ?? 'resolved'}`,
        actor: displayName(flag.resolved_by, 'Auditor'),
        actorRole: 'auditor',
        time: flag.resolved_at,
        note: flag.resolution_note,
      });
    }
  }

  if (rx.returned_at) {
    entries.push({
      id: 'returned',
      status: 'pending_amendment',
      label: 'Returned for Amendment',
      actor: displayName(rx.auditor_name, 'Auditor'),
      actorRole: 'auditor',
      time: rx.returned_at,
      note: rx.return_reason,
      isAmendment: true,
    });
  }

  if (rx.auditor_approved_at) {
    entries.push({
      id: 'approved',
      status: 'verified',
      label: 'Approved for Pharmacy',
      actor: displayName(rx.auditor_name, 'Auditor'),
      actorRole: 'auditor',
      time: rx.auditor_approved_at,
    });
  } else if (rx.verified_at && !rx.auditor_approved_at) {
    entries.push({
      id: 'verified',
      status: 'verified',
      label: 'Verified',
      time: rx.verified_at,
    });
  }

  if (rx.dispensed_at) {
    entries.push({
      id: 'dispensed',
      status: 'dispensed',
      label: 'Dispensed',
      actor: displayName(rx.dispensed_by_name, 'Pharmacist'),
      actorRole: 'pharmacist',
      time: rx.dispensed_at,
      note: rx.receipt_number ? `Receipt #${rx.receipt_number}` : rx.pharmacist_comment,
    });
  }

  if (rx.administered_at) {
    entries.push({
      id: 'administered',
      status: 'administered',
      label: 'Administered to Patient',
      actor: displayName(rx.administered_by_name, 'Nurse'),
      actorRole: 'nurse',
      time: rx.administered_at,
      note: rx.administered_dose
        ? `${rx.administered_dose} via ${rx.administered_route ?? 'N/A'}${rx.administration_notes ? `  -  ${rx.administration_notes}` : ''}`
        : undefined,
    });
  }

  entries.sort((a, b) => {
    if (!a.time) return -1;
    if (!b.time) return 1;
    return new Date(a.time).getTime() - new Date(b.time).getTime();
  });

  if (entries.length > 0) {
    entries[entries.length - 1].isCurrent = true;
  }

  return entries;
}

const ROLE_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  doctor:     { bg: '#F0FDF4', color: '#0F6E2F', label: 'Doctor' },
  auditor:    { bg: '#FAF5FF', color: '#6B21A8', label: 'Auditor' },
  pharmacist: { bg: '#F0FDF4', color: '#166534', label: 'Pharmacist' },
  nurse:      { bg: '#FFF7ED', color: '#9A3412', label: 'Nurse' },
  ordered:    { bg: '#F8FAFC', color: '#64748B', label: 'System' },
  resolved:   { bg: '#F0FDF4', color: '#166534', label: 'Auditor' },
  flagged:    { bg: '#FEF2F2', color: '#991B1B', label: 'System' },
};

const TIMELINE_DOT: Record<string, { bg: string; border: string }> = {
  ordered:           { bg: '#DBEAFE', border: '#1FA64A' },
  submitted:         { bg: '#DBEAFE', border: '#178A3D' },
  pending_amendment: { bg: '#FEF3C7', border: '#D97706' },
  flagged:           { bg: '#FEE2E2', border: '#EF4444' },
  resolved:          { bg: '#DCFCE7', border: '#22C55E' },
  verified:          { bg: '#DCFCE7', border: '#16A34A' },
  dispensed:         { bg: '#E0F2FE', border: '#0284C7' },
  administered:      { bg: '#DCFCE7', border: '#15803D' },
};

function TimelineStep({ entry, isLast }: { entry: TimelineEntry; isLast: boolean }) {
  const dot = TIMELINE_DOT[entry.status] ?? { bg: '#F1F5F9', border: '#94A3B8' };
  const roleCfg = ROLE_BADGE[entry.actorRole ?? entry.status] ?? { bg: '#F1F5F9', color: '#64748B', label: entry.actorRole ?? '' };

  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div
          className="w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0"
          style={{ background: dot.bg, borderColor: dot.border }}
        >
          {entry.status === 'administered' && <Syringe className="w-3.5 h-3.5" style={{ color: dot.border }} />}
          {entry.status === 'dispensed' && <FlaskConical className="w-3.5 h-3.5" style={{ color: dot.border }} />}
          {entry.status === 'verified' && <ShieldCheck className="w-3.5 h-3.5" style={{ color: dot.border }} />}
          {entry.status === 'pending_amendment' && <ArrowLeftCircle className="w-3.5 h-3.5" style={{ color: dot.border }} />}
          {entry.status === 'flagged' && <AlertTriangle className="w-3.5 h-3.5" style={{ color: dot.border }} />}
          {entry.status === 'resolved' && <CheckCircle2 className="w-3.5 h-3.5" style={{ color: dot.border }} />}
          {(entry.status === 'ordered' || entry.status === 'submitted') && <FileText className="w-3.5 h-3.5" style={{ color: dot.border }} />}
        </div>
        {!isLast && <div className="w-0.5 flex-1 mt-1" style={{ background: '#E2E8F0', minHeight: '20px' }} />}
      </div>

      <div className="flex-1 pb-6">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <p className="font-semibold text-sm" style={{ color: '#0F172A' }}>{entry.label}</p>
            {entry.actor && (
              <div className="flex items-center gap-2 mt-1">
                <User className="w-3 h-3" style={{ color: '#94A3B8' }} />
                <span className="text-xs font-medium" style={{ color: '#475569' }}>{entry.actor}</span>
                {entry.actorRole && (
                  <span
                    className="text-micro font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: roleCfg.bg, color: roleCfg.color }}
                  >
                    {roleCfg.label.toUpperCase()}
                  </span>
                )}
              </div>
            )}
            {entry.note && (
              <p className="text-xs mt-1 leading-relaxed" style={{ color: '#64748B' }}>{entry.note}</p>
            )}
          </div>
          {entry.time && (
            <div className="text-right flex-shrink-0">
              <p className="text-xs font-semibold tabular-nums" style={{ color: '#475569' }}>{fmtTime(entry.time)}</p>
              <p className="text-micro" style={{ color: '#94A3B8' }}>
                {new Date(entry.time).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReturnToDoctorModal({
  rxId,
  onSuccess,
  onClose,
}: {
  rxId: string;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (reason.trim().length < 10) return;
    setIsSubmitting(true);
    try {
      await prescriptionsApi.returnToDoctor(rxId, reason.trim());
      toast.success('Prescription returned to doctor for amendment');
      onSuccess();
    } catch {
      toast.error('Failed to return prescription');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md mx-4 rounded-lg overflow-hidden bg-white shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <ArrowLeftCircle className="w-5 h-5 text-amber-600" />
            <h2 className="font-semibold text-gray-900">Return for Amendment</h2>
          </div>
          <button onClick={onClose} aria-label="Close"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-600">
            Provide a clear reason for returning this prescription. The doctor will be notified and must resubmit after making amendments.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Reason for Amendment <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={4}
              placeholder="e.g. Dose exceeds maximum recommended for patient weight, please review and adjust..."
              className="w-full px-3 py-2.5 text-sm border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-amber-500"
              style={{ borderColor: reason.trim().length >= 10 ? '#F59E0B' : '#D1D5DB' }}
            />
            <p className="text-xs mt-1" style={{ color: reason.trim().length >= 10 ? '#178A3D' : '#94A3B8' }}>
              {reason.trim().length}/10 minimum characters
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
          <button onClick={onClose} aria-label="Close" className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg bg-white hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={reason.trim().length < 10 || isSubmitting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-40"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Return to Doctor
          </button>
        </div>
      </div>
    </div>
  );
}

function DispenseModal({
  rx,
  followUp,
  onSuccess,
  onClose,
}: {
  rx: Prescription;
  followUp?: FollowUp;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [receiptNumber, setReceiptNumber] = useState('');
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDispense = async () => {
    setIsSubmitting(true);
    try {
      await prescriptionsApi.updateStatus(rx.id, 'dispensed', {
        pharmacist_comment: comment.trim() || undefined,
        receipt_number: receiptNumber.trim() || undefined,
      });
      toast.success('Prescription dispensed');
      onSuccess();
    } catch {
      toast.error('Failed to dispense prescription');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg mx-4 rounded-lg overflow-hidden bg-white shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-green-700" />
            <h2 className="font-semibold text-gray-900">Dispense Prescription</h2>
          </div>
          <button onClick={onClose} aria-label="Close"><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="mx-6 mt-5 border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-green-700 px-4 py-2.5 flex items-center justify-between">
            <span className="text-sm font-bold text-white">Dispensing Receipt</span>
            <button onClick={() => printDispensingReceipt(rx, followUp)} className="flex items-center gap-1 text-xs text-white/80 hover:text-white">
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>
          </div>
          <div className="px-4 py-4 bg-gray-50 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Rx #</span>
              <span className="font-mono font-semibold text-gray-800">{rx.rx_number ?? rx.id.slice(0, 8).toUpperCase()}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Patient</span>
              <span className="font-semibold text-gray-800">{displayName(rx.patient_name, 'Unknown Patient')}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Prescribing Doctor</span>
              <span className="font-semibold text-gray-800">{displayName(rx.doctor_name, 'Doctor')}</span>
            </div>
            {rx.auditor_name && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Auditor Approved By</span>
                <span className="font-semibold text-green-800">{rx.auditor_name}</span>
              </div>
            )}
            <div className="border-t border-dashed border-gray-300 my-2" />
            {rx.medications.map((med, i) => (
              <div key={i} className="text-xs">
                <span className="font-semibold text-gray-800">{med.name}</span>
                <span className="text-gray-500 ml-2">{med.dose} · {med.route} · {med.frequency} · {med.duration_days}d</span>
              </div>
            ))}
            <div className="border-t border-dashed border-gray-300 my-2" />
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Date/Time</span>
              <span className="font-semibold text-gray-800">{fmt(new Date().toISOString())}</span>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Receipt Number (optional)</label>
            <input
              type="text"
              value={receiptNumber}
              onChange={e => setReceiptNumber(e.target.value)}
              placeholder="e.g. RCP-20250321-001"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Pharmacist Notes (optional)</label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={2}
              placeholder="Any notes on dispensing, substitutions, counselling given..."
              className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
          <button onClick={onClose} aria-label="Close" className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg bg-white hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleDispense}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg bg-green-700 hover:bg-green-800 disabled:opacity-40"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Confirm Dispense
          </button>
        </div>
      </div>
    </div>
  );
}

function AdministerModal({
  rx,
  onSuccess,
  onClose,
}: {
  rx: Prescription;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const now = new Date();
  const localISO = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  const [dose, setDose] = useState(rx.medications[0]?.dose ?? '');
  const [route, setRoute] = useState(rx.medications[0]?.route ?? 'oral');
  const [adminTime, setAdminTime] = useState(localISO);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!dose.trim()) return;
    setIsSubmitting(true);
    try {
      await prescriptionsApi.updateStatus(rx.id, 'administered', {
        administered_dose: dose.trim(),
        administered_route: route,
        administered_time_actual: new Date(adminTime).toISOString(),
        administration_notes: notes.trim() || undefined,
      });
      toast.success('Administration recorded');
      onSuccess();
    } catch {
      toast.error('Failed to record administration');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md mx-4 rounded-lg overflow-hidden bg-white shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <Syringe className="w-5 h-5 text-green-700" />
            <h2 className="font-semibold text-gray-900">Record Administration</h2>
          </div>
          <button onClick={onClose} aria-label="Close"><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {}
          <div className="p-3 rounded-lg text-sm" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-green-900">{rx.patient_name ?? 'Patient'}</span>
              <span className="font-mono text-xs text-green-800">{rx.rx_number ?? `RX-${rx.id.slice(0,8).toUpperCase()}`}</span>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Medications to Administer ({rx.medications.length})</p>
            <div className="space-y-2">
              {rx.medications.map((m, i) => (
                <div key={i} className="p-3 rounded-lg border border-gray-200 bg-white">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-gray-900 text-sm">{i + 1}. {m.name}</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-purple-200">{m.dose}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-xs text-gray-600">
                    <span>Route: <strong className="capitalize">{m.route}</strong></span>
                    <span>· Frequency: <strong>{m.frequency}</strong></span>
                    <span>· Duration: <strong>{m.duration_days} days</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Confirm Administration</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Actual Dose Administered <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={dose}
              onChange={e => setDose(e.target.value)}
              placeholder="e.g. 500mg"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Route of Administration</label>
            <select
              value={route}
              onChange={e => setRoute(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="oral">Oral (PO)</option>
              <option value="IV">Intravenous (IV)</option>
              <option value="IM">Intramuscular (IM)</option>
              <option value="SC">Subcutaneous (SC)</option>
              <option value="sublingual">Sublingual (SL)</option>
              <option value="topical">Topical</option>
              <option value="inhalation">Inhalation</option>
              <option value="rectal">Rectal (PR)</option>
              <option value="NGT">Nasogastric Tube (NGT)</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Time of Administration <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={adminTime}
              onChange={e => setAdminTime(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Observations / Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Patient tolerated well, any adverse reactions, observations..."
              className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
          <button onClick={onClose} aria-label="Close" className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg bg-white hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!dose.trim() || isSubmitting}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg bg-green-700 hover:bg-green-800 disabled:opacity-40"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Record Administration
          </button>
        </div>
      </div>
    </div>
  );
}

function ResubmitModal({
  rxId,
  onSuccess,
  onClose,
}: {
  rxId: string;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await prescriptionsApi.resubmit(rxId, notes.trim() || undefined);
      toast.success('Prescription resubmitted for audit review');
      onSuccess();
    } catch {
      toast.error('Failed to resubmit prescription');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md mx-4 rounded-lg overflow-hidden bg-white shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-green-700" />
            <h2 className="font-semibold text-gray-900">Resubmit for Audit</h2>
          </div>
          <button onClick={onClose} aria-label="Close"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-600">
            Resubmit the amended prescription for auditor review. Add a note explaining the changes made.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Amendment Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Describe the changes made to the prescription..."
              className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
          <button onClick={onClose} aria-label="Close" className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg bg-white hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg bg-green-700 hover:bg-green-800 disabled:opacity-40"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Resubmit Prescription
          </button>
        </div>
      </div>
    </div>
  );
}

function TATRow({
  label,
  from,
  to,
  warnMin = 30,
}: {
  label: string;
  from?: string;
  to?: string;
  warnMin?: number;
}) {
  if (!from || !to) return null;
  const min = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000);
  const isWarn = min > warnMin;
  return (
    <div className="flex items-center justify-between py-2.5 border-b last:border-0" style={{ borderColor: '#F1F5F9' }}>
      <span className="text-sm text-gray-500">{label}</span>
      <span className={cn('text-sm font-bold tabular-nums', isWarn ? 'text-red-600' : 'text-green-700')}>
        {fmtDuration(min)}
      </span>
    </div>
  );
}

export default function PrescriptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [rx, setRx] = useState<Prescription | null>(null);
  const [flags, setFlags] = useState<AuditRecord[]>([]);
  const [followUp, setFollowUp] = useState<FollowUp | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'timeline' | 'medications' | 'tat'>('timeline');
  const [modal, setModal] = useState<'return' | 'dispense' | 'administer' | 'resubmit' | null>(null);

  const load = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const [rxRes, flagsRes] = await Promise.allSettled([
        prescriptionsApi.getById(id),
        auditsApi.list({ prescription_id: id, limit: 50 }),
      ]);
      if (rxRes.status === 'fulfilled') {
        const rxData = rxRes.value.data;
        setRx(rxData);
        if (rxData.visit_id) {
          try {
            const vRes = await visitsApi.getById(rxData.visit_id);
            const v = vRes.data;
            if (v.follow_up_date || v.follow_up_instructions) {
              setFollowUp({
                follow_up_date: v.follow_up_date,
                follow_up_instructions: v.follow_up_instructions,
              });
            } else {
              setFollowUp(undefined);
            }
          } catch { setFollowUp(undefined); }
        }
      }
      if (flagsRes.status === 'fulfilled') {
        const d = flagsRes.value.data as ListResult<AuditRecord>;
        setFlags(Array.isArray(d) ? d : d.items ?? []);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F1F5F9' }}>
        <Loader2 className="w-8 h-8 animate-spin text-green-700" />
      </div>
    );
  }

  if (!rx) {
    return (
      <div className="p-8 text-center text-gray-500">Prescription not found.</div>
    );
  }

  const timeline = buildTimeline(rx, flags);
  const role = user?.role ?? '';

  const totalTat = rx.administered_at && rx.created_at
    ? Math.round((new Date(rx.administered_at).getTime() - new Date(rx.created_at).getTime()) / 60000)
    : rx.dispensed_at && rx.created_at
    ? Math.round((new Date(rx.dispensed_at).getTime() - new Date(rx.created_at).getTime()) / 60000)
    : null;

  const tatFromOrderToVerify = rx.auditor_approved_at && rx.created_at
    ? Math.round((new Date(rx.auditor_approved_at).getTime() - new Date(rx.created_at).getTime()) / 60000)
    : rx.verified_at && rx.created_at
    ? Math.round((new Date(rx.verified_at).getTime() - new Date(rx.created_at).getTime()) / 60000)
    : null;

  const slaThreshold = rx.sla_threshold_min ?? 60;
  const isBreached = totalTat !== null && totalTat > slaThreshold;

  const TABS = [
    { id: 'timeline' as const, label: 'Accountability Trail' },
    { id: 'medications' as const, label: 'Medications' },
    { id: 'tat' as const, label: 'TAT Breakdown' },
  ];

  return (
    <div className="min-h-screen" style={{ background: '#F1F5F9' }}>
      <div style={{ background: '#FFFFFF', borderBottom: '1px solid var(--border-default)' }}>
        <div className="px-6 py-4">
          <Link to="/prescriptions" className="inline-flex items-center gap-1.5 text-xs mb-3 transition-colors" style={{ color: 'var(--text-muted)' }}>
            <ChevronLeft className="w-3.5 h-3.5" />
            All Prescriptions
          </Link>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h1 className="text-lg font-semibold font-mono tracking-tight" style={{ color: 'var(--text-primary)' }}>
                  {rx.rx_number ?? `RX-${rx.id.slice(0, 8).toUpperCase()}`}
                </h1>
                <StatusPill status={rx.status} />
                {rx.priority && (
                  <span className="text-meta font-semibold px-2 py-0.5" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-badge)' }}>
                    {rx.priority.toUpperCase()}
                  </span>
                )}
                {isBreached && (
                  <span className="text-meta font-semibold px-2 py-0.5 flex items-center gap-1" style={{ background: 'var(--status-critical-bg)', color: 'var(--status-critical-text)', border: '1px solid var(--status-critical-border)', borderRadius: 'var(--radius-badge)' }}>
                    <AlertTriangle className="w-3 h-3" />
                    SLA BREACHED
                  </span>
                )}
              </div>
              <p className="text-body-sm" style={{ color: 'var(--text-secondary)' }}>
                {displayName(rx.patient_name, 'Unknown Patient')}
                {rx.department ? ` · ${rx.department}` : ''}
                {rx.ward_location ? ` · ${rx.ward_location}` : ''}
              </p>
            </div>
            {totalTat !== null && (
              <div className="text-right">
                <p className="text-2xl font-bold tabular-nums" style={{ color: isBreached ? 'var(--status-critical-text)' : 'var(--text-primary)' }}>
                  {fmtDuration(totalTat)}
                </p>
                <p className="text-meta mt-0.5" style={{ color: 'var(--text-muted)' }}>Total TAT</p>
              </div>
            )}
          </div>
        </div>

      </div>

      <div className="grid grid-cols-12 gap-5 p-5">
        <div className="col-span-8 space-y-4">
          {(role === 'auditor' || role === 'admin') && (rx.status === 'submitted' || rx.status === 'flagged') && (
            <div
              className="rounded-lg overflow-hidden"
              style={{
                background: rx.status === 'flagged' ? '#FFF7ED' : '#F8FAFC',
                border: `1px solid ${rx.status === 'flagged' ? '#FED7AA' : '#E2E8F0'}`,
              }}
            >
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5" style={{ color: rx.status === 'flagged' ? '#EA580C' : '#475569' }} />
                  <div>
                    <p className="font-semibold text-sm" style={{ color: rx.status === 'flagged' ? '#7C2D12' : '#0F172A' }}>
                      {rx.status === 'flagged' ? 'Flagged  -  Review & Approve' : 'Awaiting Review'}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: rx.status === 'flagged' ? '#C2410C' : '#64748B' }}>
                      {rx.status === 'flagged'
                        ? 'This prescription has flags. Review them below, then approve or return to the doctor.'
                        : 'Review this prescription and either approve for pharmacy or return to the doctor.'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => setModal('return')}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300 transition-colors"
                  >
                    <ArrowLeftCircle className="w-4 h-4" />
                    Return to Doctor
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await prescriptionsApi.approveForPharmacy(rx.id);
                        toast.success('Prescription approved for pharmacy');
                        load();
                      } catch (e) {
                        const detail =
                          typeof e === 'object' &&
                          e !== null &&
                          'response' in e
                            ? (e as { response?: { data?: { detail?: string | { message?: string } } } }).response?.data?.detail
                            : undefined;
                        const msg = typeof detail === 'string' ? detail : detail?.message ?? 'Failed to approve';
                        toast.error(msg);
                      }
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg text-white transition-colors"
                    style={{ background: rx.status === 'flagged' ? '#EA580C' : '#178A3D' }}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Approve for Pharmacy
                  </button>
                </div>
              </div>
            </div>
          )}

          {role === 'doctor' && rx.status === 'pending_amendment' && (
            <div className="rounded-lg overflow-hidden border border-amber-200" style={{ background: '#FFFBEB' }}>
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <ArrowLeftCircle className="w-5 h-5 text-amber-600" />
                  <div>
                    <p className="font-semibold text-amber-900 text-sm">Amendment Required</p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      {rx.return_reason ? `Auditor notes: ${rx.return_reason}` : 'The auditor has returned this prescription for amendment.'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setModal('resubmit')}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors flex-shrink-0"
                >
                  <RefreshCw className="w-4 h-4" />
                  Resubmit
                </button>
              </div>
            </div>
          )}

          {(role === 'pharmacist' || role === 'admin') && rx.status === 'verified' && (
            <div className="rounded-lg overflow-hidden border border-green-200" style={{ background: '#F0FDF4' }}>
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <FlaskConical className="w-5 h-5 text-green-700" />
                  <div>
                    <p className="font-semibold text-green-900 text-sm">Ready to Dispense</p>
                    <p className="text-xs text-green-700 mt-0.5">
                      {rx.auditor_name ? `Approved by auditor ${rx.auditor_name}` : 'Auditor-approved'} · Print receipt and dispense medications to patient or ward.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setModal('dispense')}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-green-700 text-white hover:bg-green-800 transition-colors flex-shrink-0"
                >
                  <FlaskConical className="w-4 h-4" />
                  Dispense
                </button>
              </div>
            </div>
          )}

          {(role === 'nurse' || role === 'admin') && rx.status === 'dispensed' && (
            <div className="rounded-lg overflow-hidden border border-green-200" style={{ background: '#F0FDF4' }}>
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <Syringe className="w-5 h-5 text-green-700" />
                  <div>
                    <p className="font-semibold text-green-900 text-sm">Medication Ready for Administration</p>
                    <p className="text-xs text-green-700 mt-0.5">
                      Dispensed by pharmacist
                      {rx.dispensed_by_name ? ` ${rx.dispensed_by_name}` : ''}
                      {rx.dispensed_at ? ` at ${fmtTime(rx.dispensed_at)}` : ''}.
                      Record dose, route and time of administration.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setModal('administer')}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-green-700 text-white hover:bg-green-800 transition-colors flex-shrink-0"
                >
                  <Syringe className="w-4 h-4" />
                  Record Administration
                </button>
              </div>
            </div>
          )}

          <div className="rounded-lg overflow-hidden bg-white border border-gray-200">
            <div className="flex border-b border-gray-100">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex-1 py-3 text-sm font-semibold border-b-2 transition-colors',
                    activeTab === tab.id
                      ? 'border-green-700 text-green-700'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-6">
              {activeTab === 'timeline' && (
                <div>
                  {timeline.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">No activity recorded yet.</p>
                  ) : (
                    <div>
                      {timeline.map((entry, i) => (
                        <TimelineStep key={entry.id} entry={entry} isLast={i === timeline.length - 1} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'medications' && (
                <div className="space-y-4">
                  {rx.medications.map((med, i) => (
                    <div key={i} className="p-4 rounded-lg border border-gray-100" style={{ background: '#F8FAFC' }}>
                      <div className="flex items-start justify-between">
                        <h4 className="font-bold text-gray-900">{med.name}</h4>
                        {rx.administered_dose && i === 0 && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
                            Administered: {rx.administered_dose}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-4 mt-3 text-sm">
                        {[
                          { label: 'Prescribed Dose', value: med.dose },
                          { label: 'Route', value: med.route },
                          { label: 'Frequency', value: med.frequency },
                          { label: 'Duration', value: `${med.duration_days} days` },
                        ].map(({ label, value }) => (
                          <div key={label}>
                            <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                            <p className="font-semibold text-gray-800">{value}</p>
                          </div>
                        ))}
                      </div>
                      {rx.administered_at && i === 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200 grid grid-cols-3 gap-4 text-sm">
                          {[
                            { label: 'Actual Dose', value: rx.administered_dose ?? ' - ' },
                            { label: 'Actual Route', value: rx.administered_route ?? ' - ' },
                            { label: 'Administered At', value: fmtTime(rx.administered_at) },
                          ].map(({ label, value }) => (
                            <div key={label}>
                              <p className="text-xs text-green-700 mb-0.5">{label}</p>
                              <p className="font-semibold text-gray-800">{value}</p>
                            </div>
                          ))}
                          {rx.administration_notes && (
                            <div className="col-span-3">
                              <p className="text-xs text-gray-400 mb-0.5">Administration Notes</p>
                              <p className="text-sm text-gray-700">{rx.administration_notes}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  {(rx.notes || rx.pharmacist_comment) && (
                    <div className="space-y-3 mt-2">
                      {rx.notes && (
                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                          <p className="text-xs font-semibold text-green-800 mb-1">Doctor Notes</p>
                          <p className="text-sm text-green-800">{rx.notes}</p>
                        </div>
                      )}
                      {rx.pharmacist_comment && (
                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                          <p className="text-xs font-semibold text-green-800 mb-1">Pharmacist Comment</p>
                          <p className="text-sm text-green-800">{rx.pharmacist_comment}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'tat' && (
                <div>
                  {isBreached && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-700">
                        <span className="font-bold">SLA Breach:</span> Total TAT of {fmtDuration(totalTat!)} exceeds {fmtDuration(slaThreshold)} threshold
                        {rx.sla_breach_duration_min ? ` by ${fmtDuration(rx.sla_breach_duration_min)}` : ''}.
                      </p>
                    </div>
                  )}

                  <div className="space-y-0">
                    <TATRow label="Order ' Submit" from={rx.ordered_at ?? rx.created_at} to={rx.submitted_at} warnMin={15} />
                    <TATRow label="Submit ' Audit Approval" from={rx.submitted_at} to={rx.auditor_approved_at ?? rx.verified_at} warnMin={20} />
                    {rx.returned_at && (
                      <TATRow label="Audit Hold (Amendment)" from={rx.submitted_at} to={rx.returned_at} warnMin={0} />
                    )}
                    <TATRow label="Approval ' Dispense" from={rx.auditor_approved_at ?? rx.verified_at} to={rx.dispensed_at} warnMin={15} />
                    <TATRow label="Dispense ' Administration" from={rx.dispensed_at} to={rx.administered_at} warnMin={30} />
                  </div>

                  {totalTat !== null && (
                    <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                      <span className="font-semibold text-gray-700">Total TAT</span>
                      <span className={cn('text-xl font-extrabold tabular-nums', isBreached ? 'text-red-600' : 'text-green-700')}>
                        {fmtDuration(totalTat)}
                      </span>
                    </div>
                  )}

                  {tatFromOrderToVerify !== null && (
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm text-gray-500">Order ' Audit Approval</span>
                      <span className={cn('text-sm font-bold tabular-nums', tatFromOrderToVerify > 30 ? 'text-red-600' : 'text-green-700')}>
                        {fmtDuration(tatFromOrderToVerify)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-span-4 space-y-4">
          <div className="rounded-lg bg-white border border-gray-200 p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-4">Prescription Details</h3>
            <div className="space-y-3">
              {[
                { label: 'Status', value: <StatusPill status={rx.status} /> },
                { label: 'Rx Number', value: <span className="font-mono text-sm font-semibold">{rx.rx_number ?? ' - '}</span> },
                { label: 'Priority', value: rx.priority ? <span className="capitalize text-sm font-semibold">{rx.priority}</span> : ' - ' },
                { label: 'Department', value: rx.department ?? ' - ' },
                { label: 'Ward', value: rx.ward_location ?? ' - ' },
                { label: 'Ordered', value: fmt(rx.ordered_at ?? rx.created_at) },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">{label}</span>
                  <span className="text-sm text-gray-700">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-white border border-gray-200 p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-4">Accountability Chain</h3>
            <div className="space-y-3">
              {[
                { role: 'Doctor', name: rx.doctor_name, time: rx.ordered_at ?? rx.created_at, color: '#178A3D', bg: '#F0FDF4' },
                { role: 'Verified By', name: rx.auditor_name, time: rx.auditor_approved_at ?? rx.verified_at, color: '#475569', bg: '#F8FAFC' },
                { role: 'Pharmacist', name: rx.dispensed_by_name, time: rx.dispensed_at, color: '#0369A1', bg: '#F0F9FF' },
                { role: 'Nurse', name: rx.administered_by_name, time: rx.administered_at, color: '#9A3412', bg: '#FFF7ED' },
              ].map(({ role: r, name, time, color, bg }) => (
                <div key={r} className="flex items-center gap-3 p-2.5 rounded-lg" style={{ background: bg }}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${color}20` }}>
                    <User className="w-3.5 h-3.5" style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wider" style={{ color }}>{r}</p>
                    <p className="text-xs font-semibold text-gray-800 truncate">{name ?? <span className="text-gray-400 italic">Pending</span>}</p>
                  </div>
                  {time && <p className="text-micro text-gray-400 flex-shrink-0">{fmtTime(time)}</p>}
                </div>
              ))}
            </div>
          </div>

          {flags.length > 0 && (
            <div className="rounded-lg bg-white border border-gray-200 p-5">
              <h3 className="text-sm font-bold text-gray-900 mb-3">Audit Flags ({flags.length})</h3>
              <div className="space-y-2">
                {flags.map(flag => (
                  <div key={flag.id} className="p-2.5 rounded-lg border" style={{ background: flag.resolved ? '#F0FDF4' : '#FEF2F2', borderColor: flag.resolved ? '#BBF7D0' : '#FECACA' }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-micro font-bold px-1.5 py-0.5 rounded-full" style={{ background: flag.resolved ? '#DCFCE7' : '#FEE2E2', color: flag.resolved ? '#166534' : '#991B1B' }}>
                        {flag.resolved ? 'RESOLVED' : flag.severity.toUpperCase()}
                      </span>
                      <span className="text-micro text-gray-400">{fmtTime(flag.created_at)}</span>
                    </div>
                    <p className="text-xs text-gray-700 line-clamp-2">{flag.issue}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => printPrescription(rx, followUp)}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors bg-white"
          >
            <Printer className="w-4 h-4" />
            Print Prescription
          </button>
        </div>
      </div>

      {modal === 'return' && (
        <ReturnToDoctorModal rxId={rx.id} onSuccess={() => { setModal(null); load(); }} onClose={() => setModal(null)} />
      )}
      {modal === 'dispense' && (
        <DispenseModal rx={rx} followUp={followUp} onSuccess={() => { setModal(null); load(); }} onClose={() => setModal(null)} />
      )}
      {modal === 'administer' && (
        <AdministerModal rx={rx} onSuccess={() => { setModal(null); load(); }} onClose={() => setModal(null)} />
      )}
      {modal === 'resubmit' && (
        <ResubmitModal rxId={rx.id} onSuccess={() => { setModal(null); load(); }} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
