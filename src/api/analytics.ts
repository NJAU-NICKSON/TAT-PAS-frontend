import apiClient from './apiClient';
import { TATMetrics } from '../models/types';

export interface BottleneckData {
  verification_queue: { avg: number; p95: number; count: number };
  dispensing_queue: { avg: number; p95: number; count: number };
  administration_queue: { avg: number; p95: number; count: number };
  total_pharmacy_tat: { avg: number; p95: number; count: number };
}

export interface TATHistoryEntry {
  date: string;
  avg_total_tat_minutes: number;
  avg_order_to_verify_minutes: number;
  avg_verify_to_dispense_minutes: number;
  total_prescriptions: number;
  resolution_rate: number;
}

export interface SLABreach {
  prescription_id: string;
  rx_number?: string;
  patient_id: string;
  priority: string;
  status: string;
  submitted_at: string | null;
  elapsed_min: number;
  threshold_min: number;
  breach_duration_min: number;
  department_id: string | null;
}

export interface LiveBreachResponse {
  breach_count: number;
  oldest_breach_at: string | null;
  breaches: SLABreach[];
}

export const analyticsApi = {
  getTATMetrics: (date_from?: string, date_to?: string) =>
    apiClient.get<TATMetrics>('/analytics/tat', {
      params: {
        ...(date_from ? { date_from } : {}),
        ...(date_to ? { date_to } : {}),
      },
    }),

  getLiveTAT: () =>
    apiClient.get<TATMetrics>('/analytics/tat/live'),

  getTATHistory: (days = 30) =>
    apiClient.get<TATHistoryEntry[]>('/analytics/tat/history', { params: { days } }),

  getBottlenecks: (date_from?: string, date_to?: string) =>
    apiClient.get<BottleneckData>('/analytics/bottlenecks', {
      params: {
        ...(date_from ? { date_from } : {}),
        ...(date_to ? { date_to } : {}),
      },
    }),

  getPerformance: (role: 'doctor' | 'pharmacist', date_from?: string, date_to?: string) =>
    apiClient.get<unknown[]>('/analytics/performance', {
      params: {
        role,
        ...(date_from ? { date_from } : {}),
        ...(date_to ? { date_to } : {}),
      },
    }),

  getLiveBreaches: () =>
    apiClient.get<LiveBreachResponse>('/sla/breaches/live'),

  exportCSV: (date_from?: string, date_to?: string) =>
    apiClient.get('/analytics/export', {
      params: {
        ...(date_from ? { date_from } : {}),
        ...(date_to ? { date_to } : {}),
      },
      responseType: 'blob',
    }),
};
