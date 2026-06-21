import apiClient from './apiClient';
import {
  Prescription,
  PrescriptionStatus,
  MedicationItem,
  AuditSeverity,
  Priority,
  OrderSource,
} from '../models/types';

export interface PrescriptionFilters {
  status?: PrescriptionStatus;
  patient_id?: string;
  date_from?: string;
  date_to?: string;
  skip?: number;
  limit?: number;
}

export interface CreatePrescriptionPayload {
  patient_id: string;
  medications: MedicationItem[];
  notes?: string;
  priority?: Priority;
  order_source?: OrderSource;
  visit_id?: string;
  department_id?: string;
}

export interface UpdateStatusExtra {
  pharmacist_comment?: string;
  notes?: string;
  return_reason?: string;
  administered_dose?: string;
  administered_route?: string;
  administered_time_actual?: string;
  administration_notes?: string;
  receipt_number?: string;
}

export interface PrescriptionHistoryEntry {
  id: string;
  type: string;
  issue: string;
  severity: string;
  flag_code: string;
  created_by: string;
  created_by_role: string;
  resolved: boolean;
  original_flag_id: string | null;
  created_at: string;
}

export const prescriptionsApi = {
  list: (filters: PrescriptionFilters = {}) =>
    apiClient.get<Prescription[]>('/prescriptions/', { params: filters }),

  queue: (params: { skip?: number; limit?: number } = {}) =>
    apiClient.get<Prescription[]>('/prescriptions/queue', { params }),

  getById: (id: string) =>
    apiClient.get<Prescription>(`/prescriptions/${id}`),

  history: (id: string) =>
    apiClient.get<PrescriptionHistoryEntry[]>(`/prescriptions/${id}/history`),

  create: (data: CreatePrescriptionPayload) =>
    apiClient.post<Prescription>('/prescriptions/', data),

  updateStatus: (
    id: string,
    status: PrescriptionStatus,
    extra?: UpdateStatusExtra
  ) =>
    apiClient.patch<Prescription>(`/prescriptions/${id}/status`, {
      status,
      ...extra,
    }),

  addFlag: (
    id: string,
    issue: string,
    severity: AuditSeverity,
    recommendation: string,
    flag_code?: string
  ) =>
    apiClient.post(`/prescriptions/${id}/flags`, {
      issue,
      severity,
      recommendation,
      flag_code: flag_code || 'manual_flag',
    }),

  approveForPharmacy: (id: string, notes?: string) =>
    apiClient.patch<Prescription>(`/prescriptions/${id}/status`, {
      status: 'verified',
      ...(notes ? { notes } : {}),
    }),

  returnToDoctor: (id: string, reason: string) =>
    apiClient.patch<Prescription>(`/prescriptions/${id}/status`, {
      status: 'pending_amendment',
      return_reason: reason,
    }),

  resubmit: (id: string, opts: { amendment_note?: string; medications?: MedicationItem[] } = {}) =>
    apiClient.patch<Prescription>(`/prescriptions/${id}/status`, {
      status: 'submitted',
      ...(opts.amendment_note ? { amendment_note: opts.amendment_note } : {}),
      ...(opts.medications ? { medications: opts.medications } : {}),
    }),
};
