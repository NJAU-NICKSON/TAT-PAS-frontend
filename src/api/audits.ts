import apiClient from './apiClient';
import { AuditRecord } from '../models/types';

export interface AuditFilters {
  prescription_id?: string;
  resolved?: boolean;
  flag_type?: string;
  severity?: string;
  skip?: number;
  limit?: number;
}

export interface AuditLogFilters {
  prescription_id?: string;
  flag_type?: string;
  severity?: string;
  resolved?: boolean;
  date_from?: string;
  date_to?: string;
  skip?: number;
  limit?: number;
}

export interface FlagCreatePayload {
  prescription_id: string;
  issue: string;
  severity: string;
  recommendation: string;
  flag_code?: string;
  drug_name?: string;
  dose?: string;
}

export interface CountersignPayload {
  flag_id: string;
  note: string;
}

export const auditsApi = {
  list: (filters: AuditFilters = {}) =>
    apiClient.get<AuditRecord[]>('/audits/', { params: filters }),

  unresolved: (params: { skip?: number; limit?: number } = {}) =>
    apiClient.get<AuditRecord[]>('/audits/unresolved', { params }),

  log: (filters: AuditLogFilters = {}) =>
    apiClient.get<AuditRecord[]>('/audits/log', { params: filters }),

  getById: (id: string) =>
    apiClient.get<AuditRecord>(`/audits/${id}`),

  createFlag: (payload: FlagCreatePayload) =>
    apiClient.post<AuditRecord>('/audits/flag', payload),

  resolve: (
    prescription_id: string,
    resolution_note: string,
    resolution_type: string,
    esig_password?: string
  ) =>
    apiClient.post<AuditRecord[]>(`/audits/${prescription_id}/resolve`, {
      resolution_note,
      resolution_type,
      ...(esig_password ? { esig_password } : {}),
    }),

  countersign: (payload: CountersignPayload) =>
    apiClient.post<AuditRecord>('/audits/countersign', payload),

  getSecurityEvents: (date: string) =>
    apiClient.get<AuditRecord[]>('/audits/security/daily', {
      params: { review_date: date },
    }),

  reviewSecurityEvents: (eventIds: string[]) =>
    apiClient.post('/audits/security/review', { event_ids: eventIds }),

  verifyIntegrity: () =>
    apiClient.get<IntegrityResult>('/audits/verify-integrity'),
};

export interface IntegrityResult {
  intact: boolean;
  total_chained_records: number;
  unchained_records: number;
  first_break_at: string | null;
  issues: { record_id: string; problem: string; detail: string }[];
  checked_at: string;
}
