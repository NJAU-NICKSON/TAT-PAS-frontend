import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Prescription } from '../../models/types';
import { SLABar, SLAStatusBadge, getSLAState, formatElapsed } from './SLAStatusBadge';

export interface QueueCardAction {
  label: string;
  onClick: (id: string) => void;
  loading?: boolean;
  variant?: 'primary' | 'success' | 'danger';
}

interface PrescriptionQueueCardProps {
  prescription: Prescription;
  now: Date;
  action?: QueueCardAction;
  statusTag?: React.ReactNode;
  /** Tab-stop index for keyboard navigation */
  tabIndex?: number;
  onFocus?: () => void;
}

const PRIORITY_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  stat:      { label: 'STAT',      bg: 'var(--priority-stat)',    text: '#fff' },
  nicu:      { label: 'NICU',      bg: '#DB2777',                 text: '#fff' },
  urgent:    { label: 'URGENT',    bg: 'var(--priority-urgent)',  text: '#fff' },
  discharge: { label: 'DISCHARGE', bg: 'var(--priority-discharge)', text: '#fff' },
  chemo:     { label: 'CHEMO',     bg: '#065F46',                 text: '#fff' },
  routine:   { label: 'ROUTINE',   bg: 'var(--surface-3)',        text: 'var(--text-secondary)' },
};

const ACTION_STYLES: Record<string, { bg: string; hover: string }> = {
  primary: { bg: 'var(--clinical-600)',  hover: 'var(--clinical-700)' },
  success: { bg: 'var(--sla-safe)',      hover: '#047857' },
  danger:  { bg: 'var(--sla-breached)', hover: '#b91c1c' },
};

