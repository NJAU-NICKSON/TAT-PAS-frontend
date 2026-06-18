import { CheckCircle, AlertTriangle, XCircle, Clock } from 'lucide-react';

export type SLAState = 'safe' | 'warning' | 'breached';

interface SLAStatusBadgeProps {
  elapsedMin: number;
  thresholdMin: number;
  size?: 'sm' | 'md';
}

export function getSLAState(elapsedMin: number, thresholdMin: number): SLAState {
  if (elapsedMin >= thresholdMin) return 'breached';
  if (elapsedMin >= thresholdMin * 0.75) return 'warning';
  return 'safe';
}

export function formatTimeRemaining(elapsedMin: number, thresholdMin: number): string {
  const diff = thresholdMin - elapsedMin;
  if (diff <= 0) {
    const over = -diff;
    if (over < 1) return '+<1m';
    if (over < 60) return `+${Math.floor(over)}m`;
    const h = Math.floor(over / 60);
    const m = Math.floor(over % 60);
    return m > 0 ? `+${h}h ${m}m` : `+${h}h`;
  }
  if (diff < 1) return '<1m left';
  if (diff < 60) return `${Math.floor(diff)}m left`;
  const h = Math.floor(diff / 60);
  const m = Math.floor(diff % 60);
  return m > 0 ? `${h}h ${m}m left` : `${h}h left`;
}

const STATE_CONFIG = {
  safe: {
    icon: CheckCircle,
    label: 'SAFE',
    color: 'var(--sla-safe)',
    bg: 'var(--status-success-bg)',
    border: 'var(--status-success-border)',
  },
  warning: {
    icon: AlertTriangle,
    label: 'WARNING',
    color: 'var(--sla-warning)',
    bg: 'var(--status-warning-bg)',
    border: 'var(--status-warning-border)',
  },
  breached: {
    icon: XCircle,
    label: 'BREACHED',
    color: 'var(--sla-breached)',
    bg: 'var(--bg-alert)',
    border: 'var(--border-breach)',
  },
};

export function SLAStatusBadge({ elapsedMin, thresholdMin, size = 'md' }: SLAStatusBadgeProps) {
  const state = getSLAState(elapsedMin, thresholdMin);
  const cfg = STATE_CONFIG[state];
  const Icon = cfg.icon;
  const timeStr = formatTimeRemaining(elapsedMin, thresholdMin);
  const isSmall = size === 'sm';

  return (
    <span
      className="inline-flex items-center gap-1 font-semibold border"
      style={{
        background: cfg.bg,
        borderColor: cfg.border,
        color: cfg.color,
        borderRadius: 'var(--radius-badge)',
        padding: isSmall ? '2px 6px' : '3px 8px',
        fontSize: isSmall ? '0.6875rem' : '0.75rem',
        letterSpacing: '0.04em',
      }}
    >
      <Icon style={{ width: isSmall ? 10 : 12, height: isSmall ? 10 : 12, flexShrink: 0 }} />
      <span>{cfg.label}</span>
      <span className="opacity-75 font-normal ml-0.5">{timeStr}</span>
    </span>
  );
}

export function formatElapsed(min: number): string {
  if (min < 1) return '<1m';
  if (min < 60) return `${Math.floor(min)}m`;
  const h = Math.floor(min / 60);
  const m = Math.floor(min % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function SLABar({ elapsedMin, thresholdMin }: { elapsedMin: number; thresholdMin: number }) {
  const state = getSLAState(elapsedMin, thresholdMin);
  const pct = Math.min((elapsedMin / thresholdMin) * 100, 100);
  const color =
    state === 'breached' ? 'var(--sla-breached)' :
    state === 'warning'  ? 'var(--sla-warning)'  :
    'var(--sla-safe)';
  return (
    <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
      <div
        className="h-1 rounded-full"
        style={{ width: `${pct}%`, background: color, transition: 'width 1s linear, background 0.5s' }}
      />
    </div>
  );
}

export function SLADot({ state }: { state: SLAState }) {
  const color =
    state === 'breached' ? 'var(--sla-breached)' :
    state === 'warning'  ? 'var(--sla-warning)'  :
    'var(--sla-safe)';
  return (
    <span
      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
      style={{ background: color }}
    />
  );
}

export { Clock };
