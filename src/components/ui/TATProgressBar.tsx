import { useMemo } from 'react';
import { cn } from '../../lib/utils';

interface PrescriptionTimestamps {
  ordered_at?: string;
  submitted_at?: string;
  verified_at?: string;
  dispensed_at?: string;
  administered_at?: string;
}

interface TATProgressBarProps {
  timestamps: PrescriptionTimestamps;
  className?: string;
}

const STAGE_LABELS = [
  { label: 'Order', short: 'Order' },
  { label: 'Submit', short: 'Submit' },
  { label: 'Verify', short: 'Verify' },
  { label: 'Dispense', short: 'Dispense' },
  { label: 'Admin', short: 'Admin' },
] as const;

const STAGE_SLA = [5, 10, 30, 20, 15]; // minutes per stage

function calculateStageDuration(timestamps: PrescriptionTimestamps) {
  const times = [
    new Date(timestamps.ordered_at || 0),
    new Date(timestamps.submitted_at || 0),
    new Date(timestamps.verified_at || 0),
    new Date(timestamps.dispensed_at || 0),
    new Date(timestamps.administered_at || 0),
  ].map((date, idx) => ({ date, idx }));

  const now = new Date();

  const durations = times.map((time, idx) => {
    const start = idx === 0 ? new Date(timestamps.ordered_at || 0) : times[idx - 1].date;
    const end = time.date.getTime() === 0 ? now : time.date;
    const minutes = (end.getTime() - start.getTime()) / (1000 * 60);
    return Math.max(0, minutes);
  });

  return durations;
}

function getStageColor(duration: number, sla: number) {
  const ratio = duration / sla;
  if (ratio <= 1) return 'bg-status-success';
  if (ratio <= 1.5) return 'bg-status-warning';
  return 'bg-status-critical';
}

export function TATProgressBar({ timestamps, className }: TATProgressBarProps) {
  const durations = useMemo(() => calculateStageDuration(timestamps), [timestamps]);
  const totalDuration = durations.reduce((sum, d) => sum + d, 0);

  if (totalDuration === 0) {
    return (
      <div className="p-6 text-center">
        <div className="w-16 h-16 border-4 border-status-neutral border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-body-sm text-text-muted">TAT tracking not started</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-3 bg-surface-3 rounded-full overflow-hidden">
            {durations.map((duration, idx) => (
              <div
                key={idx}
                className={cn(
                  'h-full rounded-full transition-all duration-700',
                  getStageColor(duration, STAGE_SLA[idx])
                )}
                style={{ width: `${(duration / totalDuration) * 100}%` }}
                title={`${STAGE_LABELS[idx].label}: ${Math.round(duration)}m`}
              />
            ))}
          </div>
          <span className="text-body font-semibold text-text-primary min-w-[4rem] text-right">
            {Math.round(totalDuration)}m
          </span>
        </div>
        
        <div className="flex gap-4 text-caption font-mono text-text-muted">
          {STAGE_LABELS.map((stage, idx) => (
            <div key={idx} className="flex flex-col items-center gap-0.5 min-w-[4rem]">
              <span className="font-semibold">{stage.short}</span>
              <span>{Math.round(durations[idx])}m</span>
              <span className="text-[10px] opacity-75">{STAGE_SLA[idx]}m SLA</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 text-body-sm">
        <div className={cn(
          'w-3 h-3 rounded-full',
          totalDuration <= STAGE_SLA.reduce((a, b) => a + b, 0) ? 'bg-status-success' : 'bg-status-critical animate-pulse'
        )} />
        <span className="font-medium">
          {totalDuration <= STAGE_SLA.reduce((a, b) => a + b, 0) 
            ? 'On time' 
            : `Over SLA by ${Math.round(totalDuration - STAGE_SLA.reduce((a, b) => a + b, 0))}m`
          }
        </span>
      </div>
    </div>
  );
}

