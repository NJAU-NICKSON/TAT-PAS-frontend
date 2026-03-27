import { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center text-center py-16 px-8 space-y-4 max-w-md mx-auto',
      className
    )}>
      <div className="w-20 h-20 text-text-muted opacity-40">
        {icon}
      </div>
      <div className="space-y-1">
        <h3 className="text-h2 font-bold text-text-primary">{title}</h3>
        <p className="text-body text-text-secondary max-w-sm">{description}</p>
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="px-6 py-2.5 bg-clinical-600 hover:bg-clinical-700 text-white rounded-lg text-body font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

