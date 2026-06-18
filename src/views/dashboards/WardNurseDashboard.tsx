import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Syringe, BedDouble, RefreshCw, AlertCircle, Wrench, CheckCircle2, X, Loader2, Thermometer, ChevronRight, MapPin, Bed as BedIcon } from 'lucide-react';
import { prescriptionsApi } from '../../api/prescriptions';
import { bedsApi, Bed } from '../../api/beds';
import { visitsApi, Visit } from '../../api/visits';
import { Prescription } from '../../models/types';
import { TATTimer } from '../../components/ui/TATTimer';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { toast } from 'sonner';

type ListResult<T> = T[] | { items?: T[] };

function AdministerModal({
  rx,
  onSuccess,
  onClose,
}: {
  rx: Prescription;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const now = new Date();
  const localISO = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  const [dose, setDose] = useState(rx.medications[0]?.dose ?? '');
  const [route, setRoute] = useState(rx.medications[0]?.route ?? 'oral');
  const [adminTime, setAdminTime] = useState(localISO);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!dose.trim()) return;
    setIsSubmitting(true);
    try {
      await prescriptionsApi.updateStatus(rx.id, 'administered', {
        administered_dose: dose.trim(),
        administered_route: route,
        administered_time_actual: new Date(adminTime).toISOString(),
        administration_notes: notes.trim() || undefined,
      });
      toast.success('Administration recorded');
      onSuccess();
    } catch {
      toast.error('Failed to record administration');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="w-full max-w-md mx-4 rounded-lg overflow-hidden"
        style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-modal)' }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border-default)' }}>
          <div className="flex items-center gap-2">
            <Syringe className="w-5 h-5" style={{ color: '#178A3D' }} />
            <h2 className="text-h3">Record Administration</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-[var(--bg-base)]" style={{ color: 'var(--text-muted)' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-3 border-b" style={{ background: '#EFF6FF', borderColor: 'var(--border-default)' }}>
          <p className="text-body-sm font-bold" style={{ color: '#0F6E2F' }}>
            {rx.patient_name ?? rx.patient_id}
          </p>
          <p className="text-meta mt-0.5" style={{ color: '#1FA64A' }}>
            {rx.medications.map(m => `${m.name} ${m.dose}`).join(' · ')}
          </p>
          {rx.dispensed_by_name && (
            <p className="text-meta mt-0.5" style={{ color: '#6B7280' }}>
              Dispensed by: {rx.dispensed_by_name}
            </p>
          )}
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-label mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Actual Dose Administered <span className="text-[var(--sla-breached)]">*</span>
            </label>
            <input
              type="text"
              value={dose}
              onChange={e => setDose(e.target.value)}
              placeholder="e.g. 500mg, 2 tablets"
              className="w-full px-3 py-2 text-body-sm border rounded-lg focus:outline-none"
              style={{ borderColor: 'var(--border-default)', background: 'var(--bg-base)', borderRadius: 'var(--radius-button)' }}
            />
          </div>

          <div>
            <label className="block text-label mb-1.5" style={{ color: 'var(--text-secondary)' }}>Route of Administration</label>
            <select
              value={route}
              onChange={e => setRoute(e.target.value)}
              className="w-full px-3 py-2 text-body-sm border rounded-lg focus:outline-none"
              style={{ borderColor: 'var(--border-default)', background: 'var(--bg-base)', borderRadius: 'var(--radius-button)' }}
            >
              <option value="oral">Oral (PO)</option>
              <option value="IV">Intravenous (IV)</option>
              <option value="IM">Intramuscular (IM)</option>
              <option value="SC">Subcutaneous (SC)</option>
              <option value="sublingual">Sublingual (SL)</option>
              <option value="topical">Topical</option>
              <option value="inhalation">Inhalation</option>
              <option value="rectal">Rectal (PR)</option>
              <option value="NGT">Nasogastric Tube (NGT)</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-label mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Time of Administration <span className="text-[var(--sla-breached)]">*</span>
            </label>
            <input
              type="datetime-local"
              value={adminTime}
              onChange={e => setAdminTime(e.target.value)}
              className="w-full px-3 py-2 text-body-sm border rounded-lg focus:outline-none"
              style={{ borderColor: 'var(--border-default)', background: 'var(--bg-base)', borderRadius: 'var(--radius-button)' }}
            />
          </div>

          <div>
            <label className="block text-label mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Observations / Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Patient tolerated well, any adverse reactions, observations..."
              className="w-full px-3 py-2.5 text-body-sm border rounded-lg resize-none focus:outline-none"
              style={{ borderColor: 'var(--border-default)', background: 'var(--bg-base)', borderRadius: 'var(--radius-card)' }}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: 'var(--border-default)' }}>
          <button
            onClick={onClose}
            className="px-4 py-2 text-body-sm font-semibold border rounded-lg"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)', borderRadius: 'var(--radius-button)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!dose.trim() || isSubmitting}
            className="flex items-center gap-2 px-5 py-2 text-body-sm font-semibold text-white rounded-lg disabled:opacity-40"
            style={{ background: '#178A3D', borderRadius: 'var(--radius-button)' }}
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Record Administration
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function StatCard({
  label,
  value,
  icon: Icon,
  danger = false,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  accentColor?: string;
  accentBg?: string;
  danger?: boolean;
}) {
  const isDanger = danger && Number(value) > 0;
  return (
    <div
      className="flex flex-col px-4 py-3"
      style={{
        background: isDanger ? 'var(--status-critical-bg)' : 'var(--bg-card)',
        border: `1px solid ${isDanger ? 'var(--status-critical-border)' : 'var(--border-default)'}`,
        borderRadius: 'var(--radius-card)',
      }}
    >
      <div className="flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" style={{ color: isDanger ? 'var(--status-critical-icon)' : 'var(--text-muted)' }} />
        <span className="text-label" style={{ color: 'var(--text-muted)' }}>{label}</span>
      </div>
      <p className="font-bold tabular-nums leading-none mt-2" style={{ fontSize: '1.75rem', color: isDanger ? 'var(--status-critical-text)' : 'var(--text-primary)' }}>
        {value}
      </p>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div
      className="h-16 rounded-lg animate-shimmer"
      style={{ borderRadius: 'var(--radius-card)' }}
    />
  );
}

