import { cn } from '../../lib/utils';
import { STATUS_ICONS } from '../../lib/icons';

interface StatusBadgeProps {
  status: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeStyles = {
  sm: 'px-2 py-0.5 text-caption',
  md: 'px-3 py-1 text-body-sm',
  lg: 'px-4 py-1.5 text-body',
};

export function StatusBadge({
  status,
  size = 'md',
  className,
}: StatusBadgeProps) {
  const Icon = STATUS_ICONS[status as keyof typeof STATUS_ICONS] || null;
  const label = status.charAt(0).toUpperCase() + status.slice(1);

  const baseClasses = cn(
    'inline-flex items-center gap-1 rounded-full font-medium border',
    sizeStyles[size],
    className,
  );

  const statusClasses = {
    draft: 'bg-status-neutral border-status-neutral-border text-status-neutral-text',
    submitted: 'bg-status-info border-status-info-border text-status-info-text',
    flagged: 'bg-status-flagged border-status-flagged-border text-status-flagged-text',
    verified: 'bg-status-success border-status-success-border text-status-success-text',
    dispensed: 'bg-status-warning border-status-warning-border text-status-warning-text',
    administered: 'bg-status-success border-status-success-border text-status-success-text',
    archived: 'bg-status-neutral border-status-neutral-border text-status-neutral-text',
  }[status] || 'bg-status-neutral border-status-neutral-border text-status-neutral-text';

  return (
    <span className={cn(baseClasses, statusClasses)}>
      {Icon && <Icon className="h-3 w-3 flex-shrink-0" />}
      {label}
    </span>
  );
}

