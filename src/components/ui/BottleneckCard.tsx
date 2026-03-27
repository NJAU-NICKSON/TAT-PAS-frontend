import { AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '../../lib/utils';

interface BottleneckCardProps {
  stage: string;
  avgMin: number;
  slaMin: number;
  vsYesterday: number;
  className?: string;
}

export function BottleneckCard({
  stage,
  avgMin,
  slaMin,
  vsYesterday,
  className,
}: BottleneckCardProps) {
  const percentageOver = ((avgMin - slaMin) / slaMin) * 100;
  const isOverSLA = avgMin > slaMin;
  const trendUp = vsYesterday > 0;

  const getRecommendation = () => {
    if (stage.includes('Verify')) return 'Review pharmacist shift patterns during peak hours';
    if (stage.includes('Dispense')) return 'Consider additional verification staff';
    if (stage.includes('Submit')) return 'Doctor training on complete prescription submission';
    return 'Review department workflow for this stage';
  };

  return (
    <div className={cn(
      'relative overflow-hidden rounded-xl p-6 border shadow-elevated bg-gradient-to-br',
      isOverSLA ? 'from-status-warning to-status-warning/50 border-status-warning' : 'from-status-info to-status-info/50 border-status-info',
      className
    )}>
{isOverSLA && (
        <div className="absolute top-4 right-4">
          <AlertTriangle className="h-6 w-6 text-status-warning" />
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-8 w-8 text-status-warning/80 flex-shrink-0" />
          <div>
            <h3 className="text-h2 font-bold bg-gradient-to-r from-text-primary to-text-primary via-text-primary/90 bg-clip-text text-transparent">
              {stage}
            </h3>
            <p className="text-caption uppercase tracking-wide text-text-muted font-semibold">Current Bottleneck</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-caption text-text-muted mb-1 tracking-tight uppercase">Average</p>
            <p className="text-display font-black text-text-primary">
              {Math.round(avgMin)}m
            </p>
          </div>
          <div>
            <p className="text-caption text-text-muted mb-1 tracking-tight uppercase">SLA Target</p>
            <p className="text-h1 font-bold text-status-success">
              {slaMin}m
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 p-3 bg-surface-2 rounded-lg">
          {trendUp ? (
            <TrendingUp className="h-4 w-4 text-status-warning" />
          ) : (
            <TrendingDown className="h-4 w-4 text-status-success" />
          )}
          <p className="text-body font-semibold">
            {trendUp ? '+' : ''}{Math.abs(vsYesterday)}m {trendUp ? 'worse' : 'better'} than yesterday
          </p>
        </div>

        <div className="p-4 bg-status-warning/10 border border-status-warning/20 rounded-lg">
          <p className="text-body-sm text-status-warning-text font-medium">
            {getRecommendation()}
          </p>
        </div>
      </div>
    </div>
  );
}