export function PrescriptionQueueCard({
  prescription,
  now,
  action,
  statusTag,
  tabIndex = 0,
  onFocus,
}: PrescriptionQueueCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [pulsed, setPulsed] = useState(false);
  const prevStatusRef = useRef(prescription.status);
  const cardRef = useRef<HTMLDivElement>(null);

  const startTime = prescription.submitted_at
    ? new Date(prescription.submitted_at)
    : new Date(prescription.created_at);
  const elapsedMin = (now.getTime() - startTime.getTime()) / 60000;
  const thresholdMin = prescription.sla_threshold_min ?? 60;
  const slaState = getSLAState(elapsedMin, thresholdMin);

  const isStat = prescription.priority === 'stat' || prescription.priority === 'nicu';
  const priority = prescription.priority ?? 'routine';
  const priCfg = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.routine;

  const timeColor =
    slaState === 'breached' ? 'var(--sla-breached)' :
    slaState === 'warning'  ? 'var(--sla-warning)'  :
    'var(--sla-safe)';

  // Pulse on status change
  useEffect(() => {
    if (prevStatusRef.current !== prescription.status) {
      prevStatusRef.current = prescription.status;
      setPulsed(true);
      const t = setTimeout(() => setPulsed(false), 700);
      return () => clearTimeout(t);
    }
  }, [prescription.status]);

  const handleKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setExpanded(v => !v);
    }
  };

  const actStyle = action?.variant ? ACTION_STYLES[action.variant] : ACTION_STYLES.primary;

  return (
    <div
      ref={cardRef}
      className={`rounded-xl border overflow-hidden outline-none focus-within:ring-2 ${pulsed ? 'animate-value-pulse' : ''}`}
      style={{
        background: isStat ? 'var(--bg-card-stat)' : 'var(--bg-card)',
        borderColor: isStat ? 'var(--border-stat)' : 'var(--border-default)',
        borderLeft: isStat ? '3px solid var(--priority-stat)' : undefined,
        boxShadow: 'var(--shadow-card)',
        borderRadius: 'var(--radius-card)',
      }}
      // eslint-disable-next-line jsx-a11y/no-noninteractive-element-props -- role added below
      role="article"
      aria-label={`Prescription ${prescription.rx_number ?? prescription.id}, ${priority} priority`}
    >
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none hover:bg-[var(--bg-row-hover)] transition-colors"
        onClick={() => setExpanded(v => !v)}
        tabIndex={tabIndex}
        onFocus={onFocus}
        onKeyDown={handleKey}
        aria-expanded={expanded}
      >
        <div className="w-20 flex-shrink-0 text-right" aria-label={`${Math.floor(elapsedMin)} minutes elapsed`}>
          <span className="text-time-card" style={{ color: timeColor }}>
            {formatElapsed(elapsedMin)}
          </span>
        </div>

        <span
          className="text-label flex-shrink-0 px-2 py-0.5"
          style={{ background: priCfg.bg, color: priCfg.text, borderRadius: 'var(--radius-badge)' }}
        >
          {priCfg.label}
        </span>

        <div className="flex-1 min-w-0">
          <p className="text-body-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
            {prescription.medications[0]?.name ?? 'Multiple medications'}
            {prescription.medications.length > 1 && (
              <span className="font-normal ml-1" style={{ color: 'var(--text-secondary)' }}>
                +{prescription.medications.length - 1} more
              </span>
            )}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            {prescription.rx_number && (
              <span className="text-mono text-meta" style={{ color: 'var(--text-secondary)' }}>
                {prescription.rx_number}
              </span>
            )}
            {prescription.flags.length > 0 && (
              <span className="text-meta font-semibold" style={{ color: 'var(--sla-breached)' }}>
                {prescription.flags.length} flag{prescription.flags.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        <SLAStatusBadge elapsedMin={elapsedMin} thresholdMin={thresholdMin} size="sm" />

        <div className="flex-shrink-0 flex items-center gap-2">
          {statusTag}
          {action && (
            <button
              onClick={e => { e.stopPropagation(); action.onClick(prescription.id); }}
              disabled={action.loading}
              className="flex items-center gap-1.5 px-4 py-1.5 text-body-sm font-semibold text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: actStyle.bg, borderRadius: 'var(--radius-button)' }}
            >
              {action.loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {action.label}
            </button>
          )}
          <button
            onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
            className="p-1 rounded"
            style={{ color: 'var(--text-disabled)' }}
            aria-label={expanded ? 'Collapse details' : 'Expand details'}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="px-4 pb-2.5" style={{ paddingLeft: '108px' }}>
        <SLABar elapsedMin={elapsedMin} thresholdMin={thresholdMin} />
      </div>

      {expanded && (
        <div
          className="px-4 py-3 border-t border-[var(--border-default)] animate-fade-in"
          style={{ background: 'var(--bg-base)' }}
        >
          <div className="grid grid-cols-2 gap-2 mb-2">
            {prescription.medications.map((med, i) => (
              <div
                key={i}
                className="p-2.5 rounded-lg border"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
              >
                <p className="text-body-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{med.name}</p>
                <p className="text-meta mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  {med.dose} · {med.route} · {med.frequency}
                </p>
                <p className="text-meta" style={{ color: 'var(--text-disabled)' }}>{med.duration_days}d</p>
              </div>
            ))}
          </div>
          {prescription.notes && (
            <p className="text-body-sm" style={{ color: 'var(--text-secondary)' }}>
              <span className="font-semibold">Notes: </span>{prescription.notes}
            </p>
          )}
          {prescription.flags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {prescription.flags.map((f, i) => (
                <span
                  key={i}
                  className="text-meta font-semibold px-2 py-0.5"
                  style={{
                    background: 'var(--status-flagged-bg)',
                    color: 'var(--status-flagged-text)',
                    borderRadius: 'var(--radius-badge)',
                    border: '1px solid var(--status-flagged-border)',
                  }}
                >
                  {f}
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-4 mt-2 text-meta" style={{ color: 'var(--text-disabled)' }}>
            <span>Patient: <span className="font-mono">{prescription.patient_id}</span></span>
            {prescription.department && <span>Dept: {prescription.department}</span>}
            {prescription.ward_location && <span>Ward: {prescription.ward_location}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
