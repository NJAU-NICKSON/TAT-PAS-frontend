import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stethoscope, ClipboardList, AlertTriangle, CheckCircle2, Clock, Keyboard, ArrowRight } from 'lucide-react';
import { usePrescriptionViewModel } from '../../viewModels/usePrescriptionViewModel';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Prescription } from '../../models/types';

function formatTime(iso: string | undefined): string {
  if (!iso) return ' - ';
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function medicationNames(rx: Prescription): string {
  if (!rx.medications?.length) return 'No medications';
  return rx.medications.map(m => m.name).join(', ');
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
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
      <p
        className="text-2xl font-bold tabular-nums leading-none mt-2"
        style={{ fontSize: '1.75rem', color: isDanger ? 'var(--status-critical-text)' : 'var(--text-primary)' }}
      >
        {value}
      </p>
    </div>
  );
}

function RxCard({ rx, onClick }: { rx: Prescription; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-lg border transition-all duration-100 group"
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border-default)',
        boxShadow: '0 1px 3px rgba(15,23,42,0.05)',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = '#93C5FD';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(15,23,42,0.08)';
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(15,23,42,0.05)';
        (e.currentTarget as HTMLElement).style.transform = '';
      }}
    >
      <div className="flex items-center gap-4 p-4">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-xs"
          style={{ background: 'var(--bg-base)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}
        >
          Rx
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-body-sm font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>
              {rx.rx_number ?? rx.id.slice(0, 8).toUpperCase()}
            </span>
            <StatusBadge status={rx.status} size="sm" />
          </div>
          <p className="text-body-sm truncate" style={{ color: 'var(--text-secondary)' }}>
            {rx.patient_name ?? (rx.patient ? `${rx.patient.first_name} ${rx.patient.last_name}` : 'Unknown Patient')}
          </p>
          <p className="text-caption mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
            {medicationNames(rx)}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right">
            <p className="text-caption" style={{ color: 'var(--text-muted)' }}>
              <Clock className="inline w-3 h-3 mr-0.5" style={{ verticalAlign: 'middle' }} />
              {formatTime(rx.created_at)}
            </p>
          </div>
          <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#93C5FD' }} />
        </div>
      </div>
    </button>
  );
}

function SectionBlock({
  title,
  icon: Icon,
  accentColor,
  accentBg,
  prescriptions,
  onCardClick,
}: {
  title: string;
  icon: React.ElementType;
  accentColor: string;
  accentBg: string;
  prescriptions: Prescription[];
  onCardClick: (id: string) => void;
}) {
  if (!prescriptions.length) return null;
  return (
    <div>
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: accentBg }}>
          <Icon className="w-3.5 h-3.5" style={{ color: accentColor }} />
        </div>
        <h3 className="text-body font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
        <span
          className="text-caption font-bold px-2 py-0.5 rounded-full"
          style={{ background: accentBg, color: accentColor }}
        >
          {prescriptions.length}
        </span>
      </div>
      <div className="space-y-2">
        {prescriptions.map(rx => (
          <RxCard key={rx.id} rx={rx} onClick={() => onCardClick(rx.id)} />
        ))}
      </div>
    </div>
  );
}

