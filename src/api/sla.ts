import apiClient from './apiClient';

export interface SLAConfigEntry {
  priority: string;
  threshold_min: number;
  warning_min: number;
  updated_at?: string | null;
}

export const slaApi = {
  getConfig: () =>
    apiClient.get<SLAConfigEntry[]>('/sla/config'),

  updateConfig: (priority: string, threshold_min: number) =>
    apiClient.put<SLAConfigEntry>('/sla/config', { priority, threshold_min }),
};
