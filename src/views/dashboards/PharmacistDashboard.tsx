import { useState, useEffect, useCallback, useRef } from 'react';
import { CheckCircle2, AlertCircle, FlaskConical, ShieldAlert, Printer, X, Loader2 } from 'lucide-react';
import { useWebSocket } from '../../context/WebSocketContext';
import { prescriptionsApi } from '../../api/prescriptions';
import { visitsApi } from '../../api/visits';
import { Prescription, PrescriptionStatus } from '../../models/types';
import { BreachBanner } from '../../components/ui/BreachBanner';
import { PrescriptionQueueCard } from '../../components/ui/PrescriptionQueueCard';
import { getSLAState, formatElapsed } from '../../components/ui/SLAStatusBadge';
import { printDispensingReceipt } from '../../lib/printDocs';
import { toast } from 'sonner';

async function printReceiptWithFollowUp(rx: Prescription): Promise<void> {
  let followUp;
  if (rx.visit_id) {
    try {
      const v = (await visitsApi.getById(rx.visit_id)).data;
      if (v.follow_up_date || v.follow_up_instructions) {
        followUp = { follow_up_date: v.follow_up_date, follow_up_instructions: v.follow_up_instructions };
      }
    } catch {}
  }
  printDispensingReceipt(rx, followUp);
}

interface Section {
  key: string;
  label: string;
  statuses: PrescriptionStatus[];
  actionLabel?: string;
  actionVariant?: 'primary' | 'success';
  accentColor: string;
  accentBg: string;
}

function DispenseModal({
  rx,
  onSuccess,
  onClose,
}: {
  rx: Prescription;
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
      <div
        className="w-full max-w-lg mx-4 rounded-lg overflow-hidden"
        style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-modal)' }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border-default)' }}>
          <div className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-green-700" />
            <h2 className="text-h3">Dispense Prescription</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-[var(--bg-base)]" style={{ color: 'var(--text-muted)' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mx-6 mt-5 border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-green-700 px-4 py-2.5 flex items-center justify-between">
            <span className="text-sm font-bold text-white">Dispensing Receipt</span>
            <button onClick={() => printReceiptWithFollowUp(rx)} className="flex items-center gap-1 text-xs text-white/80 hover:text-white">
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>
          </div>
          <div className="px-4 py-4 space-y-2" style={{ background: 'var(--bg-base)' }}>
            {[
              { label: 'Rx #', value: rx.rx_number ?? rx.id.slice(0, 8).toUpperCase() },
              { label: 'Patient', value: rx.patient_name ?? rx.patient_id },
              { label: 'Doctor', value: rx.doctor_name ?? rx.doctor_id },
              ...(rx.auditor_name ? [{ label: 'Auditor Approved By', value: rx.auditor_name }] : []),
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between text-xs">
                <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{value}</span>
              </div>
            ))}
            <div className="border-t border-dashed border-gray-300 my-2" />
            {rx.medications.map((med, i) => (
              <div key={i} className="text-xs">
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{med.name}</span>
                <span className="ml-2" style={{ color: 'var(--text-muted)' }}>
                  {med.dose} · {med.route} · {med.frequency} · {med.duration_days}d
                </span>
              </div>
            ))}
            <div className="border-t border-dashed border-gray-300 my-2" />
            <div className="flex justify-between text-xs">
              <span style={{ color: 'var(--text-muted)' }}>Date/Time</span>
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                {new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-label mb-1.5" style={{ color: 'var(--text-secondary)' }}>Receipt Number (optional)</label>
            <input
              type="text"
              value={receiptNumber}
              onChange={e => setReceiptNumber(e.target.value)}
              placeholder="e.g. RCP-20250321-001"
              className="w-full px-3 py-2 text-body-sm border rounded-lg focus:outline-none"
              style={{ borderColor: 'var(--border-default)', background: 'var(--bg-base)', borderRadius: 'var(--radius-button)' }}
            />
          </div>
          <div>
            <label className="block text-label mb-1.5" style={{ color: 'var(--text-secondary)' }}>Pharmacist Notes (optional)</label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={2}
              placeholder="Substitutions, counselling notes, special instructions..."
              className="w-full px-3 py-2.5 text-body-sm border rounded-lg resize-none focus:outline-none"
              style={{ borderColor: 'var(--border-default)', background: 'var(--bg-base)', borderRadius: 'var(--radius-card)' }}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: 'var(--border-default)' }}>
          <button
            onClick={onClose}
            className="px-4 py-2 text-body-sm font-semibold border rounded-lg"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)', borderRadius: 'var(--radius-button)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleDispense}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-5 py-2 text-body-sm font-semibold text-white rounded-lg disabled:opacity-40"
            style={{ background: '#178A3D', borderRadius: 'var(--radius-button)' }}
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Confirm Dispense
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-20 rounded-lg animate-shimmer" />
      ))}
    </div>
  );
}

