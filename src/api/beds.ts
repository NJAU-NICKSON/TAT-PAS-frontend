import apiClient from './apiClient';

export interface Bed {
  id: string;
  department_id: string;
  ward_name: string;
  room_number: string;
  bed_number: string;
  bed_label: string;
  bed_type: "general" | "icu" | "hdu" | "nicu" | "isolation" | "maternity" | "birthing" | "paediatric" | "day_case";
  status: "available" | "occupied" | "reserved" | "cleaning" | "maintenance";
  notes?: string;
  current_patient_id?: string;
  current_admission_id?: string;
  last_cleaned_at?: string;
  created_at: string;
  updated_at?: string;
}

export interface CreateBedPayload {
  department_id: string;
  ward_name: string;
  room_number: string;
  bed_number: string;
  bed_label: string;
  bed_type?: "general" | "icu" | "hdu" | "nicu" | "isolation" | "maternity" | "birthing" | "paediatric" | "day_case";
  status?: "available" | "occupied" | "reserved" | "cleaning" | "maintenance";
  notes?: string;
  current_patient_id?: string;
  current_admission_id?: string;
}

export interface UpdateBedPayload {
  status?: "available" | "occupied" | "reserved" | "cleaning" | "maintenance";
  current_patient_id?: string;
  current_admission_id?: string;
  notes?: string;
  last_cleaned_at?: string;
}

export interface BedAvailabilitySummary {
  department_id: string;
  department_name: string;
  department_code: string;
  total: number;
  available: number;
  occupied: number;
  reserved: number;
  cleaning: number;
  maintenance: number;
}

export const bedsApi = {
  list: (filters = {}) =>
    apiClient.get<Bed[]>('/beds', { params: filters }),

  availabilitySummary: () =>
    apiClient.get<BedAvailabilitySummary[]>('/beds/availability-summary'),

  getById: (id: string) =>
    apiClient.get<Bed>(`/beds/${id}`),

  create: (data: CreateBedPayload) =>
    apiClient.post<Bed>('/beds', data),

  update: (id: string, data: UpdateBedPayload) =>
    apiClient.patch<Bed>(`/beds/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/beds/${id}`),
};

