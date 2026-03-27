import { useState, useCallback } from 'react';
import { Prescription, PrescriptionStatus, AuditSeverity, ApiError } from '../models/types';
import {
  prescriptionsApi,
  PrescriptionFilters,
  CreatePrescriptionPayload,
  UpdateStatusExtra,
} from '../api/prescriptions';

interface PrescriptionViewModel {
  prescriptions: Prescription[];
  selectedPrescription: Prescription | null;
  isLoading: boolean;
  error: string | null;
  filters: PrescriptionFilters;
  setFilters: (filters: PrescriptionFilters) => void;
  loadPrescriptions: (filters?: PrescriptionFilters) => Promise<void>;
  loadPrescription: (id: string) => Promise<void>;
  createPrescription: (data: CreatePrescriptionPayload) => Promise<Prescription | null>;
  updateStatus: (
    id: string,
    status: PrescriptionStatus,
    extra?: UpdateStatusExtra
  ) => Promise<Prescription | null>;
  addFlag: (
    id: string,
    issue: string,
    severity: AuditSeverity,
    recommendation: string
  ) => Promise<boolean>;
  clearError: () => void;
  clearSelected: () => void;
}

export function usePrescriptionViewModel(): PrescriptionViewModel {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<PrescriptionFilters>({});

  const loadPrescriptions = useCallback(async (f?: PrescriptionFilters) => {
    setIsLoading(true);
    setError(null);
    try {
      const activeFilters = f ?? filters;
      const res = await prescriptionsApi.list(activeFilters);
      const items = Array.isArray(res.data) ? res.data : (res.data as { items?: Prescription[] }).items ?? [];
      setPrescriptions(items);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr?.detail || 'Failed to load prescriptions.');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  const loadPrescription = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await prescriptionsApi.getById(id);
      setSelectedPrescription(res.data);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr?.detail || 'Failed to load prescription.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createPrescription = useCallback(
    async (data: CreatePrescriptionPayload): Promise<Prescription | null> => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await prescriptionsApi.create(data);
        setPrescriptions((prev) => [res.data, ...prev]);
        return res.data;
      } catch (err) {
        const apiErr = err as ApiError;
        setError(apiErr?.detail || 'Failed to create prescription.');
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const updateStatus = useCallback(
    async (
      id: string,
      status: PrescriptionStatus,
      extra?: UpdateStatusExtra
    ): Promise<Prescription | null> => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await prescriptionsApi.updateStatus(id, status, extra);
        setPrescriptions((prev) =>
          prev.map((p) => (p.id === id ? res.data : p))
        );
        if (selectedPrescription?.id === id) {
          setSelectedPrescription(res.data);
        }
        return res.data;
      } catch (err) {
        const apiErr = err as ApiError;
        setError(apiErr?.detail || 'Failed to update prescription status.');
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [selectedPrescription]
  );

  const addFlag = useCallback(
    async (
      id: string,
      issue: string,
      severity: AuditSeverity,
      recommendation: string
    ): Promise<boolean> => {
      setIsLoading(true);
      setError(null);
      try {
        await prescriptionsApi.addFlag(id, issue, severity, recommendation);
        // Reload the prescription to get updated flags
        const res = await prescriptionsApi.getById(id);
        setPrescriptions((prev) =>
          prev.map((p) => (p.id === id ? res.data : p))
        );
        if (selectedPrescription?.id === id) {
          setSelectedPrescription(res.data);
        }
        return true;
      } catch (err) {
        const apiErr = err as ApiError;
        setError(apiErr?.detail || 'Failed to add flag.');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [selectedPrescription]
  );

  const clearError = useCallback(() => setError(null), []);
  const clearSelected = useCallback(() => setSelectedPrescription(null), []);

  return {
    prescriptions,
    selectedPrescription,
    isLoading,
    error,
    filters,
    setFilters,
    loadPrescriptions,
    loadPrescription,
    createPrescription,
    updateStatus,
    addFlag,
    clearError,
    clearSelected,
  };
}
