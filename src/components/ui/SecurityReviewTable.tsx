import { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { AuditRecord } from '../../models/types';
import { formatDate } from '../../lib/utils';

interface SecurityReviewTableProps {
  events: AuditRecord[];
  onAcknowledge: (eventIds: string[]) => void;
  isLoading?: boolean;
}

export function SecurityReviewTable({ events, onAcknowledge, isLoading }: SecurityReviewTableProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleAll = () => {
    if (selected.size === events.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(events.map(e => e.id)));
    }
  };

  const toggleOne = (id: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelected(newSelected);
  };

  const handleAcknowledge = () => {
    onAcknowledge(Array.from(selected));
    setSelected(new Set());
  };

  if (isLoading) {
    return <div className="p-4 text-center">Loading security events...</div>;
  }

  if (events.length === 0) {
    return (
      <div className="p-8 text-center border-2 border-dashed border-surface-3 rounded-lg">
        <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
        <h3 className="text-h3 text-text-primary mb-2">All clear</h3>
        <p className="text-text-muted">No security events for this day.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={selected.size === events.length && events.length > 0}
            onChange={toggleAll}
            className="rounded border-surface-3"
          />
          <span className="text-sm text-text-secondary">Select all</span>
        </div>
        <button
          onClick={handleAcknowledge}
          disabled={selected.size === 0}
          className="px-4 py-2 bg-clinical-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
        >
          Acknowledge ({selected.size})
        </button>
      </div>

      <div className="overflow-x-auto border border-surface-3 rounded-lg">
        <table className="min-w-full divide-y divide-surface-3">
          <thead className="bg-surface-2">
            <tr>
              <th className="px-4 py-3 w-10"></th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase">Time</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase">Event Type</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase">User</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase">IP</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase">User Agent</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase">Description</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-surface-3">
            {events.map((event) => (
              <tr key={event.id} className="hover:bg-surface-1">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(event.id)}
                    onChange={() => toggleOne(event.id)}
                    className="rounded border-surface-3"
                  />
                </td>
                <td className="px-4 py-3 text-sm text-text-secondary">
                  {formatDate(event.created_at)}
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 rounded-full text-xs font-semibold bg-status-info text-status-info-text">
                    {event.security_event_type || event.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm font-mono text-text-secondary">{event.created_by}</td>
                <td className="px-4 py-3 text-sm text-text-secondary">{event.ip_address || 'â€”'}</td>
                <td className="px-4 py-3 text-sm text-text-secondary truncate max-w-xs" title={event.user_agent}>
                  {event.user_agent || 'â€”'}
                </td>
                <td className="px-4 py-3 text-sm text-text-primary">{event.issue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
