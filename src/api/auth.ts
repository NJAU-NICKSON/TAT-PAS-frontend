import apiClient from './apiClient';
import { AuthTokens } from '../models/types';

export const authApi = {
  login: (username: string, password: string) => {
    const form = new URLSearchParams();
    form.append('username', username);
    form.append('password', password);
    return apiClient.post<AuthTokens>('/auth/login', form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  },
  refresh: (refreshToken: string) =>
    apiClient.post<AuthTokens>('/auth/refresh', {}, {
      headers: { Authorization: `Bearer ${refreshToken}` },
    }),
  logout: () => apiClient.post('/auth/logout'),
};