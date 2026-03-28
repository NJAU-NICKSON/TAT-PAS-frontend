import { LucideIcon, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { StatusBadge } from './StatusBadge';

interface AuditEvent {
  id: string;
  flagCode: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  issue: string;
  recommendation: string;
  resolved: boolean;
  resolvedBy?: string;
  resolutionNote?: string;
  createdAt: string;
  createdBy: string;
}

interface AuditTimelineProps {
  events: AuditEvent[];
  className?: string;
}

export function AuditTimeline({ events, className }: AuditTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="p-8 text-center border-2 border-dashed border-status-neutral rounded-xl">
        <CheckCircle className="h-12 w-12 text-status-success mx-auto mb-4 opacity-40" />
        <h3 className="text-h3 font-semibold text-text-secondary mb-2">No audit events</h3>
        <p className="text-body text-text-muted max-w-sm mx-auto">
          This prescription has not been flagged for review.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {events.map((event, index) => (
        <div key={event.id} className="flex gap-6">
          <div className="flex flex-col items-center w-6 flex-shrink-0">
            <div className={cn(
              'w-4 h-4 rounded-full ring-4 ring-surface-2 shadow-sm flex items-center justify-center transition-all duration-300',
              event.resolved 
                ? 'bg-status-success ring-status-success/20' 
                : 'bg-status-neutral ring-status-neutral/20',
              event.severity === 'critical' && 'bg-status-critical ring-status-critical/30 scale-110',
              event.severity === 'high' && 'bg-status-warning ring-status-warning/30'
            )}>
              {event.resolved ? (
                <CheckCircle className="h-3 w-3 text-status-success" />
              ) : (
                <AlertTriangle className="h-3 w-3 text-status-critical" />
              )}
            </div>
            {index < events.length - 1 && (
              <div className={cn(
                'flex-1 w-0.5 bg-gradient-to-t',
                event.resolved ? 'from-status-success to-transparent' : 'from-status-neutral to-transparent'
              )} />
            )}
          </div>

          <div className="flex-1 pb-6">
            <div className="flex items-start gap-3 mb-3">
              <StatusBadge status={event.flagCode} severity={event.severity} />
              <StatusBadge status="flagged" size="sm" />
              <p className="text-caption text-text-muted font-mono uppercase tracking-wider">
                {event.createdBy}  {new Date(event.createdAt).toLocaleString()}
              </p>
            </div>

            <h4 className="text-h3 font-bold text-text-primary mb-2 leading-tight">{flagLabels[event.flagCode] || event.flagCode}</h4>
            <p className="text-body text-text-secondary mb-4 leading-relaxed">{event.issue}</p>

            <div className="bg-clinical-50 border border-clinical-200 rounded-lg p-4 mb-4">
              <h5 className="text-body font-semibold text-clinical-700 mb-2 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                Clinical Recommendation
              </h5>
              <p className="text-body-sm text-clinical-800 italic">{event.recommendation}</p>
            </div>

            {event.resolved && (
              <div className="bg-status-success/5 border border-status-success/30 rounded-lg p-4">
                <div className="flex items-start gap-3 mb-2">
                  <CheckCircle className="h-5 w-5 text-status-success mt-0.5 flex-shrink-0" />
                  <div>
                    <h5 className="text-body font-semibold text-status-success-text">Resolved</h5>
                    <p className="text-caption text-text-muted">
                      {event.resolvedBy}  {new Date(event.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                {event.resolutionNote && (
                  <p className="text-body-sm text-status-success-text bg-status-success/10 p-3 rounded-md">
                    {event.resolutionNote}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

const flagLabels: Record<string, string> = {
  'high_dose': 'HIGH DOSE',
  'extended_duration': 'LONG DURATION',
  'allergy_match': 'ALLERGY CONFLICT',
  'drug_interaction': 'DRUG INTERACTION',
  'controlled_sub': 'CONTROLLED SUBSTANCE',
  'sla_breach': 'SLA BREACH',
  'duplicate_rx': 'DUPLICATE PRESCRIPTION',
};

