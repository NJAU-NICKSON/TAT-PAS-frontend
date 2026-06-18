import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  User, Calendar, Phone, Mail, Droplets, AlertCircle,
  Activity, Stethoscope, Pill, ArrowLeft, Clock, ChevronRight,
  Loader2, MapPin, Heart, Thermometer, Wind,
} from 'lucide-react';
import { patientsApi } from '../api/patients';
import { prescriptionsApi } from '../api/prescriptions';
import { visitsApi, Visit } from '../api/visits';
import { Patient, Prescription } from '../models/types';
import { getSLAState, formatElapsed } from '../components/ui/SLAStatusBadge';

function age(dob?: string): string {
  if (!dob) return ' - ';
  const diff = Date.now() - new Date(dob).getTime();
  return `${Math.floor(diff / (365.25 * 24 * 3600 * 1000))} yrs`;
}

function fmtDate(iso?: string): string {
  if (!iso) return ' - ';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDateTime(iso?: string): string {
  if (!iso) return ' - ';
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const PRIORITY_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  stat:      { color: '#7C3AED', bg: '#FAF5FF', border: '#E9D5FF' },
  urgent:    { color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  routine:   { color: '#178A3D', bg: '#F0FDF4', border: '#BBF7D0' },
  discharge: { color: '#7C3AED', bg: '#FAF5FF', border: '#E9D5FF' },
  nicu:      { color: '#DB2777', bg: '#FDF2F8', border: '#FBCFE8' },
  critical:  { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  immediate: { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
};

const STATUS_COLORS: Record<string, { color: string; bg: string; border: string; dot: string }> = {
  submitted:    { color: '#0369A1', bg: '#F0F9FF', border: '#BAE6FD', dot: '#0284C7' },
  verified:     { color: '#178A3D', bg: '#F0FDF4', border: '#BBF7D0', dot: '#22C55E' },
  dispensed:    { color: '#0369A1', bg: '#F0F9FF', border: '#BAE6FD', dot: '#0284C7' },
  administered: { color: '#178A3D', bg: '#F0FDF4', border: '#BBF7D0', dot: '#22C55E' },
  flagged:      { color: '#7C3AED', bg: '#FAF5FF', border: '#E9D5FF', dot: '#7C3AED' },
  draft:        { color: '#475569', bg: '#F8FAFC', border: '#E2E8F0', dot: '#94A3B8' },
  archived:     { color: '#94A3B8', bg: '#F8FAFC', border: '#E2E8F0', dot: '#CBD5E1' },
};

const VISIT_STATUS_LABELS: Record<string, string> = {
  registered: 'Registered', triaged: 'Triaged', waiting_for_doctor: 'Waiting',
  in_consultation: 'In Consultation', awaiting_results: 'Awaiting Results',
  treatment_in_progress: 'Treatment', admitted: 'Admitted', in_ward: 'In Ward',
  ready_for_discharge: 'Ready for Discharge', discharged: 'Discharged', cancelled: 'Cancelled',
};

function VitalsRow({ vitals }: { vitals: NonNullable<Visit['vitals']> }) {
  const items = [
    { icon: Heart,       label: 'BP',     value: vitals.blood_pressure_systolic && vitals.blood_pressure_diastolic ? `${vitals.blood_pressure_systolic}/${vitals.blood_pressure_diastolic}` : null, unit: 'mmHg' },
    { icon: Thermometer, label: 'Temp',   value: vitals.temperature_celsius != null ? vitals.temperature_celsius.toFixed(1) : null, unit: '°C' },
    { icon: Activity,    label: 'Pulse',  value: vitals.pulse_rate?.toString() ?? null, unit: 'bpm' },
    { icon: Wind,        label: 'SpO2',   value: vitals.oxygen_saturation?.toString() ?? null, unit: '%' },
    { icon: Activity,    label: 'RR',     value: vitals.respiratory_rate?.toString() ?? null, unit: '/min' },
    { icon: User,        label: 'Wt',     value: vitals.weight_kg?.toString() ?? null, unit: 'kg' },
  ].filter(i => i.value !== null);

  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {items.map(({ icon: Icon, label, value, unit }) => (
        <span
          key={label}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-caption font-semibold"
          style={{ background: '#F0F9FF', color: '#0369A1', border: '1px solid #BAE6FD' }}
        >
          <Icon className="w-3 h-3" />
          {label}: {value} {unit}
        </span>
      ))}
      {vitals.triage_notes && (
        <span className="text-caption italic w-full mt-0.5" style={{ color: 'var(--text-muted)' }}>
          &quot;{vitals.triage_notes}&quot;
        </span>
      )}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-card)' }}>
      <div className="flex items-center gap-2.5 px-5 py-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
        {icon}
        <h2 className="text-body font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5 px-5" style={{ borderBottom: '1px solid var(--border-default)' }}>
      <span className="text-caption font-semibold uppercase tracking-wider w-32 flex-shrink-0 pt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="text-body-sm flex-1" style={{ color: 'var(--text-primary)' }}>{value || ' - '}</span>
    </div>
  );
}

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [patient, setPatient]   = useState<Patient | null>(null);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [visits, setVisits]     = useState<Visit[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.allSettled([
      patientsApi.getById(id),
      prescriptionsApi.list({ patient_id: id, limit: 10 }),
      visitsApi.list({ patient_id: id, limit: 10 }),
    ]).then(([patRes, rxRes, vsRes]) => {
      if (patRes.status === 'fulfilled') setPatient(patRes.value.data);
      else setError('Patient not found.');
      if (rxRes.status === 'fulfilled') {
        const d = rxRes.value.data;
        setPrescriptions(Array.isArray(d) ? d : []);
      }
      if (vsRes.status === 'fulfilled') {
        const d = vsRes.value.data;
        setVisits(Array.isArray(d) ? d : []);
      }
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--clinical-600)' }} />
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertCircle className="w-10 h-10" style={{ color: 'var(--status-critical-icon)' }} />
        <p className="text-body font-semibold" style={{ color: 'var(--text-primary)' }}>{error ?? 'Patient not found'}</p>
        <Link to="/patients" className="text-body-sm flex items-center gap-1 font-medium" style={{ color: 'var(--clinical-600)' }}>
          <ArrowLeft className="w-3.5 h-3.5" /> Back to patients
        </Link>
      </div>
    );
  }

  const fullName = `${patient.first_name} ${patient.last_name}`;
  const initials = `${patient.first_name[0]}${patient.last_name[0]}`.toUpperCase();

  return (
    <div className="space-y-5">
      <Link
        to="/patients"
        className="inline-flex items-center gap-1.5 text-body-sm font-medium transition-colors"
        style={{ color: 'var(--text-muted)' }}
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Patients
      </Link>

      <div
        className="px-6 py-4 flex items-start gap-4"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-card)',
        }}
      >
        <div
          className="w-12 h-12 flex items-center justify-center text-lg font-bold flex-shrink-0"
          style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)', borderRadius: 'var(--radius-card)' }}
        >
          {initials}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-lg font-semibold leading-tight tracking-tight" style={{ color: 'var(--text-primary)' }}>{fullName}</h1>
              <p className="text-body-sm mt-0.5 font-mono" style={{ color: 'var(--text-muted)' }}>
                MRN: {patient.mrn}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {patient.current_department && (
                <span className="flex items-center gap-1 text-meta font-semibold px-2 py-0.5" style={{ background: 'var(--status-info-bg)', color: 'var(--status-info-text)', border: '1px solid var(--status-info-border)', borderRadius: 'var(--radius-badge)' }}>
                  <MapPin className="w-3 h-3" />
                  {patient.current_department}
                </span>
              )}
              {patient.blood_group && (
                <span className="flex items-center gap-1 text-meta font-semibold px-2 py-0.5" style={{ background: 'var(--status-critical-bg)', color: 'var(--status-critical-text)', border: '1px solid var(--status-critical-border)', borderRadius: 'var(--radius-badge)' }}>
                  <Droplets className="w-3 h-3" />
                  {patient.blood_group}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2.5">
            {[
              { icon: Calendar, label: patient.dob ? `${fmtDate(patient.dob)} (${age(patient.dob)})` : ' - ' },
              { icon: User,     label: patient.gender ?? ' - ' },
              patient.contact?.phone && { icon: Phone, label: patient.contact.phone },
              patient.contact?.email && { icon: Mail,  label: patient.contact.email },
            ].filter(Boolean).map((item, i) => {
              const { icon: Icon, label } = item as { icon: typeof User; label: string };
              return (
                <span key={i} className="flex items-center gap-1.5 text-body-sm" style={{ color: 'var(--text-secondary)' }}>
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                  {label}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        <div className="space-y-5">

          <Section
            title="Demographics"
            icon={<div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(23,138,61,0.1)' }}><User className="w-3.5 h-3.5" style={{ color: '#178A3D' }} /></div>}
          >
            <div>
              <InfoRow label="Full name"  value={fullName} />
              <InfoRow label="MRN"        value={<span className="font-mono">{patient.mrn}</span>} />
              <InfoRow label="Date of birth" value={patient.dob ? `${fmtDate(patient.dob)} (${age(patient.dob)})` : ' - '} />
              <InfoRow label="Gender"     value={patient.gender} />
              <InfoRow label="Blood group" value={patient.blood_group} />
              <InfoRow label="Phone"      value={patient.contact?.phone} />
              <InfoRow label="Email"      value={patient.contact?.email} />
              <InfoRow label="Address"    value={patient.contact?.address} />
              <InfoRow label="Registered" value={fmtDate(patient.created_at)} />
            </div>
          </Section>

          {(patient.allergies?.length || patient.chronic_conditions?.length) ? (
            <Section
              title="Clinical Flags"
              icon={<div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(220,38,38,0.1)' }}><Activity className="w-3.5 h-3.5" style={{ color: '#DC2626' }} /></div>}
            >
              <div className="p-5 space-y-4">
                {patient.allergies?.length ? (
                  <div>
                    <p className="text-caption font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Allergies</p>
                    <div className="flex flex-wrap gap-1.5">
                      {patient.allergies.map((a, i) => (
                        <span key={`${a.substance}-${i}`} className="text-caption font-semibold px-2.5 py-1 rounded-full" style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
                          {a.substance}{a.severity ? ` (${a.severity})` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                {patient.chronic_conditions?.length ? (
                  <div>
                    <p className="text-caption font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Chronic Conditions</p>
                    <div className="flex flex-wrap gap-1.5">
                      {patient.chronic_conditions.map(c => (
                        <span key={c} className="text-caption font-semibold px-2.5 py-1 rounded-full" style={{ background: '#FFFBEB', color: '#D97706', border: '1px solid #FDE68A' }}>
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </Section>
          ) : null}
        </div>

        <div className="lg:col-span-2 space-y-5">

          <Section
            title={`Recent Prescriptions (${prescriptions.length})`}
            icon={<div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(23,138,61,0.1)' }}><Pill className="w-3.5 h-3.5" style={{ color: '#178A3D' }} /></div>}
          >
            {prescriptions.length === 0 ? (
              <div className="flex items-center justify-center h-24 text-body-sm" style={{ color: 'var(--text-muted)' }}>
                No prescriptions found for this patient.
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--border-default)' }}>
                {prescriptions.map(rx => {
                  const s = STATUS_COLORS[rx.status] ?? STATUS_COLORS.draft;
                  const p = rx.priority ? (PRIORITY_COLORS[rx.priority] ?? PRIORITY_COLORS.routine) : null;
                  const start = rx.submitted_at ?? rx.created_at;
                  const elapsed = (Date.now() - new Date(start).getTime()) / 60000;
                  const slaState = getSLAState(elapsed, rx.sla_threshold_min ?? 60);
                  return (
                    <Link
                      key={rx.id}
                      to={`/prescriptions/${rx.id}`}
                      className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-[var(--bg-row-hover)]"
                    >
                      <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: s.dot }} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-caption font-semibold" style={{ color: 'var(--text-secondary)' }}>
                            {rx.rx_number ?? rx.id.slice(0, 8) + ''}
                          </span>
                          <span className="text-caption font-bold px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                            {rx.status}
                          </span>
                          {p && rx.priority && (
                            <span className="text-caption font-bold px-2 py-0.5 rounded-full" style={{ background: p.bg, color: p.color, border: `1px solid ${p.border}` }}>
                              {rx.priority.toUpperCase()}
                            </span>
                          )}
                        </div>
                        <p className="text-caption mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {rx.medications.map(m => m.name).join(', ').slice(0, 60) || 'No medications listed'}
                        </p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-caption flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                            <Calendar className="w-3 h-3" />
                            {fmtDateTime(rx.ordered_at ?? rx.created_at)}
                          </span>
                          {rx.status !== 'administered' && rx.status !== 'archived' && (
                            <span
                              className="text-caption font-semibold flex items-center gap-1"
                              style={{ color: slaState === 'breached' ? '#DC2626' : slaState === 'warning' ? '#D97706' : 'var(--text-muted)' }}
                            >
                              <Clock className="w-3 h-3" />
                              {formatElapsed(elapsed)}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 flex-shrink-0 mt-1" style={{ color: 'var(--text-muted)' }} />
                    </Link>
                  );
                })}
              </div>
            )}
          </Section>

          <Section
            title={`Recent Visits (${visits.length})`}
            icon={<div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(5,150,105,0.1)' }}><Stethoscope className="w-3.5 h-3.5" style={{ color: '#178A3D' }} /></div>}
          >
            {visits.length === 0 ? (
              <div className="flex items-center justify-center h-24 text-body-sm" style={{ color: 'var(--text-muted)' }}>
                No visits found for this patient.
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--border-default)' }}>
                {visits.map(v => {
                  const isActive = v.status !== 'discharged' && v.status !== 'cancelled';
                  const priColors = PRIORITY_COLORS[v.priority] ?? PRIORITY_COLORS.routine;
                  return (
                    <Link
                      key={v.id}
                      to={`/visits/${v.id}`}
                      className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-[var(--bg-row-hover)]"
                    >
                      <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: isActive ? '#178A3D' : '#94A3B8' }} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-caption font-semibold" style={{ color: 'var(--text-secondary)' }}>
                            {v.visit_number}
                          </span>
                          <span
                            className="text-caption font-bold px-2 py-0.5 rounded-full"
                            style={{
                              background: isActive ? '#F0FDF4' : '#F8FAFC',
                              color:      isActive ? '#178A3D' : '#94A3B8',
                              border:     `1px solid ${isActive ? '#BBF7D0' : '#E2E8F0'}`,
                            }}
                          >
                            {VISIT_STATUS_LABELS[v.status] ?? v.status}
                          </span>
                          <span className="text-caption font-bold px-2 py-0.5 rounded-full capitalize" style={{ background: priColors.bg, color: priColors.color, border: `1px solid ${priColors.border}` }}>
                            {v.priority}
                          </span>
                        </div>
                        <p className="text-caption mt-0.5 capitalize" style={{ color: 'var(--text-secondary)' }}>
                          {v.visit_type.replace(/_/g, ' ')} {v.chief_complaint ? ` ${v.chief_complaint}` : ''}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1" style={{ color: 'var(--text-muted)' }}>
                          <Calendar className="w-3 h-3" />
                          <span className="text-caption">{fmtDateTime(v.registered_at)}</span>
                          {v.ward_name && (
                            <>
                              <span className="text-meta">·</span>
                              <MapPin className="w-3 h-3" />
                              <span className="text-caption">{[v.ward_name, v.bed_label].filter(Boolean).join(' · ')}</span>
                            </>
                          )}
                        </div>
                        {v.vitals && <VitalsRow vitals={v.vitals} />}
                      </div>
                      <ChevronRight className="w-4 h-4 flex-shrink-0 mt-1" style={{ color: 'var(--text-muted)' }} />
                    </Link>
                  );
                })}
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
