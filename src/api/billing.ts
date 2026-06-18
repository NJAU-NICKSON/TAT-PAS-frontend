import apiClient from './apiClient';
import { Bill, BillLineItem, Payment, BillStatus } from '../models/types';

export interface BillUpdatePayload {
  line_items?: BillLineItem[];
  status?: BillStatus;
  discount_amount?: number;
  discount_reason?: string;
  tax_amount?: number;
}

export const billingApi = {
  createBill: async (visitId: string, lineItems: BillLineItem[]): Promise<Bill> => {
    const response = await apiClient.post('/bills/', {
      visit_id: visitId,
      line_items: lineItems,
    });
    return response.data as Bill;
  },

  getPendingBills: async (limit = 100): Promise<Bill[]> => {
    const response = await apiClient.get(`/bills?limit=${limit}`);
    const d = response.data;
    if (Array.isArray(d)) return d;
    if (Array.isArray(d?.items)) return d.items;
    return [];
  },

  getAllBills: async (limit = 100): Promise<Bill[]> => {
    const response = await apiClient.get(`/bills?limit=${limit}&all_statuses=true`);
    const d = response.data;
    if (Array.isArray(d)) return d;
    if (Array.isArray(d?.items)) return d.items;
    return [];
  },

  getBillsByVisit: async (visitId: string): Promise<Bill | null> => {
    try {
      const response = await apiClient.get(`/bills/visit/${visitId}`);
      return response.data as Bill;
    } catch {
      return null;
    }
  },

  getBill: async (billId: string): Promise<Bill> => {
    const response = await apiClient.get(`/bills/${billId}`);
    return response.data as Bill;
  },

  updateBill: async (billId: string, payload: BillUpdatePayload): Promise<Bill> => {
    const response = await apiClient.patch(`/bills/${billId}`, payload);
    return response.data as Bill;
  },

  addPayment: async (billId: string, payment: Payment): Promise<Bill> => {
    const response = await apiClient.post(`/bills/${billId}/payments`, payment);
    return response.data as Bill;
  },

  getRevenueSummary: async (startDate: string, endDate: string) => {
    const response = await apiClient.get('/bills/revenue-summary/', {
      params: { start_date: startDate, end_date: endDate },
    });
    return response.data;
  },
};

export type { Bill, BillLineItem, Payment };
