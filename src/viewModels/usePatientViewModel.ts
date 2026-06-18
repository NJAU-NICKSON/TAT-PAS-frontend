import { useState, useCallback, useEffect, useRef } from 'react';
import { Patient, ApiError } from '../models/types';
import {
  patientsApi,
  CreatePatientPayload,
  UpdatePatientPayload,
} from '../api/patients';

interface Pagination {
  skip: number;
  limit: number;
  total: number;
}

interface PatientViewModel {
  patients: Patient[];
  selectedPatient: Patient | null;
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  pagination: Pagination;
  setSearchQuery: (query: string) => void;
  searchPatients: (query: string) => Promise<void>;
  loadPatient: (id: string) => Promise<void>;
  createPatient: (data: CreatePatientPayload, force?: boolean) => Promise<Patient | null>;
  updatePatient: (id: string, data: UpdatePatientPayload) => Promise<Patient | null>;
  absorbCreated: (patient: Patient) => void;
  clearError: () => void;
}

export function usePatientViewModel(): PatientViewModel {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQueryState] = useState('');
  const [pagination, setPagination] = useState<Pagination>({
    skip: 0,
    limit: 20,
    total: 0,
  });

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchPatients = useCallback(async (query: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await patientsApi.search(query, 0, 20);
      const items = res.data.patients ?? [];
      setPatients(items);
      setPagination((prev) => ({
        ...prev,
        total: res.data.total ?? items.length,
        skip: 0,
      }));
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr?.detail || 'Failed to search patients.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setSearchQuery = useCallback(
    (query: string) => {
      setSearchQueryState(query);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        searchPatients(query);
      }, 300);
    },
    [searchPatients]
  );

  useEffect(() => {
    searchPatients('');
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [searchPatients]);

  const loadPatient = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await patientsApi.getById(id);
      setSelectedPatient(res.data);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr?.detail || 'Failed to load patient.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createPatient = useCallback(
    async (data: CreatePatientPayload, force = false): Promise<Patient | null> => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await patientsApi.create(data, force);
        setPatients((prev) => [res.data, ...prev]);
        return res.data;
      } catch (err) {
        const apiErr = err as ApiError;
        setError(apiErr?.detail || 'Failed to create patient.');
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const updatePatient = useCallback(
    async (id: string, data: UpdatePatientPayload): Promise<Patient | null> => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await patientsApi.update(id, data);
        setPatients((prev) =>
          prev.map((p) => (p.id === id ? res.data : p))
        );
        if (selectedPatient?.id === id) {
          setSelectedPatient(res.data);
        }
        return res.data;
      } catch (err) {
        const apiErr = err as ApiError;
        setError(apiErr?.detail || 'Failed to update patient.');
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [selectedPatient]
  );

  const absorbCreated = useCallback((patient: Patient) => {
    setPatients((prev) => [patient, ...prev]);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    patients,
    selectedPatient,
    isLoading,
    error,
    searchQuery,
    pagination,
    setSearchQuery,
    searchPatients,
    loadPatient,
    createPatient,
    updatePatient,
    absorbCreated,
    clearError,
  };
}
