import apiClient from './apiClient';
import { User, UserRole, PaginatedResponse } from '../models/types';

export interface CreateUserPayload {
  username: string;
  full_name: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface UpdateUserPayload {
  full_name?: string;
  email?: string;
  password?: string;
  role?: UserRole;
}

export const usersApi = {
  list: (skip = 0, limit = 50, role?: UserRole) =>
    apiClient.get<PaginatedResponse<User>>('/users/', {
      params: { skip, limit, ...(role ? { role } : {}) },
    }),

  listDoctors: () =>
    apiClient.get<PaginatedResponse<User>>('/users/', { params: { role: 'doctor', limit: 100 } }),

  listNurses: () =>
    apiClient.get<PaginatedResponse<User>>('/users/', { params: { role: 'nurse', limit: 100 } }),

  getById: (id: string) =>
    apiClient.get<User>(`/users/${id}`),

  create: (data: CreateUserPayload) =>
    apiClient.post<User>('/users/', data),

  update: (id: string, data: UpdateUserPayload) =>
    apiClient.patch<User>(`/users/${id}`, data),

  resetPassword: (id: string, password: string) =>
    apiClient.patch<User>(`/users/${id}`, { password }),

  deactivate: (id: string) =>
    apiClient.delete<User>(`/users/${id}`),

  reactivate: (id: string) =>
    apiClient.post<User>(`/users/${id}/reactivate`),
};
