import apiClient from './apiClient';

export type VisitType = "opd" | "ipd" | "emergency" | "day_surgery" | "maternity" | "paediatric" | "nicu";
export type VisitStatus = "registered" | "triaged" | "waiting_for_doctor" | "in_consultation" | "awaiting_results" | "treatment_in_progress" | "admitted" | "in_ward" | "ready_for_discharge" | "discharged" | "cancelled";

export interface VitalSigns {
  blood_pressure_systolic?: number;
  blood_pressure_diastolic?: number;
  temperature_celsius?: number;
  pulse_rate?: number;
  oxygen_saturation?: number;
  weight_kg?: number;
  height_cm?: number;
  respiratory_rate?: number;
  triage_notes?: string;
}

export interface ConsultationNote {
  id?: string;
  visit_id: string;
  patient_id: string;
  doctor_id: string;
  doctor_name?: string;
  consultation_room?: string;
  assisting_nurse_id?: string;
  assisting_nurse_name?: string;
  chief_complaint?: string;
  clinical_findings?: string;
  diagnosis?: string;
  recommendations?: string;
  plan_of_care?: string;
  follow_up_instructions?: string;
  follow_up_date?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Visit {
  id: string;
  patient_id: string;
  visit_type: VisitType;
  department_id: string;
  chief_complaint?: string;
  priority: "routine" | "urgent" | "critical" | "immediate";
  visit_number: string;
  status: VisitStatus;
  assigned_doctor_id?: string;
  assigned_doctor_name?: string;
  triage_nurse_id?: string;
  triage_nurse_name?: string;
  bed_id?: string;
  bed_label?: string;
  ward_name?: string;
  admission_notes?: string;
  prescription_ids: string[];
  vitals?: VitalSigns;
  patient_name?: string;
  registered_by_id?: string;
  registered_by_name?: string;
  consultation_room?: string;
  consultation_nurse_id?: string;
  consultation_nurse_name?: string;
  diagnosis?: string;
  clinical_findings?: string;
  recommendations?: string;
  follow_up_instructions?: string;
  discharge_notes?: string;
  registered_at: string;
  triaged_at?: string;
  consultation_started_at?: string;
  consultation_ended_at?: string;
  admitted_at?: string;
  billing_completed_at?: string;
  discharged_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateVisitPayload {
  patient_id: string;
  visit_type: VisitType;
  department_id: string;
  chief_complaint?: string;
  priority?: "routine" | "urgent" | "critical" | "immediate";
}

export interface UpdateVisitPayload {
  status?: VisitStatus;
  assigned_doctor_id?: string;
  chief_complaint?: string;
  priority?: "routine" | "urgent" | "critical" | "immediate";
  consultation_room?: string;
  consultation_nurse_id?: string;
  diagnosis?: string;
  clinical_findings?: string;
  recommendations?: string;
  follow_up_instructions?: string;
  discharge_notes?: string;
}

export interface ConsultationNotePayload {
  consultation_room?: string;
  assisting_nurse_id?: string;
  clinical_findings?: string;
  diagnosis?: string;
  recommendations?: string;
  plan_of_care?: string;
  follow_up_instructions?: string;
  follow_up_date?: string;
}

export interface TriagePayload {
  vitals: VitalSigns;
  assigned_doctor_id?: string;
  consultation_room?: string;
}

export interface AdmitPayload {
  bed_id: string;
  notes?: string;
  assigned_doctor_id?: string;
}

export interface JourneyStageSummary {
  stage: number;
  name: string;
  role: string;
  started_at?: string;
  completed_at?: string;
  target_min: number;
  tat_min?: number;
}

export interface JourneySummary {
  visit_id: string;
  visit_number: string;
  patient_id: string;
  current_status: VisitStatus;
  bed_id?: string;
  stages: JourneyStageSummary[];
  total_tat_min?: number;
  target_total_min: number;
  is_complete: boolean;
}

export const visitsApi = {
  list: (filters = {}) =>
    apiClient.get<Visit[]>('/visits', { params: filters }),

  getById: (id: string) =>
    apiClient.get<Visit>(`/visits/${id}`),

  create: (data: CreateVisitPayload) =>
    apiClient.post<Visit>('/visits', data),

  update: (id: string, data: UpdateVisitPayload) =>
    apiClient.patch<Visit>(`/visits/${id}`, data),

  triage: (id: string, data: TriagePayload) =>
    apiClient.post<Visit>(`/visits/${id}/triage`, data),

  admit: (id: string, data: AdmitPayload) =>
    apiClient.post<Visit>(`/visits/${id}/admit`, data),

  discharge: (id: string) =>
    apiClient.post<Visit>(`/visits/${id}/discharge`, {}),

  journey: (id: string) =>
    apiClient.get<JourneySummary>(`/visits/${id}/journey`),

  delete: (id: string) =>
    apiClient.delete(`/visits/${id}`),

  addConsultationNote: (id: string, data: ConsultationNotePayload) =>
    apiClient.post<ConsultationNote>(`/visits/${id}/consultation-note`, data),

  getConsultationNote: (id: string) =>
    apiClient.get<ConsultationNote>(`/visits/${id}/consultation-note`),
};

