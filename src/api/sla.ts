import apiClient from './apiClient';

export interface SLAConfigEntry {
  priority: string;
  threshold_min: number;
  warning_min: number;
  updated_at?: string | null;
}

export interface DoseLimitEntry {
  drug: string;
  adult_max_single_mg: number;
  max_mg_per_kg_day: number;
  abs_max_mg_day: number;
}

export const slaApi = {
  getConfig: () =>
    apiClient.get<SLAConfigEntry[]>('/sla/config'),

  updateConfig: (priority: string, threshold_min: number) =>
    apiClient.put<SLAConfigEntry>('/sla/config', { priority, threshold_min }),

  getDoseLimits: () =>
    apiClient.get<DoseLimitEntry[]>('/sla/dose-limits'),

  updateDoseLimit: (entry: DoseLimitEntry) =>
    apiClient.put<DoseLimitEntry>('/sla/dose-limits', entry),
};
