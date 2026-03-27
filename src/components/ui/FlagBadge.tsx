import { CheckCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { FLAG_ICONS } from '../../lib/icons';

interface FlagBadgeProps {
  flagCode: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolved?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  className?: string;
}

const flagLabels: Record<string, string> = {
  high_dose: 'High Dose',
  extended_duration: 'Long Duration',
  allergy_match: 'Allergy',
  drug_interaction: 'Drug Interaction',
  controlled_sub: 'Controlled Drug',
  sla_breach: 'SLA Breach',
  duplicate_rx: 'Duplicate Rx',
};

const severityStyles = {
  low: 'bg-status-info border-status-info-text text-status-info-text',
  medium: 'bg-status-warning border-status-warning-text text-status-warning-text',
  high: 'bg-status-critical border-status-critical-text text-status-critical-text',
  critical: 'bg-status-critical border-status-critical-text text-status-critical-text ring-1 ring-status-critical ring-opacity-50 shadow-md',
};

export function FlagBadge({
  flagCode,
  severity,
  resolved = false,
  size = 'md',
  onClick,
  className,
}: FlagBadgeProps) {
  const Icon = FLAG_ICONS[flagCode as keyof typeof FLAG_ICONS];
  const label = flagLabels[flagCode] || flagCode;
  const isInteractive = !!onClick;

  const sizeClasses = {
    sm: 'px-2 py-1 text-caption',
    md: 'px-3 py-1.5 text-body-sm',
    lg: 'px-4 py-2 text-body',
  }[size];

  const baseClasses = cn(
    'inline-flex items-center gap-1.5 rounded-lg font-medium border font-mono transition-all duration-200 cursor-pointer hover:shadow-sm',
    sizeClasses,
    severityStyles[severity],
    resolved && 'opacity-60 line-through decoration-status-neutral-text decoration-1',
    isInteractive && 'hover:scale-[1.02] active:scale-95',
    className,
  );

  return (
    <div 
      className={baseClasses}
      onClick={onClick}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      aria-label={resolved ? `${label} (resolved)` : label}
    >
      {Icon && <Icon className="h-3 w-3 flex-shrink-0" />}
      <span className="leading-none">{label}</span>
      {resolved && <CheckCircle className="h-3 w-3 ml-1 opacity-75" />}
    </div>
  );
}
