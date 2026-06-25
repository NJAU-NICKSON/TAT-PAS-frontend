import { useState, useCallback } from 'react';
import { TATMetrics, ApiError } from '../models/types';
import { analyticsApi, BottleneckData } from '../api/analytics';

interface DateRange {
  from: string;
  to: string;
}

// Convert the picked from/to dates into inclusive datetime bounds; an empty "to" means the single "from" day only.
function resolveBounds(range: DateRange): { from?: string; to?: string } {
  if (!range.from && !range.to) return {};
  const startDay = range.from || range.to;
  const endDay = range.to || range.from;
  return {
    from: startDay ? `${startDay}T00:00:00` : undefined,
    to: endDay ? `${endDay}T23:59:59.999` : undefined,
  };
}

interface AnalyticsViewModel {
  metrics: TATMetrics | null;
  bottlenecks: BottleneckData | null;
  isLoading: boolean;
  error: string | null;
  dateRange: DateRange;
  loadMetrics: () => Promise<void>;
  setDateRange: (from: string, to: string) => void;
  exportCSV: () => Promise<void>;
  clearError: () => void;
}

export function useAnalyticsViewModel(): AnalyticsViewModel {
  const [metrics, setMetrics] = useState<TATMetrics | null>(null);
  const [bottlenecks, setBottlenecks] = useState<BottleneckData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRangeState] = useState<DateRange>({
    from: '',
    to: '',
  });

  const loadMetrics = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const bounds = resolveBounds(dateRange);
      const [metricsRes, bottlenecksRes] = await Promise.allSettled([
        analyticsApi.getTATMetrics(bounds.from, bounds.to),
        analyticsApi.getBottlenecks(bounds.from, bounds.to),
      ]);
      if (metricsRes.status === 'fulfilled') setMetrics(metricsRes.value.data);
      else {
        const apiErr = metricsRes.reason as ApiError;
        setError(apiErr?.detail || 'Failed to load analytics.');
      }
      if (bottlenecksRes.status === 'fulfilled') setBottlenecks(bottlenecksRes.value.data);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange]);

  const setDateRange = useCallback((from: string, to: string) => {
    setDateRangeState({ from, to });
  }, []);

  const exportCSV = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const bounds = resolveBounds(dateRange);
      const res = await analyticsApi.exportCSV(bounds.from, bounds.to);
      const blob = res.data as Blob;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tat-report-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr?.detail || 'Failed to export CSV.');
    } finally {
      setIsLoading(false);
    }
  }, [dateRange]);

  const clearError = useCallback(() => setError(null), []);

  return {
    metrics,
    bottlenecks,
    isLoading,
    error,
    dateRange,
    loadMetrics,
    setDateRange,
    exportCSV,
    clearError,
  };
}
