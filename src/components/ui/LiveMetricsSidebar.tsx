import { useEffect, useRef, useState } from 'react';
import { Activity } from 'lucide-react';
import { useWebSocket } from '../../context/WebSocketContext';

interface Metric {
  label: string;
  value: number | string;
  danger?: boolean;
  unit?: string;
}

interface LiveMetricsSidebarProps {
  metrics: Metric[];
  title?: string;
  footer?: { label: string; value: string };
}

export function formatMin(min: number | null | undefined): string {
  if (min == null || isNaN(min as number)) return ' - ';
  const m = min as number;
  if (m < 1) return '<1m';
  if (m < 60) return `${m.toFixed(0)}m`;
  return `${(m / 60).toFixed(1)}h`;
}

function PulseNumber({ value, danger = false }: { value: number | string; danger?: boolean }) {
  const [key, setKey] = useState(0);
  const prevRef = useRef(value);

  useEffect(() => {
    if (prevRef.current !== value) {
      prevRef.current = value;
      setKey(k => k + 1);
    }
  }, [value]);

  const isDanger = danger && Number(value) > 0;

  return (
    <span
      key={key}
      className="tabular-nums font-bold leading-none animate-value-pulse"
      style={{
        fontSize: '1.125rem',
        letterSpacing: '-0.01em',
        color: isDanger ? 'var(--sla-breached)' : 'var(--text-primary)',
      }}
    >
      {value}
    </span>
  );
}

export function LiveMetricsSidebar({ metrics, title = 'Live Status', footer }: LiveMetricsSidebarProps) {
  const { subscribe } = useWebSocket();
  const [lastPing, setLastPing] = useState<string | null>(null);
  const [pingKey, setPingKey] = useState(0);

  useEffect(() => {
    const unsub = subscribe('*', () => {
      const now = new Date();
      setLastPing(now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setPingKey(k => k + 1);
    });
    return unsub;
  }, [subscribe]);

  return (
    <aside
      className="w-56 flex-shrink-0 flex flex-col border-l overflow-y-auto"
      style={{ borderColor: 'var(--border-default)', background: 'var(--surface-0)' }}
    >
      <div
        className="px-4 py-3.5 border-b flex items-center gap-2"
        style={{ borderColor: 'var(--border-default)' }}
      >
        <div
          key={pingKey}
          className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--status-success-bg)' }}
        >
          <Activity className="w-3 h-3" style={{ color: 'var(--sla-safe)' }} />
        </div>
        <div>
          <p className="text-label" style={{ color: 'var(--text-primary)' }}>{title}</p>
          {lastPing && (
            <p className="text-meta mt-0.5" style={{ color: 'var(--text-disabled)' }}>
              {lastPing}
            </p>
          )}
        </div>
      </div>

      <div className="flex-1">
        {metrics.map(metric => {
          const isDanger = metric.danger && Number(metric.value) > 0;
          return (
            <div
              key={metric.label}
              className="flex items-center justify-between px-4 py-2.5 border-b"
              style={{
                borderColor: 'var(--border-default)',
                background: isDanger ? 'var(--status-critical-bg)' : 'transparent',
              }}
            >
              <span className="text-caption" style={{ color: isDanger ? 'var(--status-critical-text)' : 'var(--text-muted)' }}>
                {metric.label}
              </span>
              <PulseNumber
                value={metric.unit ? `${metric.value}${metric.unit}` : metric.value}
                danger={metric.danger}
              />
            </div>
          );
        })}
      </div>

      {footer && (
        <div
          className="flex items-center justify-between px-4 py-3 border-t"
          style={{ borderColor: 'var(--border-default)', background: 'var(--surface-1)' }}
        >
          <span className="text-caption" style={{ color: 'var(--text-muted)' }}>{footer.label}</span>
          <span
            className="tabular-nums font-bold leading-none"
            style={{ fontSize: '1.125rem', letterSpacing: '-0.01em', color: 'var(--text-primary)' }}
          >
            {footer.value}
          </span>
        </div>
      )}
    </aside>
  );
}
