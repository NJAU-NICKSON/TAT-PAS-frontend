import apiClient from './apiClient';
import { Patient, PaginatedResponse, ContactInfo } from '../models/types';

export interface CreatePatientPayload {
  first_name: string;
  last_name: string;
  dob?: string;
  gender?: string;
  contact?: ContactInfo;
}

export interface UpdatePatientPayload {
  first_name?: string;
  last_name?: string;
  dob?: string;
  gender?: string;
  contact?: ContactInfo;
}

export interface PatientSearchResult {
  patients: Patient[];
  total: number;
  page: number;
  page_size: number;
}

export const patientsApi = {
  search: (query: string, skip = 0, limit = 20) =>
    apiClient.get<PatientSearchResult>('/patients', {
      params: { q: query, skip, limit },
    }),

  getById: (id: string) =>
    apiClient.get<Patient>(`/patients/${id}`),

  create: (data: CreatePatientPayload) =>
    apiClient.post<Patient>('/patients', data),

  update: (id: string, data: UpdatePatientPayload) =>
    apiClient.patch<Patient>(`/patients/${id}`, data),
};