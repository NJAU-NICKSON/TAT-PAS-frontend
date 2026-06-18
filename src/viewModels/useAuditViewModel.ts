import { useState, useCallback } from 'react';
import { AuditRecord, ApiError } from '../models/types';
import { auditsApi, AuditFilters } from '../api/audits';

interface AuditViewModel {
  audits: AuditRecord[];
  selectedAudit: AuditRecord | null;
  isLoading: boolean;
  error: string | null;
  filter: boolean | undefined;
  setFilter: (resolved: boolean | undefined) => void;
  loadAudits: (filters?: AuditFilters) => Promise<void>;
  loadAudit: (id: string) => Promise<void>;
  resolveAudit: (prescription_id: string, note: string, resolution_type: string, esig_password?: string) => Promise<boolean>;
  clearError: () => void;
}

export function useAuditViewModel(): AuditViewModel {
  const [audits, setAudits] = useState<AuditRecord[]>([]);
  const [selectedAudit, setSelectedAudit] = useState<AuditRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<boolean | undefined>(undefined);

  const loadAudits = useCallback(async (filters?: AuditFilters) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await auditsApi.list(filters ?? {});
      const items = Array.isArray(res.data) ? res.data : (res.data as { items?: AuditRecord[] }).items ?? [];
      setAudits(items);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr?.detail || 'Failed to load audits.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadAudit = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await auditsApi.getById(id);
      setSelectedAudit(res.data);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr?.detail || 'Failed to load audit record.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const resolveAudit = useCallback(
    async (prescription_id: string, note: string, resolution_type: string, esig_password?: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);
      try {
        await auditsApi.resolve(prescription_id, note, resolution_type, esig_password);
        setAudits((prev) =>
          prev.map((a) =>
            a.prescription_id === prescription_id
              ? { ...a, resolved: true, resolution_note: note, resolution_type }
              : a
          )
        );
        return true;
      } catch (err) {
        const apiErr = err as ApiError;
        setError(apiErr?.detail || 'Failed to resolve audit.');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    audits,
    selectedAudit,
    isLoading,
    error,
    filter,
    setFilter,
    loadAudits,
    loadAudit,
    resolveAudit,
    clearError,
  };
}
