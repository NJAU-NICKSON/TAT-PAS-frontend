import { Eye, ClipboardList } from 'lucide-react';
import { cn } from '../../lib/utils';
import { StatusBadge } from './StatusBadge';
import { TATTimer } from './TATTimer';
import { Priority } from '../../models/types';

interface Prescription {
  id: string;
  patient_name: string;
  mrn: string;
  ward_location?: string;
  medications: Array<{
    name: string;
    dose: string;
    route: string;
    frequency: string;
  }>;
  status: string;
  priority: Priority;
  flags: string[];
  doctor_name: string;
  department: string;
  ordered_at: string;
  slaThresholdMin: number;
}

interface PrescriptionCardProps {
  prescription: Prescription;
  variant?: 'kanban' | 'list' | 'compact';
  onAction: (action: string, rxId: string) => void;
  currentUserRole: string;
  className?: string;
  isSelected?: boolean;
  slaBreached?: boolean;
}

const PRIORITY_BORDER_COLORS: Record<Priority, string> = {
  stat: 'border-status-critical',
  urgent: 'border-status-warning',
  routine: 'border-status-info',
  discharge: 'border-status-neutral',
  nicu: 'border-status-flagged',
};

export function PrescriptionCard({
  prescription,
  variant = 'kanban',
  onAction,
  currentUserRole,
  className,
  isSelected = false,
  slaBreached = false,
}: PrescriptionCardProps) {
  const firstMed = prescription.medications[0];
  const hasMultipleMeds = prescription.medications.length > 1;
  const getNextAction = () => {
    if (currentUserRole === 'pharmacist' && prescription.status === 'submitted') return 'verify';
    if (currentUserRole === 'pharmacist' && prescription.status === 'verified') return 'dispense';
    if (currentUserRole === 'nurse' && prescription.status === 'dispensed') return 'administer';
    if (currentUserRole === 'auditor' && prescription.flags.length > 0) return 'review-flag';
    return 'view';
  };

  const nextAction = getNextAction();

  const baseClasses = cn(
    'group relative bg-surface-0 border rounded-xl shadow-card hover:shadow-elevated transition-all duration-200 overflow-hidden',
    PRIORITY_BORDER_COLORS[prescription.priority],
    isSelected && 'ring-2 ring-clinical-600 ring-offset-2 ring-offset-surface-0',
    slaBreached && 'bg-status-critical-bg border-status-critical-border',
    className,
  );

  const headerClasses = cn(
    'p-4 border-b border-surface-3 flex items-start justify-between gap-3',
    variant === 'compact' && 'p-3',
  );

  const contentClasses = cn(
    'p-4 space-y-3',
    variant === 'compact' && 'p-3 space-y-2',
  );

  const actionClasses = cn(
    'flex gap-2 mt-4 pt-4 border-t border-surface-3',
    variant === 'compact' && 'mt-3 pt-3 gap-1',
  );

  const getActionLabel = (action: string) => {
    const labels = {
      verify: 'Verify',
      dispense: 'Dispense',
      administer: 'Administer',
      'review-flag': 'Review Flag',
      view: 'View Rx',
    };
    return labels[action as keyof typeof labels] || 'View';
  };

  return (
    <div className={baseClasses}>
      <div className={headerClasses}>
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <StatusBadge status={prescription.status} size={variant === 'compact' ? 'sm' : 'md'} />
            {prescription.flags.length > 0 && (
              <div className="flex gap-1">
                {prescription.flags.slice(0, 2).map((flag, idx) => (
                  <StatusBadge key={flag} status="flagged" severity="high" size="sm" />
                ))}
                {prescription.flags.length > 2 && (
                  <span className="text-caption text-text-muted">+{prescription.flags.length - 2}</span>
                )}
              </div>
            )}
          </div>
          
          <h3 className="font-semibold text-text-primary line-clamp-1">{prescription.patient_name}</h3>
          <p className="text-caption text-text-muted font-mono">{prescription.mrn}</p>
          {prescription.ward_location && (
            <p className="text-caption text-text-muted">{prescription.ward_location}</p>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0 ml-4">
          <TATTimer startTime={prescription.ordered_at} slaThresholdMin={prescription.slaThresholdMin} size={variant === 'compact' ? 'sm' : 'md'} />
        </div>
      </div>

      <div className={contentClasses}>
        <div className="text-body font-medium text-text-primary line-clamp-1">{firstMed?.name}</div>
        <p className="text-caption text-text-secondary">{firstMed?.dose} {firstMed?.route} {firstMed?.frequency}</p>
        {hasMultipleMeds && (
          <p className="text-caption text-text-muted">+{prescription.medications.length - 1} more</p>
        )}
        
        <div className="flex items-center gap-2 text-body-sm text-text-muted">
          <span>{prescription.doctor_name}</span>
          <span></span>
          <span>{prescription.department}</span>
        </div>
      </div>

      <div className={actionClasses}>
        <button
          onClick={() => onAction(nextAction, prescription.id)}
          className="flex-1 px-3 py-2 rounded-lg font-medium text-body-sm border transition-all flex items-center gap-2 justify-center
            bg-clinical-50 border-clinical-200 text-clinical-700 hover:bg-clinical-100 hover:border-clinical-300 active:bg-clinical-200
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0"
          aria-label={`Primary action: ${getActionLabel(nextAction)}`}
        >
          {getActionLabel(nextAction)}
        </button>
        
        <div className="flex gap-1">
          <button
            onClick={() => onAction('view', prescription.id)}
            className="p-2 text-text-muted hover:text-text-primary hover:bg-surface-2 rounded-lg transition-colors flex-shrink-0"
            aria-label="View full prescription"
            title="View full prescription"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            onClick={() => onAction('audit', prescription.id)}
            className="p-2 text-text-muted hover:text-text-primary hover:bg-surface-2 rounded-lg transition-colors flex-shrink-0"
            aria-label="View audit trail"
            title="View audit trail"
          >
            <ClipboardList className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