function bedStatusStyle(status: Bed['status']): {
  borderColor: string;
  background: string;
  dotColor: string;
} {
  switch (status) {
    case 'available':
      return {
        borderColor: 'var(--sla-safe)',
        background: 'rgba(16,185,129,0.07)',
        dotColor: 'var(--sla-safe)',
      };
    case 'occupied':
      return {
        borderColor: 'var(--clinical-600)',
        background: 'var(--clinical-50)',
        dotColor: 'var(--clinical-600)',
      };
    case 'reserved':
      return {
        borderColor: 'var(--sla-warning)',
        background: 'rgba(245,158,11,0.07)',
        dotColor: 'var(--sla-warning)',
      };
    case 'cleaning':
      return {
        borderColor: 'var(--sla-warning)',
        background: 'rgba(245,158,11,0.07)',
        dotColor: 'var(--sla-warning)',
      };
    default:
      return {
        borderColor: 'var(--border-default)',
        background: 'var(--bg-base)',
        dotColor: 'var(--text-disabled)',
      };
  }
}

export function WardNurseDashboard() {
  const navigate = useNavigate();
  const [dispensedRx, setDispensedRx] = useState<Prescription[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [triageQueue, setTriageQueue] = useState<Visit[]>([]);
  const [wardPatients, setWardPatients] = useState<Visit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [adminTarget, setAdminTarget] = useState<Prescription | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [rxRes, bedsRes, triageRes, admittedRes, inWardRes] = await Promise.all([
        prescriptionsApi.list({ status: 'dispensed', limit: 100 }),
        bedsApi.list(),
        visitsApi.list({ status: 'registered', limit: 50 }),
        visitsApi.list({ status: 'admitted', limit: 50 }),
        visitsApi.list({ status: 'in_ward', limit: 50 }),
      ]);
      const rxData = rxRes.data as ListResult<Prescription>;
      const bedsData = bedsRes.data as ListResult<Bed>;
      const triageData = triageRes.data as ListResult<Visit>;
      const admittedData = admittedRes.data as ListResult<Visit>;
      const inWardData = inWardRes.data as ListResult<Visit>;
      const rxItems = Array.isArray(rxData) ? rxData : rxData.items ?? [];
      const bedItems = Array.isArray(bedsData) ? bedsData : bedsData.items ?? [];
      const triageItems = Array.isArray(triageData) ? triageData : triageData.items ?? [];
      const admittedItems = Array.isArray(admittedData) ? admittedData : admittedData.items ?? [];
      const inWardItems = Array.isArray(inWardData) ? inWardData : inWardData.items ?? [];
      const wardItems = [...admittedItems, ...inWardItems].filter(
        (visit, index, arr) => arr.findIndex(item => item.id === visit.id) === index
      );
      setDispensedRx(rxItems);
      setBeds(bedItems);
      setTriageQueue(triageItems);
      setWardPatients(wardItems);
    } catch {} finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const availableBeds = beds.filter((b) => b.status === 'available').length;
  const occupiedBeds = beds.filter((b) => b.status === 'occupied').length;
  const maintenanceBeds = beds.filter(
    (b) => b.status === 'maintenance' || b.status === 'cleaning' || b.status === 'reserved'
  ).length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div
        className="flex items-center justify-between px-6 h-12 flex-shrink-0"
        style={{ background: '#FFFFFF', borderBottom: '1px solid var(--border-default)' }}
      >
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>Medication Administration</h1>
          <span className="text-meta tabular-nums" style={{ color: 'var(--text-muted)' }}>{formatDate()}</span>
        </div>
        <button
          onClick={loadData}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 font-semibold text-body-sm transition-colors disabled:opacity-60"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-button)', color: 'var(--text-secondary)' }}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div
        className="flex-shrink-0 grid grid-cols-4 gap-3 px-7 py-4"
        style={{ background: '#F1F5F9', borderBottom: '1px solid var(--border-default)' }}
      >
        <StatCard
          label="Pending Triage"
          value={isLoading ? ' - ' : triageQueue.length}
          icon={Thermometer}
          accentColor="#178A3D"
          accentBg="rgba(23,138,61,0.10)"
          danger
        />
        <StatCard
          label="Pending Admin"
          value={isLoading ? ' - ' : dispensedRx.length}
          icon={Syringe}
          accentColor="#DC2626"
          accentBg="rgba(220,38,38,0.10)"
          danger
        />
        <StatCard
          label="Available Beds"
          value={isLoading ? ' - ' : availableBeds}
          icon={BedDouble}
          accentColor="#178A3D"
          accentBg="rgba(5,150,105,0.10)"
        />
        <StatCard
          label="Ward Patients"
          value={isLoading ? ' - ' : wardPatients.length}
          icon={BedIcon}
          accentColor="#178A3D"
          accentBg="rgba(23,138,61,0.10)"
        />
      </div>

      {!isLoading && dispensedRx.length > 0 && (
        <div
          className="flex-shrink-0 flex items-center gap-3 px-6 py-2.5"
          style={{ background: 'var(--bg-alert)', borderBottom: '1px solid var(--border-breach)' }}
        >
          <AlertCircle size={16} style={{ color: 'var(--sla-breached)', flexShrink: 0 }} />
          <span className="text-body-sm font-semibold" style={{ color: 'var(--sla-breached)' }}>
            {dispensedRx.length} medication{dispensedRx.length !== 1 ? 's' : ''} dispensed and
            awaiting administration
          </span>
        </div>
      )}

      {(isLoading || triageQueue.length > 0) && (
        <div
          className="flex-shrink-0 border-b"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
        >
          <div className="flex items-center justify-between px-7 py-3 border-b" style={{ borderColor: 'var(--border-default)' }}>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(23,138,61,0.1)' }}>
                <Thermometer className="w-3.5 h-3.5" style={{ color: '#178A3D' }} />
              </div>
              <span className="text-body-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                Patients Awaiting Triage
              </span>
              {!isLoading && triageQueue.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-micro font-extrabold text-white" style={{ background: '#178A3D' }}>
                  {triageQueue.length}
                </span>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="flex gap-3 px-7 py-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-16 w-56 flex-shrink-0 rounded-lg animate-shimmer" />
                ))}
              </div>
            ) : (
              <div className="flex gap-3 px-7 py-3">
                {triageQueue.map(v => (
                  <div
                    key={v.id}
                    className="flex-shrink-0 w-64 rounded-lg border p-3"
                    style={{
                      background: 'var(--bg-base)',
                      borderColor: 'var(--border-default)',
                      borderLeft: '3px solid #178A3D',
                    }}
                  >
                    <p className="text-body-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                      {v.patient_name ?? 'Unknown Patient'}
                    </p>
                    <p className="text-caption truncate mb-2" style={{ color: 'var(--text-muted)' }}>
                      {v.visit_number} · {v.department_id}
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <TATTimer startTime={v.registered_at} slaThresholdMin={10} mode="elapsed" size="sm" />
                      <button
                        onClick={() => navigate(`/visits/${v.id}/triage`)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-caption font-bold text-white flex-shrink-0"
                        style={{ background: '#178A3D' }}
                      >
                        Triage <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {(isLoading || wardPatients.length > 0) && (
        <div
          className="flex-shrink-0 border-b"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
        >
          <div className="flex items-center justify-between px-7 py-3 border-b" style={{ borderColor: 'var(--border-default)' }}>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(23,138,61,0.1)' }}>
                <BedIcon className="w-3.5 h-3.5" style={{ color: '#178A3D' }} />
              </div>
              <span className="text-body-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                Current Ward Patients
              </span>
              {!isLoading && wardPatients.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-micro font-extrabold text-white" style={{ background: '#178A3D' }}>
                  {wardPatients.length}
                </span>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="flex gap-3 px-7 py-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-16 w-56 flex-shrink-0 rounded-lg animate-shimmer" />
                ))}
              </div>
            ) : (
              <div className="flex gap-3 px-7 py-3">
                {wardPatients.map(v => (
                  <div
                    key={v.id}
                    className="flex-shrink-0 w-72 rounded-lg border p-3"
                    style={{
                      background: 'var(--bg-base)',
                      borderColor: 'var(--border-default)',
                      borderLeft: '3px solid #178A3D',
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-body-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                          {v.patient_name ?? 'Unknown Patient'}
                        </p>
                        <p className="text-caption truncate" style={{ color: 'var(--text-muted)' }}>
                          {v.visit_number}
                        </p>
                      </div>
                      <StatusBadge status={v.status} size="sm" />
                    </div>
                    <div className="mt-2 space-y-1">
                      <p className="text-caption flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                        <MapPin className="w-3 h-3" />
                        {v.ward_name ?? 'Ward pending'}
                      </p>
                      <p className="text-caption flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                        <BedIcon className="w-3 h-3" />
                        {v.bed_label ?? 'Bed pending'}
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <TATTimer startTime={v.admitted_at ?? v.updated_at} slaThresholdMin={240} mode="elapsed" size="sm" />
                      <button
                        onClick={() => navigate(`/visits/${v.id}`)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-caption font-bold text-white flex-shrink-0"
                        style={{ background: '#178A3D' }}
                      >
                        View <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden" style={{ background: '#F1F5F9' }}>
        <div className="flex-1 overflow-y-auto px-7 py-5 space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <SkeletonRow key={i} />
              ))}
            </div>
          ) : dispensedRx.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div
                className="w-16 h-16 rounded-lg flex items-center justify-center mb-4"
                style={{ background: 'rgba(16,185,129,0.1)' }}
              >
                <CheckCircle2 size={32} style={{ color: 'var(--sla-safe)' }} />
              </div>
              <p className="text-h3 mb-1" style={{ color: 'var(--text-primary)' }}>
                All caught up
              </p>
              <p className="text-body-sm" style={{ color: 'var(--text-muted)' }}>
                No medications pending administration.
              </p>
            </div>
          ) : (
            dispensedRx.map((rx) => {
              const patientLabel =
                rx.patient_name ??
                (rx.patient
                  ? `${rx.patient.first_name} ${rx.patient.last_name}`
                  : 'Unknown Patient');

              return (
                <div
                  key={rx.id}
                  className="p-4 rounded-lg border transition-all duration-100"
                  style={{
                    background: 'var(--bg-card)',
                    borderColor: 'var(--border-default)',
                    borderLeft: '3px solid #178A3D',
                    boxShadow: '0 1px 3px rgba(15,23,42,0.06), 0 4px 12px rgba(15,23,42,0.04)',
                  }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span
                          className="text-body-sm font-semibold"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {patientLabel}
                        </span>
                        <span
                          className="text-mono"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {rx.rx_number ?? rx.id.slice(0, 8) + ''}
                        </span>
                        <StatusBadge status={rx.status} size="sm" />
                      </div>

                      {rx.medications?.length > 0 && (
                        <p
                          className="text-body-sm mt-1 truncate"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {rx.medications.map((m) => `${m.name} ${m.dose}`).join(' · ')}
                        </p>
                      )}

                      {rx.dispensed_at && (
                        <div className="mt-2">
                          <TATTimer
                            startTime={rx.dispensed_at}
                            slaThresholdMin={30}
                            mode="elapsed"
                            size="sm"
                          />
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => setAdminTarget(rx)}
                      className="flex-shrink-0 flex items-center gap-2 px-4 py-2 text-body-sm font-semibold text-white hover:opacity-90 transition-opacity"
                      style={{
                        background: '#178A3D',
                        borderRadius: 'var(--radius-button)',
                      }}
                    >
                      <Syringe size={14} />
                      Administer
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div
          className="w-72 flex-shrink-0 flex flex-col border-l overflow-y-auto"
          style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}
        >
          <div className="px-4 pt-5 pb-3 border-b" style={{ borderColor: 'var(--border-default)' }}>
            <p className="text-caption font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Bed Grid</p>
            <p className="text-body-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {beds.length} beds · {availableBeds} available
            </p>
            <div className="flex items-center gap-3 mt-2">
              {[
                { label: 'Available', color: '#178A3D' },
                { label: 'Occupied',  color: '#178A3D' },
                { label: 'Other',     color: '#94A3B8' },
              ].map(({ label, color }) => (
                <div key={label} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                  <span className="text-caption" style={{ color: 'var(--text-muted)' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 px-4 py-4">
            {beds.length === 0 ? (
              <div className="text-center py-8">
                <BedDouble
                  size={32}
                  className="mx-auto mb-2"
                  style={{ color: 'var(--text-disabled)' }}
                />
                <p className="text-body-sm" style={{ color: 'var(--text-disabled)' }}>
                  No beds configured
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {beds.map((bed) => {
                  const { borderColor, background, dotColor } = bedStatusStyle(bed.status);
                  return (
                    <div
                      key={bed.id}
                      className="rounded-lg border p-2 flex flex-col items-center justify-center text-center aspect-square"
                      style={{ borderColor, background, borderRadius: 'var(--radius-badge)' }}
                    >
                      {bed.status === 'maintenance' || bed.status === 'cleaning' ? (
                        <Wrench
                          size={14}
                          className="mb-1"
                          style={{ color: 'var(--text-disabled)' }}
                        />
                      ) : (
                        <div
                          className="w-2 h-2 rounded-full mb-1"
                          style={{ background: dotColor }}
                        />
                      )}
                      <span
                        className="text-meta font-semibold leading-tight"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {bed.bed_label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="px-4 py-4" style={{ borderTop: '1px solid var(--border-default)', background: 'var(--bg-base)' }}>
            <p className="text-caption font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
              Bed Summary
            </p>
            <div className="space-y-2">
              {[
                { label: 'Available',         count: availableBeds,   color: '#178A3D', bg: '#F0FDF4',  border: '#BBF7D0' },
                { label: 'Occupied',          count: occupiedBeds,    color: '#0369A1', bg: '#F0F9FF',  border: '#BAE6FD' },
                { label: 'Maintenance/Other', count: maintenanceBeds, color: '#94A3B8', bg: '#F8FAFC',  border: '#E2E8F0' },
                { label: 'Total',             count: beds.length,     color: '#0F172A', bg: 'var(--bg-card)', border: 'var(--border-default)' },
              ].map(({ label, count, color, bg, border }) => (
                <div
                  key={label}
                  className="flex items-center justify-between px-3 py-2 rounded-lg"
                  style={{ background: bg, border: `1px solid ${border}` }}
                >
                  <span className="text-body-sm" style={{ color: 'var(--text-secondary)' }}>{label}</span>
                  <span className="text-body-sm font-bold tabular-nums" style={{ color }}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {adminTarget && (
        <AdministerModal
          rx={adminTarget}
          onSuccess={() => {
            setAdminTarget(null);
            setDispensedRx(prev => prev.filter(r => r.id !== adminTarget.id));
          }}
          onClose={() => setAdminTarget(null)}
        />
      )}
    </div>
  );
}
