import { useState, useEffect, useCallback } from 'react';
import { Loader2, RefreshCw, ScrollText } from 'lucide-react';
import { toast } from 'sonner';
import { activityApi, ActivityEntry } from '../api/activity';
import { formatDateTimeEAT } from '../lib/utils';

const ACTION_LABEL: Record<string, string> = {
  login: 'Signed in',
  logout: 'Signed out',
  bill_generated: 'Generated bill',
  bill_auto_generated: 'Auto-generated bill',
  payment_recorded: 'Recorded payment',
  prescription_verified: 'Verified prescription',
  prescription_dispensed: 'Dispensed prescription',
  prescription_administered: 'Administered medication',
  prescription_pending_amendment: 'Returned prescription',
  prescription_submitted: 'Submitted prescription',
  print_receipt: 'Printed receipt',
  print_prescription: 'Printed prescription',
};

function label(action: string): string {
  return ACTION_LABEL[action] ?? action.replace(/_/g, ' ');
}

const ROLE_FILTERS = ['', 'doctor', 'nurse', 'pharmacist', 'auditor', 'billing', 'receptionist', 'admin'];

export default function ActivityLogPage() {
  const [rows, setRows] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    activityApi.list({ user_role: role || undefined, limit: 300 })
      .then(res => setRows(res.data))
      .catch(() => toast.error('Failed to load activity log'))
      .finally(() => setLoading(false));
  }, [role]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-h1" style={{ color: 'var(--text-primary)' }}>Activity Log</h1>
          <p className="text-body-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Every user action recorded for accountability: logins, prints, bills, payments and prescription actions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={role}
            onChange={e => setRole(e.target.value)}
            className="px-3 py-1.5 rounded-lg border text-sm"
            style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
          >
            {ROLE_FILTERS.map(r => <option key={r} value={r}>{r ? r[0].toUpperCase() + r.slice(1) : 'All roles'}</option>)}
          </select>
          <button
            onClick={load} disabled={loading}
            className="p-2 rounded-lg border transition-colors hover:bg-[var(--bg-base)] disabled:opacity-60"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-card)' }}>
        <div className="flex items-center gap-2 px-5 py-3.5" style={{ borderBottom: '1px solid var(--border-default)', background: 'var(--surface-1)' }}>
          <ScrollText className="w-4 h-4" style={{ color: 'var(--clinical-600)' }} />
          <span className="text-body-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{rows.length} recent actions</span>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm px-5 py-8" style={{ color: 'var(--text-muted)' }}>
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : rows.length === 0 ? (
          <p className="text-center py-10 text-body-sm" style={{ color: 'var(--text-muted)' }}>No activity recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-body-sm min-w-[720px]">
              <thead>
                <tr style={{ background: 'var(--surface-1)', borderBottom: '1px solid var(--border-default)' }}>
                  {['Time', 'User', 'Role', 'Action', 'Detail', 'IP'].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-caption font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border-default)' }}>
                    <td className="px-4 py-2.5 whitespace-nowrap text-mono" style={{ color: 'var(--text-secondary)' }}>{formatDateTimeEAT(r.created_at)}</td>
                    <td className="px-4 py-2.5" style={{ color: 'var(--text-primary)' }}>{r.user_name ?? '-'}</td>
                    <td className="px-4 py-2.5 capitalize" style={{ color: 'var(--text-secondary)' }}>{r.user_role ?? '-'}</td>
                    <td className="px-4 py-2.5 font-semibold" style={{ color: 'var(--text-primary)' }}>{label(r.action)}</td>
                    <td className="px-4 py-2.5" style={{ color: 'var(--text-secondary)' }}>{r.detail ?? '-'}</td>
                    <td className="px-4 py-2.5 text-mono text-caption" style={{ color: 'var(--text-muted)' }}>{r.ip_address ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
