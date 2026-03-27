import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '../../lib/utils';

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: {
    value: number;
    isPositiveMetric: boolean;
  };
  variant?: 'default' | 'critical' | 'warning' | 'success';
  icon: LucideIcon;
  onClick?: () => void;
  className?: string;
}

export function MetricCard({
  label,
  value,
  unit,
  trend,
  variant = 'default',
  icon: Icon,
  onClick,
  className,
}: MetricCardProps) {
  const isInteractive = !!onClick;
  const trendPositive = trend && trend.value > 0;
  const goodTrend = trendPositive === trend?.isPositiveMetric;

  const variantStyles = {
    default: 'border-surface-3 hover:border-surface-2',
    critical: 'border-status-critical/50 bg-status-critical-bg hover:border-status-critical',
    warning: 'border-status-warning/50 bg-status-warning-bg hover:border-status-warning',
    success: 'border-status-success/50 bg-status-success-bg hover:border-status-success',
  }[variant];

  return (
    <div 
      className={cn(
        'group relative p-6 rounded-xl border shadow-card transition-all duration-200 hover:shadow-elevated cursor-pointer',
        variantStyles,
        isInteractive && 'hover:transform hover:-translate-y-0.5',
        className
      )}
      onClick={onClick}
      tabIndex={isInteractive ? 0 : undefined}
      role={isInteractive ? 'button' : undefined}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 rounded-lg bg-surface-2 group-hover:bg-surface-1 transition-colors">
          <Icon className="h-6 w-6 text-clinical-600" />
        </div>
        {trend && (
          <div className={cn(
            'flex items-center gap-1 px-2 py-1 rounded-full text-caption font-semibold',
            goodTrend ? 'bg-status-success text-status-success-text' : 'bg-status-critical text-status-critical-text'
          )}>
            {trendPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(trend.value)}%
          </div>
        )}
      </div>

      <div className="space-y-1">
        <div className="flex items-baseline gap-1">
          <span className="text-display font-black text-text-primary leading-none">
            {value}
          </span>
          {unit && (
            <span className="text-h3 font-semibold text-text-secondary">
              {unit}
            </span>
          )}
        </div>
        <p className="text-caption uppercase tracking-wide text-text-muted">
          {label}
        </p>
      </div>
    </div>
  );
}

