import { useEffect, useState, useCallback } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '../../lib/utils';

interface TATTimerProps {
  startTime: string | Date;
  slaThresholdMin: number;
  mode?: 'elapsed' | 'countdown';
  size?: 'sm' | 'md' | 'lg';
  showProgressBar?: boolean;
  className?: string;
}

function formatDuration(totalMinutes: number): string {
  if (totalMinutes < 0) return '0m';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function TATTimer({
  startTime,
  slaThresholdMin,
  size = 'md',
  showProgressBar = false,
  className,
}: TATTimerProps) {
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const [isBreached, setIsBreached] = useState(false);

  const updateTimer = useCallback(() => {
    const startDate = new Date(startTime);
    const now = new Date();
    const elapsedMs = now.getTime() - startDate.getTime();
    const elapsedMin = elapsedMs / (1000 * 60);
    setElapsedMinutes(elapsedMin);
    
    if (elapsedMin > slaThresholdMin) {
      setIsBreached(true);
    }
  }, [slaThresholdMin, startTime]);

  useEffect(() => {
    const interval = setInterval(updateTimer, 1000);
    updateTimer();
    return () => clearInterval(interval);
  }, [updateTimer]);

  const percentage = Math.min((elapsedMinutes / slaThresholdMin) * 100, 100);
  const remainingMin = Math.max(0, slaThresholdMin - elapsedMinutes);

  const baseClasses = cn(
    'inline-flex items-center gap-2 font-mono font-semibold rounded-full px-3 py-1 border transition-all duration-300',
    {
      'sm': 'text-caption px-2 py-0.5',
      'md': 'text-body-sm px-3 py-1',
      'lg': 'text-body px-4 py-1.5',
    }[size],
    className,
  );

  let statusClasses = 'border-status-info bg-status-info text-status-info-text';
  let prefix = '';
  let suffix = '';

  if (isBreached || percentage > 100) {
    statusClasses = 'border-status-critical bg-status-critical text-status-critical-text animate-pulse shadow-sm shadow-status-critical/25';
    prefix = 'BREACHED ';
    suffix = ` +${formatDuration(elapsedMinutes - slaThresholdMin)}`;
  } else if (percentage > 75) {
    statusClasses = 'border-status-warning bg-status-warning text-status-warning-text';
    suffix = ` ${formatDuration(remainingMin)} left`;
  }

  const displayText = prefix + formatDuration(elapsedMinutes) + suffix;

  return (
    <div className={cn(baseClasses, statusClasses)}>
      <Clock className="h-3 w-3 flex-shrink-0" />
      <span>{displayText}</span>
      {showProgressBar && (
        <div className="ml-2 w-16 h-1.5 bg-surface-3 rounded-full overflow-hidden">
          <div 
            className={cn(
              'h-full rounded-full transition-all duration-500',
              percentage <= 75 && 'bg-status-success',
              percentage > 75 && percentage <= 100 && 'bg-status-warning',
              percentage > 100 && 'bg-status-critical'
            )}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

