import apiClient from './apiClient';

export type ConsultationRoomStatus = 'available' | 'occupied' | 'cleaning' | 'reserved';

export interface ConsultationRoom {
  id: string;
  department_id: string;
  room_number: string;
  room_name: string;
  floor?: string;
  status: ConsultationRoomStatus;
  current_doctor_id?: string;
  current_nurse_id?: string;
  current_patient_id?: string;
  department_name?: string;
  current_doctor_name?: string;
  current_nurse_name?: string;
  current_patient_name?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface CreateConsultationRoomPayload {
  department_id: string;
  room_number: string;
  room_name: string;
  floor?: string;
  status?: ConsultationRoomStatus;
  current_doctor_id?: string;
  current_patient_id?: string;
  notes?: string;
}

export interface UpdateConsultationRoomPayload {
  status?: ConsultationRoomStatus;
  current_doctor_id?: string;
  current_nurse_id?: string;
  current_patient_id?: string;
  notes?: string;
}

export const consultationRoomsApi = {
  list: (params: { department_id?: string; status?: string } = {}) =>
    apiClient.get<ConsultationRoom[]>('/consultation-rooms', { params }),

  getById: (id: string) =>
    apiClient.get<ConsultationRoom>(`/consultation-rooms/${id}`),

  create: (data: CreateConsultationRoomPayload) =>
    apiClient.post<ConsultationRoom>('/consultation-rooms', data),

  update: (id: string, data: UpdateConsultationRoomPayload) =>
    apiClient.patch<ConsultationRoom>(`/consultation-rooms/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/consultation-rooms/${id}`),
};