export function PharmacistDashboard() {
  const { subscribe } = useWebSocket();
  const [queue, setQueue]       = useState<Prescription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dispenseTarget, setDispenseTarget] = useState<Prescription | null>(null);
  const [now, setNow]           = useState(new Date());
  const focusedIdxRef           = useRef(0);

  const loadQueue = useCallback(async () => {
    try {
      const res = await prescriptionsApi.queue({ limit: 200 });
      const items = Array.isArray(res.data) ? res.data : [];
      setQueue(items.sort((a, b) => {
        const aStart = a.submitted_at ?? a.created_at;
        const bStart = b.submitted_at ?? b.created_at;
        return new Date(aStart).getTime() - new Date(bStart).getTime();
      }));
    } catch {
      toast.error('Failed to load queue. Check your connection.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { loadQueue(); }, [loadQueue]);

  useEffect(() => {
    const events = ['prescription.created', 'prescription.status_changed', 'sla.breached', 'audit.flag_created', 'audit.flag_resolved'];
    const unsubs = events.map(ev => subscribe(ev, () => loadQueue()));
    return () => unsubs.forEach(u => u());
  }, [subscribe, loadQueue]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const cards = document.querySelectorAll<HTMLElement>('[data-queue-card]');
      if (!cards.length) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        focusedIdxRef.current = Math.min(focusedIdxRef.current + 1, cards.length - 1);
        cards[focusedIdxRef.current]?.focus();
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        focusedIdxRef.current = Math.max(focusedIdxRef.current - 1, 0);
        cards[focusedIdxRef.current]?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const breachedItems = queue.filter(p => {
    const start   = p.submitted_at ?? p.created_at;
    const elapsed = (now.getTime() - new Date(start).getTime()) / 60000;
    return getSLAState(elapsed, p.sla_threshold_min ?? 60) === 'breached';
  });

  const oldestBreachElapsed = breachedItems.length > 0
    ? Math.max(...breachedItems.map(p => {
        const start = p.submitted_at ?? p.created_at;
        return (now.getTime() - new Date(start).getTime()) / 60000;
      }))
    : null;

  const toDispense = queue.filter(p => p.status === 'verified');
  const flagged    = queue.filter(p => p.status === 'flagged');

  const SECTIONS: Section[] = [
    {
      key: 'dispense',
      label: 'Ready to Dispense',
      statuses: ['verified'],
      actionLabel: 'Dispense',
      actionVariant: 'success',
      accentColor: '#178A3D',
      accentBg: 'rgba(5,150,105,0.08)',
    },
    {
      key: 'flagged',
      label: 'Flagged - Pending Review',
      statuses: ['flagged'],
      accentColor: '#178A3D',
      accentBg: 'rgba(23,138,61,0.08)',
    },
  ];

  let cardIndex = 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <BreachBanner count={breachedItems.length} oldestElapsedMin={oldestBreachElapsed} />

      <div
        className="flex items-center justify-between px-6 h-12 flex-shrink-0"
        style={{ background: '#FFFFFF', borderBottom: '1px solid var(--border-default)' }}
      >
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>Dispensing Queue</h1>
          <span className="text-meta tabular-nums" style={{ color: 'var(--text-muted)' }}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
          </span>
        </div>
        <div className="flex items-center gap-4">
          {[
            { label: 'Dispense', count: toDispense.length },
            { label: 'Flagged',  count: flagged.length },
          ].map(({ label, count }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className="text-label" style={{ color: 'var(--text-muted)' }}>{label}</span>
              <span className="text-body font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>{count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden" style={{ background: '#F1F5F9' }}>

        <div className="flex-1 overflow-y-auto px-7 py-5 space-y-8">
          {isLoading ? (
            <SectionSkeleton />
          ) : queue.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64">
              <div
                className="w-16 h-16 rounded-lg flex items-center justify-center mb-4"
                style={{ background: '#F0FDF4' }}
              >
                <CheckCircle2 className="w-8 h-8" style={{ color: '#178A3D' }} />
              </div>
              <p className="text-body font-semibold" style={{ color: 'var(--text-secondary)' }}>Queue is clear</p>
              <p className="text-body-sm mt-1" style={{ color: 'var(--text-muted)' }}>No active prescriptions in the queue</p>
            </div>
          ) : (
            SECTIONS.map(section => {
              const items = queue.filter(p => section.statuses.includes(p.status));
              if (items.length === 0) return null;
              return (
                <section key={section.key} aria-label={section.label}>
                  <div className="flex items-center gap-2.5 mb-3">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: section.accentBg }}
                    >
                      <FlaskConical className="w-3.5 h-3.5" style={{ color: section.accentColor }} />
                    </div>
                    <h2 className="text-body font-semibold" style={{ color: 'var(--text-primary)' }}>{section.label}</h2>
                    <span
                      className="text-caption font-bold px-2 py-0.5 rounded-full"
                      style={{ background: section.accentBg, color: section.accentColor }}
                    >
                      {items.length}
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    {items.map(p => {
                      const idx = cardIndex++;
                      return (
                        <div key={p.id} data-queue-card tabIndex={-1} className="outline-none">
                          <PrescriptionQueueCard
                            prescription={p}
                            now={now}
                            tabIndex={idx}
                            action={section.actionLabel ? {
                              label: section.actionLabel,
                              onClick: (id) => {
                                const target = queue.find(rx => rx.id === id);
                                if (target) setDispenseTarget(target);
                              },
                              loading: false,
                              variant: section.actionVariant ?? 'primary',
                            } : undefined}
                            statusTag={
                              p.status === 'flagged' ? (
                                <span
                                  className="text-caption font-bold px-2.5 py-1 rounded-full"
                                  style={{ background: '#FAF5FF', color: '#6B21A8', border: '1px solid #E9D5FF' }}
                                >
                                  <AlertCircle className="inline w-3 h-3 mr-1" />
                                  FLAGGED
                                </span>
                              ) : undefined
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })
          )}
        </div>

        <aside
          className="hidden xl:flex w-56 flex-shrink-0 border-l overflow-y-auto flex-col"
          style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}
        >
          <div className="px-4 py-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
            <p className="text-caption font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Live Queue</p>
          </div>

          <div className="flex-1 px-4 py-4 space-y-3">
            {[
              { label: 'To Dispense',  value: toDispense.length, icon: FlaskConical,danger: false, color: '#178A3D', bg: '#F0FDF4', border: '#BBF7D0' },
              { label: 'Flagged',      value: flagged.length,    icon: AlertCircle, danger: true,  color: '#7C3AED', bg: '#FAF5FF', border: '#E9D5FF' },
              { label: 'SLA Breached', value: breachedItems.length, icon: ShieldAlert, danger: true, color: breachedItems.length > 0 ? '#DC2626' : '#178A3D', bg: breachedItems.length > 0 ? '#FEF2F2' : '#F0FDF4', border: breachedItems.length > 0 ? '#FECACA' : '#BBF7D0' },
            ].map(({ label, value, icon: Icon, color, bg, border }) => (
              <div
                key={label}
                className="flex items-center gap-3 p-3 rounded-lg"
                style={{ background: bg, border: `1px solid ${border}` }}
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.7)' }}>
                  <Icon className="w-3.5 h-3.5" style={{ color }} />
                </div>
                <div>
                  <p className="text-caption font-semibold" style={{ color }}>{label}</p>
                  <p className="text-xl font-extrabold tabular-nums leading-none mt-0.5" style={{ color }}>{value}</p>
                </div>
              </div>
            ))}
          </div>

          {toDispense.length > 0 && (
            <div className="px-4 py-4" style={{ borderTop: '1px solid var(--border-default)' }}>
              <p className="text-caption font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Longest Wait</p>
              {(() => {
                const oldest = toDispense.reduce((acc, p) => {
                  const start   = p.verified_at ?? p.submitted_at ?? p.created_at;
                  const elapsed = (now.getTime() - new Date(start).getTime()) / 60000;
                  return elapsed > acc.elapsed ? { elapsed, p } : acc;
                }, { elapsed: 0, p: null as Prescription | null });
                if (!oldest.p) return null;
                const state = getSLAState(oldest.elapsed, oldest.p.sla_threshold_min ?? 60);
                return (
                  <p
                    className="text-2xl font-extrabold tabular-nums leading-none"
                    style={{ color: state === 'breached' ? '#DC2626' : state === 'warning' ? '#D97706' : 'var(--text-primary)' }}
                  >
                    {formatElapsed(oldest.elapsed)}
                  </p>
                );
              })()}
            </div>
          )}

          <div className="px-4 py-3" style={{ borderTop: '1px solid var(--border-default)', background: 'var(--bg-base)' }}>
            <p className="text-caption" style={{ color: 'var(--text-muted)' }}>Use arrow keys to navigate queue</p>
            <p className="text-caption mt-0.5" style={{ color: 'var(--text-muted)' }}>Enter to expand a card</p>
          </div>
        </aside>
      </div>

      {dispenseTarget && (
        <DispenseModal
          rx={dispenseTarget}
          onSuccess={() => { setDispenseTarget(null); loadQueue(); }}
          onClose={() => setDispenseTarget(null)}
        />
      )}
    </div>
  );
}
