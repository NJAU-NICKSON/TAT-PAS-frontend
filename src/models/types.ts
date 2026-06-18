export type UserRole =
  | 'receptionist'
  | 'nurse'
  | 'doctor'
  | 'admin'
  | 'pharmacist'
  | 'billing'
  | 'auditor';

export interface User {
  id: string;
  username: string;
  full_name: string;
  email: string;
  role: UserRole;
  department_id?: string;
  is_active?: boolean;
  created_at: string;
  last_login?: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export interface ContactInfo {
  phone?: string;
  email?: string;
  address?: string;
}

export interface Allergy {
  substance: string;
  reaction_type?: string | null;
  severity: 'mild' | 'moderate' | 'severe';
}

export interface Patient {
  id: string;
  mrn: string;
  first_name: string;
  last_name: string;
  dob?: string;
  gender?: string;
  national_id?: string;
  guardian_national_id?: string;
  guardian_name?: string;
  contact?: ContactInfo;
  created_at: string;
  weight?: number;
  blood_group?: string;
  allergies?: Allergy[];
  chronic_conditions?: string[];
  current_visit_id?: string;
  current_department?: string;
}

export interface MedicationItem {
  name: string;
  dose: string;
  route: string;
  frequency: string;
  duration_days: number;
}

export type PrescriptionStatus =
  | 'draft'
  | 'submitted'
  | 'pending_amendment'
  | 'flagged'
  | 'verified'
  | 'dispensed'
  | 'administered'
  | 'archived';

export type Priority = 'stat' | 'urgent' | 'routine' | 'discharge' | 'nicu' | 'chemo';
export type OrderSource = 'opd' | 'ipd' | 'emergency' | 'theatre' | 'maternity' | 'paediatric' | 'nicu' | 'discharge';

export interface Prescription {
  id: string;
  rx_number?: string;
  patient_id: string;
  doctor_id: string;
  medications: MedicationItem[];
  status: PrescriptionStatus;
  priority?: Priority;
  is_stat?: boolean;
  is_urgent?: boolean;
  ordered_at?: string;
  submitted_at?: string;
  verified_at?: string;
  dispensed_at?: string;
  administered_at?: string;
  flags: string[];
  notes?: string;
  pharmacist_comment?: string;
  created_at: string;
  updated_at: string;
  patient?: Patient;
  patient_name?: string;
  doctor_name?: string;
  department?: string;
  ward_location?: string;
  tat_order_to_submit_min?: number;
  tat_submit_to_verify_min?: number;
  tat_flag_hold_min?: number;
  tat_verify_to_dispense_min?: number;
  tat_dispense_to_admin_min?: number;
  tat_pharmacy_min?: number;
  tat_total_min?: number;
  sla_threshold_min?: number;
  sla_breached?: boolean;
  sla_breach_duration_min?: number;
  tat_breached_at?: string;
  auditor_id?: string;
  auditor_name?: string;
  auditor_approved_at?: string;
  returned_at?: string;
  return_reason?: string;
  dispensed_by_id?: string;
  dispensed_by_name?: string;
  administered_by_id?: string;
  administered_by_name?: string;
  administered_dose?: string;
  administered_route?: string;
  administration_notes?: string;
  receipt_number?: string;
}

export type AuditSeverity = 'low' | 'medium' | 'high' | 'critical';
export type AuditType = 'automated' | 'manual' | 'sla_breach' | 'sla_warning';
export type SecurityEventType = 'login_failure' | 'role_change' | 'password_reset' | 'sla_breach' | 'permission_change';

export type FlagCode = 
  | 'high_dose'
  | 'extended_duration'
  | 'allergy_match'
  | 'drug_interaction'
  | 'controlled_sub'
  | 'sla_breach'
  | 'duplicate_rx';

export interface AuditRecord {
  id: string;
  prescription_id: string;
  visit_id?: string;
  department_id?: string;
  patient_id?: string;
  flag_code?: FlagCode;
  drug_name?: string;
  dose?: string;
  patient_age?: number;
  patient_allergies_snapshot?: string[];
  tat_pharmacy_min_at_flag?: number;
  sla_threshold_min?: number;
  created_by: string;
  created_by_role: string;
  type: AuditType;
  issue: string;
  severity: AuditSeverity;
  recommendation?: string;
  resolved: boolean;
  resolved_by?: string;
  resolved_at?: string;
  resolution_type?: string;
  resolution_note?: string;
  esig_required?: boolean;
  esig_confirmed_by?: string;
  esig_confirmed_at?: string;
  countersigned?: boolean;
  countersigned_by?: string;
  countersigned_at?: string;
  countersign_note?: string;
  original_flag_id?: string;
  before_snapshot?: Record<string, unknown> | null;
  after_snapshot?: Record<string, unknown> | null;
  ip_address?: string;
  user_agent?: string;
  is_security_event: boolean;
  security_event_type?: SecurityEventType;
  reviewed_at?: string;
  reviewed_by?: string;
  created_at: string;
  rx_number?: string;
  patient_name?: string;
}

export interface TATMetrics {
  total_prescriptions: number;
  completed_prescriptions: number;
  average_total_tat_minutes: number;
  average_order_to_verify_minutes: number;
  average_verify_to_dispense_minutes: number;
  average_dispense_to_administer_minutes: number;
  flagged_count: number;
  resolved_flags_count: number;
  resolution_rate: number;
  slowest_prescriptions: Array<{
    id: string;
    patient_id: string;
    patient_name?: string;
    rx_number?: string;
    total_tat_minutes: number;
    ordered_at: string;
  }>;
}

export interface PaginatedResponse<T> {
  items: T[];
  total?: number;
}

export interface ApiError {
  detail: string;
  code?: string;
  status?: number;
  data?: Record<string, unknown>;
}

export type BillCategory =
  | 'consultation'
  | 'lab'
  | 'radiology'
  | 'pharmacy'
  | 'ward'
  | 'procedure'
  | 'other';

export interface BillLineItem {
  category: BillCategory;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  reference_id?: string;
}

export interface Payment {
  amount: number;
  method: 'cash' | 'card' | 'insurance' | 'mobile_money' | 'sha' | 'nhif' | 'mpesa';
  received_at: string;
  reference_number?: string;
  received_by?: string;
  notes?: string;
}

export type BillStatus = 'open' | 'finalized' | 'paid' | 'partially_paid' | 'waived';

export interface Bill {
  _id: string;
  visit_id: string;
  patient_id: string;
  patient_name?: string;
  bill_number?: string;
  visit_number?: string;
  department_id?: string;
  status: BillStatus;
  line_items: BillLineItem[];
  subtotal: number;
  discount_amount: number;
  discount_reason?: string;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  payments: Payment[];
  insurance_details?: Record<string, unknown>;
  created_by?: string;
  created_at: string;
  updated_at?: string;
}