export function DoctorDashboard() {
  const navigate = useNavigate();
  const vm = usePrescriptionViewModel();

  useEffect(() => {
    vm.loadPrescriptions({ limit: 100 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flagged       = vm.prescriptions.filter(rx => rx.status === 'flagged');
  const pipeline      = vm.prescriptions.filter(rx => ['draft', 'submitted', 'verified', 'dispensed'].includes(rx.status));
  const completedToday = vm.prescriptions.filter(rx => (rx.status === 'administered' || rx.status === 'archived') && isToday(rx.updated_at));
  const hasAny = vm.prescriptions.length > 0;
  const goToRx = (id: string) => navigate(`/prescriptions/${id}`);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div
        className="flex items-center justify-between px-6 h-12 flex-shrink-0"
        style={{ background: '#FFFFFF', borderBottom: '1px solid var(--border-default)' }}
      >
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>My Prescriptions</h1>
          <span className="text-meta tabular-nums" style={{ color: 'var(--text-muted)' }}>{formatDate()}</span>
        </div>
        <button
          onClick={() => navigate('/consultation')}
          className="flex items-center gap-1.5 px-3 py-1.5 font-semibold text-body-sm text-white transition-colors hover:opacity-90"
          style={{ background: 'var(--scion-green-600)', borderRadius: 'var(--radius-button)' }}
        >
          <Stethoscope className="w-3.5 h-3.5" />
          Consultation Room
        </button>
      </div>

      <div className="flex-shrink-0 px-7 py-4" style={{ background: '#F1F5F9', borderBottom: '1px solid var(--border-default)' }}>
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            label="Flagged"
            value={vm.isLoading ? ' - ' : flagged.length}
            icon={AlertTriangle}
            accentColor="#DC2626"
            accentBg="rgba(220,38,38,0.10)"
            danger
          />
          <StatCard
            label="In Pipeline"
            value={vm.isLoading ? ' - ' : pipeline.length}
            icon={Clock}
            accentColor="#D97706"
            accentBg="rgba(217,119,6,0.10)"
          />
          <StatCard
            label="Completed Today"
            value={vm.isLoading ? ' - ' : completedToday.length}
            icon={CheckCircle2}
            accentColor="#178A3D"
            accentBg="rgba(5,150,105,0.10)"
          />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden" style={{ background: '#F1F5F9' }}>

        <div className="flex-1 overflow-y-auto px-7 py-5 space-y-6">
          {vm.isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-20 rounded-lg animate-shimmer" />
              ))}
            </div>
          ) : !hasAny ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div
                className="w-16 h-16 rounded-lg flex items-center justify-center mb-4"
                style={{ background: 'var(--clinical-100)' }}
              >
                <ClipboardList className="w-8 h-8" style={{ color: 'var(--clinical-600)' }} />
              </div>
              <p className="text-h3 mb-1" style={{ color: 'var(--text-primary)' }}>No active prescriptions</p>
              <p className="text-body-sm mb-6" style={{ color: 'var(--text-muted)' }}>
                Start by creating a new prescription for a patient.
              </p>
              <button
                onClick={() => navigate('/consultation')}
                className="flex items-center gap-2 px-5 py-2.5 text-body-sm font-semibold text-white rounded-lg hover:opacity-90 transition-opacity"
                style={{ background: 'var(--clinical-600)' }}
              >
                <Stethoscope className="w-4 h-4" />
                Enter Consultation Room
              </button>
            </div>
          ) : (
            <>
              <SectionBlock
                title="Flagged"
                icon={AlertTriangle}
                accentColor="#DC2626"
                accentBg="rgba(220,38,38,0.10)"
                prescriptions={flagged}
                onCardClick={goToRx}
              />
              <SectionBlock
                title="In Pipeline"
                icon={Clock}
                accentColor="#D97706"
                accentBg="rgba(217,119,6,0.10)"
                prescriptions={pipeline}
                onCardClick={goToRx}
              />
              <SectionBlock
                title="Completed Today"
                icon={CheckCircle2}
                accentColor="#178A3D"
                accentBg="rgba(5,150,105,0.10)"
                prescriptions={completedToday}
                onCardClick={goToRx}
              />
            </>
          )}
        </div>

        <div
          className="w-56 flex-shrink-0 flex flex-col border-l overflow-y-auto"
          style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}
        >
          <div className="px-4 pt-5 pb-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
            <p className="text-caption font-bold mb-3 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Quick Actions
            </p>
            <div className="space-y-2">
              <button
                onClick={() => navigate('/consultation')}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-body-sm font-semibold text-white rounded-lg hover:opacity-90 transition-opacity"
                style={{ background: 'var(--clinical-600)' }}
              >
                <Stethoscope className="w-4 h-4" />
                Consultation Room
              </button>
              <button
                onClick={() => navigate('/prescriptions')}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-body-sm font-semibold rounded-lg border hover:bg-[var(--bg-base)] transition-colors"
                style={{ color: 'var(--text-primary)', borderColor: 'var(--border-default)' }}
              >
                <ClipboardList className="w-4 h-4" />
                View All
              </button>
            </div>
          </div>

          <div className="px-4 py-4 flex-1" style={{ borderBottom: '1px solid var(--border-default)' }}>
            <p className="text-caption font-bold mb-3 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Summary
            </p>
            <div className="space-y-2">
              {[
                { label: 'Flagged',        count: flagged.length,          color: '#DC2626', bg: '#FEF2F2' },
                { label: 'In Pipeline',    count: pipeline.length,         color: '#D97706', bg: '#FFFBEB' },
                { label: 'Done Today',     count: completedToday.length,   color: '#178A3D', bg: '#F0FDF4' },
                { label: 'Total Loaded',   count: vm.prescriptions.length, color: '#475569', bg: '#F8FAFC' },
              ].map(({ label, count, color, bg }) => (
                <div
                  key={label}
                  className="flex items-center justify-between px-3 py-2 rounded-lg"
                  style={{ background: bg }}
                >
                  <span className="text-body-sm" style={{ color: 'var(--text-secondary)' }}>{label}</span>
                  <span className="text-body-sm font-bold tabular-nums" style={{ color }}>{count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="px-4 py-4" style={{ background: 'var(--clinical-50)' }}>
            <div className="flex items-center gap-1.5 mb-2">
              <Keyboard className="w-3 h-3" style={{ color: 'var(--clinical-600)' }} />
              <p className="text-caption font-bold uppercase tracking-wider" style={{ color: 'var(--clinical-700)' }}>Tips</p>
            </div>
            <p className="text-caption leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Prescriptions are written inside the Consultation Room  -  select a waiting patient to begin.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
