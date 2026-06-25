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

  verifyPrescriptionIntegrity: (identifier: string) =>
    apiClient.get<PrescriptionIntegrityResult>(`/audits/verify-integrity/${encodeURIComponent(identifier)}`),
};

export interface IntegrityResult {
  intact: boolean;
  total_chained_records: number;
  unchained_records: number;
  first_break_at: string | null;
  issues: { record_id: string; problem: string; detail: string }[];
  checked_at: string;
}

export interface IntegrityTrailRecord {
  id: string;
  type?: string;
  flag_code?: string;
  issue?: string;
  severity?: string;
  recommendation?: string | null;
  created_at?: string | null;
  created_by?: string | null;
  created_by_role?: string;
  drug_name?: string | null;
  dose?: string | null;
  patient_age?: number | null;
  patient_allergies_snapshot?: string[];
  resolved?: boolean;
  resolved_by?: string | null;
  resolved_at?: string | null;
  resolution_type?: string | null;
  resolution_note?: string | null;
  countersigned?: boolean;
  countersigned_by?: string | null;
  countersigned_at?: string | null;
  countersign_note?: string | null;
  esig_required?: boolean;
  is_security_event?: boolean;
  security_event_type?: string | null;
  tat_pharmacy_min_at_flag?: number | null;
  sla_threshold_min?: number | null;
  ip_address?: string | null;
  user_agent?: string | null;
  rx_number?: string | null;
  patient_name?: string | null;
  prev_hash?: string | null;
  record_hash?: string | null;
  recomputed_hash?: string | null;
  verified?: boolean;
  problem?: string | null;
}

export interface PrescriptionIntegrityResult {
  found: boolean;
  identifier: string;
  prescription_id?: string;
  rx_number?: string | null;
  patient_name?: string | null;
  intact: boolean;
  record_count?: number;
  unchained_records?: number;
  issues?: { record_id: string; problem: string; detail: string }[];
  trail?: IntegrityTrailRecord[];
  checked_at: string;
}
