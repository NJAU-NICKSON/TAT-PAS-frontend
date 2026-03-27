import { useState } from 'react';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { AuditRecord } from '../../models/types';
import { cn } from '../../lib/utils';

interface AuditEventDetailsProps {
  event: AuditRecord;
  onClose: () => void;
}

export function AuditEventDetails({ event, onClose }: AuditEventDetailsProps) {
  const [showSnapshots, setShowSnapshots] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-3">
          <h2 className="text-lg font-semibold text-text-primary">Audit Event Details</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-6 space-y-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-text-muted uppercase font-semibold">ID</p>
              <p className="font-mono text-text-primary">{event.id}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted uppercase font-semibold">Timestamp</p>
              <p>{new Date(event.created_at).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted uppercase font-semibold">Type</p>
              <p>{event.type}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted uppercase font-semibold">Severity</p>
              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                event.severity === 'critical' ? 'bg-status-critical text-status-critical-text' :
                event.severity === 'high' ? 'bg-status-critical/80 text-white' :
                event.severity === 'medium' ? 'bg-status-warning text-status-warning-text' :
                'bg-status-info text-status-info-text'
              }`}>
                {event.severity}
              </span>
            </div>
            <div>
              <p className="text-xs text-text-muted uppercase font-semibold">Created By</p>
              <p>{event.created_by_role} ({event.created_by})</p>
            </div>
            {event.resolved && (
              <>
                <div>
                  <p className="text-xs text-text-muted uppercase font-semibold">Resolved By</p>
                  <p>{event.resolved_by}</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted uppercase font-semibold">Resolved At</p>
                  <p>{new Date(event.resolved_at!).toLocaleString()}</p>
                </div>
              </>
            )}
          </div>

          <div>
            <p className="text-xs text-text-muted uppercase font-semibold mb-1">Issue</p>
            <div className="p-3 bg-surface-2 rounded-lg text-text-primary">{event.issue}</div>
          </div>

          {event.recommendation && (
            <div>
              <p className="text-xs text-text-muted uppercase font-semibold mb-1">Recommendation</p>
              <div className="p-3 bg-surface-2 rounded-lg text-text-primary">{event.recommendation}</div>
            </div>
          )}

          {event.resolution_note && (
            <div>
              <p className="text-xs text-text-muted uppercase font-semibold mb-1">Resolution Note</p>
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-800">
                {event.resolution_note}
              </div>
            </div>
          )}

          <div>
            <button
              onClick={() => setShowSnapshots(!showSnapshots)}
              className="flex items-center gap-2 text-clinical-600 hover:text-clinical-700 font-medium"
            >
              {showSnapshots ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {showSnapshots ? 'Hide' : 'Show'} Before/After Snapshots
            </button>
            {showSnapshots && (
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-xs text-text-muted uppercase font-semibold mb-1">Before</p>
                  <pre className="p-3 bg-surface-2 rounded-lg text-xs overflow-auto max-h-60">
                    {JSON.stringify(event.before_snapshot, null, 2) || 'None'}
                  </pre>
                </div>
                <div>
                  <p className="text-xs text-text-muted uppercase font-semibold mb-1">After</p>
                  <pre className="p-3 bg-surface-2 rounded-lg text-xs overflow-auto max-h-60">
                    {JSON.stringify(event.after_snapshot, null, 2) || 'None'}
                  </pre>
                </div>
              </div>
            )}
          </div>

          <div className="text-right text-xs text-text-muted">
            <span>Hash: 0x{event.id.slice(0, 8)}...</span>
          </div>
        </div>
      </div>
    </div>
  );
}
