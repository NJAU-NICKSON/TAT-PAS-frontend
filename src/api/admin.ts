import apiClient from './apiClient';

export interface SystemHealth {
  status: 'ok' | 'degraded' | string;
  timestamp: string;
  version: string;
  uptime_seconds: number;
  started_at: string;
  database: 'ok' | 'error' | string;
  database_latency_ms: number | null;
  database_name: string;
  collection_counts: Record<string, number | null>;
  scheduler: 'ok' | 'stopped' | string;
  modules: Record<string, number>;
  unexpected_routes_count: number;
}

export const adminApi = {
  health: () => apiClient.get<SystemHealth>('/admin/health'),
};
