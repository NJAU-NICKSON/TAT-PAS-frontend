import { useState } from 'react';
import { ChevronRight, X } from 'lucide-react';
import { BottleneckData } from '../../api/analytics';

interface BottleneckPanelProps {
  data: BottleneckData;
}

interface StageInfo {
  key: keyof BottleneckData;
  name: string;
  shortName: string;
}

const STAGES: StageInfo[] = [
  { key: 'verification_queue',  name: 'Submit -> Verify',        shortName: 'Verification' },
  { key: 'dispensing_queue',    name: 'Verify -> Dispense',      shortName: 'Dispensing' },
  { key: 'administration_queue', name: 'Dispense -> Administer', shortName: 'Administration' },
];

function formatMin(min: number): string {
  if (min == null || isNaN(min)) return ' - ';
  if (min < 1) return '<1m';
  if (min < 60) return `${min.toFixed(0)}m`;
  return `${(min / 60).toFixed(1)}h`;
}

interface DrillDownProps {
  stageName: string;
  count: number;
  avg: number;
  p95: number;
  onClose: () => void;
}

function DrillDown({ stageName, count, avg, p95, onClose }: DrillDownProps) {
  return (
    <div
      className="absolute inset-0 flex flex-col animate-fade-in"
      style={{ background: 'var(--bg-card)', zIndex: 5, borderRadius: 'var(--radius-card)' }}
    >
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-default)]">
        <h4 className="text-body-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {stageName}  -  Stage Detail
        </h4>
        <button onClick={onClose} className="p-1 rounded hover:bg-[var(--bg-base)]" style={{ color: 'var(--text-muted)' }}>
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 p-5 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Queue Depth', value: String(count), sub: 'prescriptions waiting' },
            { label: 'Average Wait', value: formatMin(avg), sub: 'per prescription' },
            { label: 'P95 Wait', value: formatMin(p95), sub: '95th percentile' },
          ].map(({ label, value, sub }) => (
            <div
              key={label}
              className="p-3 rounded-xl border"
              style={{ background: 'var(--bg-base)', borderColor: 'var(--border-default)' }}
            >
              <p className="text-label" style={{ color: 'var(--text-secondary)' }}>{label}</p>
              <p className="text-time-card mt-1" style={{ color: 'var(--text-primary)' }}>{value}</p>
              <p className="text-meta mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</p>
            </div>
          ))}
        </div>
        <p className="text-body-sm" style={{ color: 'var(--text-secondary)' }}>
          This stage currently has <strong>{count}</strong> prescription{count !== 1 ? 's' : ''} in queue.
          The average wait time is <strong>{formatMin(avg)}</strong>, with 95% of prescriptions processed within{' '}
          <strong>{formatMin(p95)}</strong>.
        </p>
        {avg > 60 && (
          <div
            className="p-3 rounded-lg border text-body-sm font-medium"
            style={{
              background: 'var(--bg-alert)',
              borderColor: 'var(--border-breach)',
              color: 'var(--sla-breached)',
            }}
          >
            Average wait exceeds 1 hour  -  this stage is a bottleneck.
          </div>
        )}
      </div>
    </div>
  );
}

export function BottleneckPanel({ data }: BottleneckPanelProps) {
  const [drillStage, setDrillStage] = useState<string | null>(null);

  const stagesWithData = STAGES.map(s => ({
    ...s,
    avg: (data[s.key] as { avg: number }).avg ?? 0,
    p95: (data[s.key] as { p95: number }).p95 ?? 0,
    count: (data[s.key] as { count: number }).count ?? 0,
  }));

  const maxAvg = Math.max(...stagesWithData.map(s => s.avg), 1);
  const worstStage = [...stagesWithData].sort((a, b) => b.avg - a.avg)[0];

  const drillData = drillStage ? stagesWithData.find(s => s.name === drillStage) : null;

  return (
    <div className="relative h-full overflow-hidden">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-h3" style={{ color: 'var(--text-primary)' }}>Bottleneck Analysis</h3>
        {worstStage && worstStage.avg > 0 && (
          <span className="text-body-sm font-semibold" style={{ color: 'var(--sla-breached)' }}>
            Worst: {worstStage.shortName} ({formatMin(worstStage.avg)} avg)
          </span>
        )}
      </div>

      <div className="space-y-4">
        {stagesWithData.map(stage => {
          const avgPct = maxAvg > 0 ? (stage.avg / maxAvg) * 100 : 0;
          const p95Pct = maxAvg > 0 ? (stage.p95 / maxAvg) * 100 : 0;
          const isWorst = stage.name === worstStage?.name && stage.avg > 0;

          return (
            <div key={stage.name}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-body-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {stage.name}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-body-sm font-bold" style={{ color: isWorst ? 'var(--sla-breached)' : 'var(--text-primary)' }}>
                    {formatMin(stage.avg)}
                  </span>
                  <span className="text-meta" style={{ color: 'var(--text-muted)' }}>
                    p95: {formatMin(stage.p95)}
                  </span>
                  <button
                    onClick={() => setDrillStage(stage.name)}
                    className="flex items-center gap-0.5 text-meta font-semibold hover:underline"
                    style={{ color: 'var(--clinical-600)' }}
                  >
                    Detail
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="relative h-5 rounded-lg overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                <div
                  className="absolute inset-y-0 left-0 rounded-lg"
                  style={{
                    width: `${p95Pct}%`,
                    background: isWorst ? 'rgba(220,38,38,0.15)' : 'rgba(37,99,235,0.12)',
                    transition: 'width 0.5s ease',
                  }}
                />
                <div
                  className="absolute inset-y-0 left-0 rounded-lg flex items-center justify-end pr-2"
                  style={{
                    width: `${avgPct}%`,
                    background: isWorst ? 'var(--sla-breached)' : 'var(--clinical-600)',
                    transition: 'width 0.5s ease',
                    minWidth: stage.avg > 0 ? '32px' : 0,
                  }}
                >
                  {stage.count > 0 && (
                    <span className="text-meta font-bold text-white" style={{ fontSize: '10px' }}>
                      {stage.count}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-4 mt-4">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded" style={{ background: 'var(--clinical-600)' }} />
          <span className="text-meta" style={{ color: 'var(--text-muted)' }}>Average</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded opacity-30" style={{ background: 'var(--clinical-600)' }} />
          <span className="text-meta" style={{ color: 'var(--text-muted)' }}>P95</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-meta font-bold" style={{ color: 'var(--text-muted)' }}>N</span>
          <span className="text-meta" style={{ color: 'var(--text-muted)' }}>Queue count</span>
        </div>
      </div>

      {drillData && (
        <DrillDown
          stageName={drillData.name}
          count={drillData.count}
          avg={drillData.avg}
          p95={drillData.p95}
          onClose={() => setDrillStage(null)}
        />
      )}
    </div>
  );
}
