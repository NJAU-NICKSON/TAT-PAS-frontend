import axios, { AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { ApiError } from '../models/types';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('access_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let _isRefreshing = false;
let _refreshSubscribers: Array<(token: string) => void> = [];

function _onRefreshed(token: string) {
  _refreshSubscribers.forEach((cb) => cb(token));
  _refreshSubscribers = [];
}

function _clearSession() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
  window.location.href = '/login';
}

apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError<{ detail?: string; code?: string }>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    const reqUrl = originalRequest?.url ?? '';
    const isAuthEndpoint = reqUrl.includes('/auth/login') || reqUrl.includes('/auth/refresh');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      const refreshToken = localStorage.getItem('refresh_token');

      if (!refreshToken) {
        _clearSession();
        return Promise.reject(error);
      }

      if (_isRefreshing) {
        return new Promise((resolve) => {
          _refreshSubscribers.push((newToken: string) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
            }
            resolve(apiClient(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      _isRefreshing = true;

      try {
        const resp = await axios.post(
          `${BASE_URL}/auth/refresh`,
          {},
          { headers: { Authorization: `Bearer ${refreshToken}` } }
        );
        const { access_token, refresh_token: newRefresh } = resp.data;
        localStorage.setItem('access_token', access_token);
        if (newRefresh) localStorage.setItem('refresh_token', newRefresh);

        _onRefreshed(access_token);
        _isRefreshing = false;

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
        }
        return apiClient(originalRequest);
      } catch {
        _isRefreshing = false;
        _refreshSubscribers = [];
        _clearSession();
        return Promise.reject(error);
      }
    }

    const rawDetail = error.response?.data?.detail;
    let detail: string;
    if (Array.isArray(rawDetail)) {
      detail = rawDetail.map((e: { msg?: string }) => e.msg || JSON.stringify(e)).join('; ');
    } else if (rawDetail && typeof rawDetail === 'object') {
      detail = (rawDetail as { message?: string }).message || 'An unexpected error occurred';
    } else {
      detail = rawDetail || error.message || 'An unexpected error occurred';
    }

    const apiError: ApiError = {
      detail,
      code: error.response?.data?.code ?? (rawDetail && typeof rawDetail === 'object' ? (rawDetail as { code?: string }).code : undefined),
      status: error.response?.status,
      data: rawDetail && typeof rawDetail === 'object' ? rawDetail : undefined,
    };

    return Promise.reject(apiError);
  }
);

export default apiClient;
