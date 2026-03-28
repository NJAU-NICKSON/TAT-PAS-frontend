import { RadialBarChart, RadialBar, ResponsiveContainer } from 'recharts';
import { cn } from '../../lib/utils';

interface SLAComplianceGaugeProps {
  compliance: number;
  total: number;
  compliant: number;
  trend?: number;
  className?: string;
}

const getGaugeColor = (value: number): string => {
  if (value >= 85) return '#22C55E';
  if (value >= 70) return '#F59E0B';
  return '#EF4444';
};

export function SLAComplianceGauge({
  compliance,
  total,
  compliant,
  trend,
  className,
}: SLAComplianceGaugeProps) {
  const data = [{ name: 'SLA', value: compliance, fill: getGaugeColor(compliance) }];
  const trendIcon = trend && trend > 0 ? ''' : '"';

  return (
    <div className={cn('space-y-4 p-6 bg-surface-0 rounded-xl border shadow-card', className)}>
      <div className="flex items-center justify-center h-48">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart data={data} innerRadius="60%" outerRadius="90%" barSize={30}>
            <RadialBar 
              dataKey="value" 
              cornerRadius={10}
              background 
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute text-center">
          <div className="text-display font-black text-text-primary">
            {Math.round(compliance)}%
          </div>
          <p className="text-caption text-text-muted uppercase tracking-wide">
            Compliance
          </p>
        </div>
      </div>

      <div className="text-center space-y-1">
        <p className="text-body text-text-secondary">
          {compliant} of {total} prescriptions within SLA
        </p>
        {trend !== undefined && (
          <p className="text-caption text-text-muted">
            {trendIcon} {Math.abs(trend)}% {trend > 0 ? 'vs yesterday' : 'improvement'}
          </p>
        )}
      </div>
    </div>
  );
}
