import apiClient from './apiClient';
import type { PaginatedResponse } from '../models/types';

export interface Department {
  id: string;
  name: string;
  code: string;
  type: string;
  floor: string;
  wing?: string;
  description?: string;
  accepts_emergency: boolean;
  is_active: boolean;
  head_user_id?: string;
  sub_areas?: Array<{name: string; code?: string; description?: string}>;
  bed_count?: number;
  created_at: string;
  updated_at?: string;
}

export interface CreateDepartmentPayload {
  name: string;
  code: string;
  type: string;
  floor: string;
  wing?: string;
  description?: string;
  accepts_emergency?: boolean;
  is_active?: boolean;
  sub_areas?: Array<{name: string; code?: string; description?: string}>;
  bed_count?: number;
  head_user_id?: string;
}

export interface UpdateDepartmentPayload {
  name?: string;
  description?: string;
  floor?: string;
  wing?: string;
  head_user_id?: string;
  accepts_emergency?: boolean;
  is_active?: boolean;
  sub_areas?: Array<{name: string; code?: string; description?: string}>;
  bed_count?: number;
}

export const departmentsApi = {
  list: (filters = {}) => 
    apiClient.get<PaginatedResponse<Department>>('/departments', { params: filters }),

  getById: (id: string) =>
    apiClient.get<Department>(`/departments/${id}`),

  create: (data: CreateDepartmentPayload) =>
    apiClient.post<Department>('/departments', data),

  update: (id: string, data: UpdateDepartmentPayload) =>
    apiClient.patch<Department>(`/departments/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/departments/${id}`),
};

