import { ShieldAlert, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface BreachBannerProps {
  count: number;
  oldestElapsedMin?: number | null;
  linkTo?: string;
}

function formatElapsed(min: number): string {
  if (min < 1) return '<1m';
  if (min < 60) return `${Math.floor(min)}m`;
  const h = Math.floor(min / 60);
  const m = Math.floor(min % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function BreachBanner({ count, oldestElapsedMin, linkTo = '/prescriptions?sla_breached=true' }: BreachBannerProps) {
  if (count === 0) return null;

  return (
    <div
      className="flex-shrink-0 flex items-center justify-between px-6 py-2.5"
      style={{
        background: '#991b1b',
        borderBottom: '1px solid rgba(0,0,0,0.2)',
      }}
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white/20 flex-shrink-0 animate-breach-pulse">
          <ShieldAlert className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="flex items-baseline gap-2.5">
          <span className="text-body-sm font-bold text-white">
            {count} overdue prescription{count !== 1 ? 's' : ''}
          </span>
          {oldestElapsedMin != null && (
            <span className="text-meta" style={{ color: 'rgba(255,255,255,0.65)' }}>
              longest wait: {formatElapsed(oldestElapsedMin)}
            </span>
          )}
        </div>
      </div>

      <Link
        to={linkTo}
        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
        style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}
      >
        View overdue
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}
