import { ShieldAlert, ShieldCheck, HeartPulse } from 'lucide-react';
import { cn, withDoctorTitle } from '../../lib/utils';

interface PatientHeaderProps {
  patient: {
    first_name: string;
    last_name: string;
    mrn: string;
    gender?: string;
    dob?: string;
    weight?: number;
    blood_group?: string;
    allergies: Array<string | { substance: string; severity?: string }>;
    chronic_conditions: string[];
  };
  visit?: {
    type: string;
    department: string;
    assigned_doctor?: string;
  };
  className?: string;
  variant?: 'full' | 'compact';
}

export function PatientHeader({ 
  patient, 
  visit, 
  className,
}: PatientHeaderProps) {
  const age = patient.dob ? Math.floor((new Date().getTime() - new Date(patient.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;
  const fullName = `${patient.first_name} ${patient.last_name}`;

  const avatarInitials = fullName.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();

  return (
    <div className={cn('bg-surface-0 border border-surface-3 rounded-lg p-6 shadow-card', className)}>
      <div className="flex items-start gap-6">
        <div className="flex-shrink-0 w-16 h-16 bg-clinical-100 rounded-full flex items-center justify-center font-semibold text-clinical-700 text-lg">
          {avatarInitials}
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-h1 font-bold text-text-primary line-clamp-1">{fullName}</h1>
            {patient.gender && (
              <span className="px-2 py-0.5 rounded-full text-caption font-medium bg-surface-2 text-text-secondary">
                {patient.gender.toUpperCase()}
              </span>
            )}
            {age && (
              <span className="text-caption text-text-muted">{age} years</span>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 text-mono text-body-sm font-semibold text-text-primary bg-surface-1 px-3 py-1 rounded-md border border-surface-3">
              MRN: {patient.mrn}
            </div>
            {patient.blood_group && (
              <span className="px-2 py-0.5 rounded-full text-caption font-mono bg-status-info text-status-info-text border border-status-info-border">
                {patient.blood_group}
              </span>
            )}
            {patient.weight && (
              <span className="text-caption text-text-muted">
                {patient.weight}kg
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-body-sm font-medium text-text-secondary flex-shrink-0">Allergies:</span>
            {patient.allergies.length === 0 ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-status-success text-status-success-text rounded-lg border border-status-success-border">
                <ShieldCheck className="h-3 w-3" />
                <span className="text-caption font-medium">No known allergies</span>
              </div>
            ) : (
              <div className="flex flex-wrap gap-1">
                {patient.allergies.map((allergy, idx) => {
                  const label = typeof allergy === 'object' && allergy !== null
                    ? String((allergy as Record<string, unknown>).substance ?? '')
                    : String(allergy);
                  return (
                  <div
                    key={idx}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-status-critical text-status-critical-text rounded-md border border-status-critical-border font-medium text-caption shadow-sm hover:shadow-md transition-shadow"
                    role="alert"
                    aria-label={`Allergy: ${label}`}
                  >
                    <ShieldAlert className="h-3 w-3 flex-shrink-0" />
                    <span className="leading-none">{label}</span>
                  </div>
                  );
                })
                ))}
              </div>
            )}
          </div>

          {patient.chronic_conditions.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-body-sm font-medium text-text-secondary flex-shrink-0">Conditions:</span>
              <div className="flex flex-wrap gap-1">
                {patient.chronic_conditions.map((condition, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-status-neutral text-status-neutral-text rounded-md border border-status-neutral-border text-caption font-medium"
                  >
                    <HeartPulse className="h-3 w-3" />
                    <span className="leading-none">{condition}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {visit && (
            <div className="flex items-center gap-3 pt-2 border-t border-surface-3">
              <span className="text-body-sm font-medium text-text-secondary">Current Visit:</span>
              <span className="px-2 py-1 bg-surface-2 text-text-primary rounded-md text-caption font-medium">
                {visit.department}
              </span>
              {visit.assigned_doctor && (
                <span className="text-caption text-text-muted">
                  {withDoctorTitle(visit.assigned_doctor)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

