import { PrescriptionStatus, AuditSeverity, AuditType } from '../models/types';

interface StatusBadgeProps {
  status: PrescriptionStatus;
}

interface SeverityBadgeProps {
  severity: AuditSeverity;
}

interface TypeBadgeProps {
  type: AuditType;
}

const statusStyles: Record<PrescriptionStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-blue-100 text-blue-700',
  pending_amendment: 'bg-amber-100 text-amber-700',
  flagged: 'bg-red-100 text-red-700',
  verified: 'bg-green-100 text-green-700',
  dispensed: 'bg-sky-100 text-sky-700',
  administered: 'bg-green-100 text-green-800',
  archived: 'bg-gray-200 text-gray-600',
};

const statusLabels: Record<PrescriptionStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  pending_amendment: 'Pending Amendment',
  flagged: 'Flagged',
  verified: 'Verified',
  dispensed: 'Dispensed',
  administered: 'Administered',
  archived: 'Archived',
};

const severityStyles: Record<AuditSeverity, string> = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-red-100 text-red-700',
  critical: 'bg-rose-100 text-rose-700',
};

const typeStyles: Record<AuditType, string> = {
  automated: 'bg-blue-100 text-blue-700',
  manual: 'bg-slate-100 text-slate-700',
  sla_breach: 'bg-red-100 text-red-700',
  sla_warning: 'bg-amber-100 text-amber-700',
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyles[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${severityStyles[severity]}`}
    >
      {severity}
    </span>
  );
}

export function TypeBadge({ type }: TypeBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${typeStyles[type]}`}
    >
      {type}
    </span>
  );
}

export function RoleBadge({ role }: { role: string }) {
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-navy-100 text-slate-700 bg-slate-100 capitalize">
      {role}
    </span>
  );
}
