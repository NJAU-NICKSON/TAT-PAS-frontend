import { useState } from 'react';
import { AlertTriangle, X, ShieldCheck, Loader2 } from 'lucide-react';
import { AuditRecord } from '../../models/types';
import { auditsApi } from '../../api/audits';
import { useAuth } from '../../context/AuthContext';

interface CountersignModalProps {
  flag: AuditRecord;
  onSuccess: () => void;
  onClose: () => void;
}

const SEVERITY_COLORS: Record<string, { bg: string; text: string }> = {
  critical: { bg: 'var(--sla-breached)',  text: '#fff' },
  high:     { bg: 'var(--sla-breached)',  text: '#fff' },
  medium:   { bg: 'var(--sla-warning)',   text: '#fff' },
  low:      { bg: 'var(--sla-safe)',      text: '#fff' },
};

export function CountersignModal({ flag, onSuccess, onClose }: CountersignModalProps) {
  const { user } = useAuth();
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSameUser = user?.id === flag.created_by;
  const noteValid = note.trim().length >= 10;
  const canSubmit = noteValid && !isSameUser && !isSubmitting;

  const severityColor = SEVERITY_COLORS[flag.severity] ?? SEVERITY_COLORS.low;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await auditsApi.countersign({ flag_id: flag.id, note: note.trim() });
      onSuccess();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: { message?: string; code?: string } | string } } })
        ?.response?.data?.detail;
      if (typeof detail === 'object' && detail?.message) {
        setError(detail.message);
      } else if (typeof detail === 'string') {
        setError(detail);
      } else {
        setError('Countersign failed. Ensure you are not the original flag author.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="w-full max-w-lg mx-4 rounded-lg overflow-hidden animate-slide-up"
        style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-modal)' }}
      >
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: 'var(--border-default)' }}
        >
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5" style={{ color: 'var(--sla-breached)' }} />
            <h2 className="text-h3">Countersign Required</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-base)] transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-4 border-b" style={{ background: 'var(--bg-alert)', borderColor: 'var(--border-default)' }}>
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--sla-breached)' }} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span
                  className="text-label font-bold px-2 py-0.5"
                  style={{ background: severityColor.bg, color: severityColor.text, borderRadius: 'var(--radius-badge)' }}
                >
                  {flag.severity.toUpperCase()}
                </span>
                {flag.flag_code && (
                  <span className="text-mono text-body-sm" style={{ color: 'var(--text-secondary)' }}>
                    {flag.flag_code}
                  </span>
                )}
              </div>
              <p className="text-body-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{flag.issue}</p>
              {flag.recommendation && (
                <p className="text-body-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{flag.recommendation}</p>
              )}
              <p className="text-meta mt-1.5" style={{ color: 'var(--text-muted)' }}>
                Flagged {new Date(flag.created_at).toLocaleString('en-GB')} by <span className="font-mono">{flag.created_by_role}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          {isSameUser && (
            <div
              className="flex items-start gap-2.5 p-3 rounded-lg border text-body-sm"
              style={{ background: 'var(--status-warning-bg)', borderColor: 'var(--status-warning-border)', color: 'var(--status-warning-text)' }}
            >
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p>You created this flag. A different auditor must countersign it.</p>
            </div>
          )}

          <div>
            <label className="block text-label mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Countersign Attestation
              <span className="ml-1 font-normal normal-case" style={{ color: 'var(--text-muted)' }}>
                (min. 10 characters)
              </span>
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              disabled={isSameUser || isSubmitting}
              rows={4}
              placeholder="State your clinical assessment and attestation for this flag"
              className="w-full px-3 py-2.5 text-body-sm border rounded-lg resize-none focus:outline-none transition-colors disabled:opacity-50"
              style={{
                borderColor: noteValid ? 'var(--border-focus)' : 'var(--border-default)',
                background: 'var(--bg-base)',
                borderRadius: 'var(--radius-card)',
              }}
            />
            <div className="flex justify-between mt-1">
              <span className="text-meta" style={{ color: note.trim().length >= 10 ? 'var(--sla-safe)' : 'var(--text-disabled)' }}>
                {note.trim().length}/10 minimum
              </span>
            </div>
          </div>

          {error && (
            <div
              className="p-3 rounded-lg border text-body-sm font-medium"
              style={{ background: 'var(--bg-alert)', borderColor: 'var(--border-breach)', color: 'var(--sla-breached)' }}
            >
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: 'var(--border-default)' }}>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-body-sm font-semibold rounded-lg border hover:bg-[var(--bg-base)] transition-colors disabled:opacity-50"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)', borderRadius: 'var(--radius-button)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex items-center gap-2 px-4 py-2 text-body-sm font-semibold text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: canSubmit ? 'var(--sla-breached)' : 'var(--text-muted)', borderRadius: 'var(--radius-button)' }}
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSubmitting ? 'Submitting' : 'Countersign Flag'}
          </button>
        </div>
      </div>
    </div>
  );
}
