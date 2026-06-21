import apiClient from './apiClient';

export interface ActivityEntry {
  id: string;
  action: string;
  user_id?: string;
  user_role?: string;
  user_name?: string;
  entity_type?: string;
  entity_id?: string;
  detail?: string;
  ip_address?: string;
  created_at: string;
}

export const activityApi = {
  list: (params: { action?: string; user_role?: string; skip?: number; limit?: number } = {}) =>
    apiClient.get<ActivityEntry[]>('/activity', { params }),

  log: (action: string, opts: { detail?: string; entity_type?: string; entity_id?: string } = {}) =>
    apiClient.post('/activity/log', { action, ...opts }).catch(() => {}),
};
