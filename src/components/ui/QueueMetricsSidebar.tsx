import { Clock, TrendingUp, Users } from 'lucide-react';
import { cn } from '../../lib/utils';

interface QueueMetrics {
  avgVerificationWait: number;
  longestWait: number;
  verificationCount: number;
  dispensingCount: number;
}

interface QueueMetricsSidebarProps {
  metrics: QueueMetrics;
  className?: string;
}

function MetricItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-surface-3">
      <div className="flex items-center gap-2">
        <span className="text-text-muted">{icon}</span>
        <span className="text-sm text-text-secondary">{label}</span>
      </div>
      <span className="text-sm font-semibold text-text-primary">{value}</span>
    </div>
  );
}

export function QueueMetricsSidebar({ metrics, className }: QueueMetricsSidebarProps) {
  return (
    <div className={cn('w-72 bg-surface-1 p-4 space-y-4', className)}>
      <h3 className="text-h3 font-semibold text-text-primary">Queue Metrics</h3>
      <div className="space-y-3">
        <MetricItem
          icon={<Clock className="w-4 h-4" />}
          label="Avg verification wait"
          value={`${metrics.avgVerificationWait} min`}
        />
        <MetricItem
          icon={<TrendingUp className="w-4 h-4" />}
          label="Longest wait"
          value={`${metrics.longestWait} min`}
        />
        <MetricItem
          icon={<Users className="w-4 h-4" />}
          label="In verification"
          value={metrics.verificationCount}
        />
        <MetricItem
          icon={<Users className="w-4 h-4" />}
          label="In dispensing"
          value={metrics.dispensingCount}
        />
      </div>
    </div>
  );
}
