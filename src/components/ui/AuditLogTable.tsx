import { useState, useMemo } from 'react';
import { Download, ChevronDown, ChevronRight, Filter } from 'lucide-react';
import { AuditRecord, AuditSeverity } from '../../models/types';

interface AuditLogTableProps {
  records: AuditRecord[];
  isLoading?: boolean;
}

const SEVERITY_CONFIG: Record<AuditSeverity, { bg: string; text: string; border: string }> = {
  critical: { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' },
  high:     { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' },
  medium:   { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
  low:      { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0' },
};

function SeverityBadge({ severity }: { severity: AuditSeverity }) {
  const c = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG.low;
  return (
    <span
      className="text-label font-bold px-2 py-0.5 border"
      style={{ background: c.bg, color: c.text, borderColor: c.border, borderRadius: 'var(--radius-badge)' }}
    >
      {severity.toUpperCase()}
    </span>
  );
}

function ExpandedRow({ record }: { record: AuditRecord }) {
  return (
    <div className="px-6 py-4 grid grid-cols-2 gap-4 text-body-sm" style={{ background: 'var(--bg-base)' }}>
      <div>
        <p className="text-label mb-1" style={{ color: 'var(--text-secondary)' }}>Prescription ID</p>
        <p className="text-mono" style={{ color: 'var(--text-primary)' }}>{record.prescription_id}</p>
      </div>
      <div>
        <p className="text-label mb-1" style={{ color: 'var(--text-secondary)' }}>Flag Code</p>
        <p className="text-mono" style={{ color: 'var(--text-primary)' }}>{record.flag_code ?? ' - '}</p>
      </div>
      {record.drug_name && (
        <div>
          <p className="text-label mb-1" style={{ color: 'var(--text-secondary)' }}>Drug</p>
          <p style={{ color: 'var(--text-primary)' }}>{record.drug_name}</p>
        </div>
      )}
      {record.dose && (
        <div>
          <p className="text-label mb-1" style={{ color: 'var(--text-secondary)' }}>Dose</p>
          <p style={{ color: 'var(--text-primary)' }}>{record.dose}</p>
        </div>
      )}
      <div className="col-span-2">
        <p className="text-label mb-1" style={{ color: 'var(--text-secondary)' }}>Issue</p>
        <p style={{ color: 'var(--text-primary)' }}>{record.issue}</p>
      </div>
      {record.recommendation && (
        <div className="col-span-2">
          <p className="text-label mb-1" style={{ color: 'var(--text-secondary)' }}>Recommendation</p>
          <p style={{ color: 'var(--text-secondary)' }}>{record.recommendation}</p>
        </div>
      )}
      {record.resolution_note && (
        <div className="col-span-2">
          <p className="text-label mb-1" style={{ color: 'var(--text-secondary)' }}>Resolution Note</p>
          <p style={{ color: 'var(--text-secondary)' }}>{record.resolution_note}</p>
        </div>
      )}
      {record.countersigned && (
        <div>
          <p className="text-label mb-1" style={{ color: 'var(--text-secondary)' }}>Countersigned By</p>
          <p className="text-mono" style={{ color: 'var(--text-primary)' }}>{record.countersigned_by ?? ' - '}</p>
        </div>
      )}
      <div>
        <p className="text-label mb-1" style={{ color: 'var(--text-secondary)' }}>IP Address</p>
        <p className="text-mono" style={{ color: 'var(--text-secondary)' }}>{record.ip_address ?? ' - '}</p>
      </div>
    </div>
  );
}

export function AuditLogTable({ records, isLoading = false }: AuditLogTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Filter state
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterResolved, setFilterResolved] = useState<string>('all');
  const [filterFlagType, setFilterFlagType] = useState('');
  const [filterActor, setFilterActor] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const filtered = useMemo(() => {
    return records.filter(r => {
      if (filterSeverity !== 'all' && r.severity !== filterSeverity) return false;
      if (filterResolved === 'resolved' && !r.resolved) return false;
      if (filterResolved === 'open' && r.resolved) return false;
      if (filterFlagType && r.flag_code !== filterFlagType) return false;
      if (filterActor && !r.created_by.toLowerCase().includes(filterActor.toLowerCase()) &&
          !r.created_by_role.toLowerCase().includes(filterActor.toLowerCase())) return false;
      if (filterDateFrom && new Date(r.created_at) < new Date(filterDateFrom)) return false;
      if (filterDateTo) {
        const to = new Date(filterDateTo);
        to.setDate(to.getDate() + 1);
        if (new Date(r.created_at) > to) return false;
      }
      return true;
    });
  }, [records, filterSeverity, filterResolved, filterFlagType, filterActor, filterDateFrom, filterDateTo]);

  const flagCodes = useMemo(() => [...new Set(records.map(r => r.flag_code).filter(Boolean))], [records]);

  const handleExportCSV = () => {
    const header = ['Timestamp', 'Actor', 'Role', 'Action', 'Prescription ID', 'Flag Type', 'Severity', 'Outcome', 'Resolved'];
    const rows = filtered.map(r => [
      new Date(r.created_at).toISOString(),
      r.created_by,
      r.created_by_role,
      r.type,
      r.prescription_id,
      r.flag_code ?? '',
      r.severity,
      r.resolution_type ?? '',
      r.resolved ? 'Yes' : 'No',
    ]);
    const csv = [header, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-12 rounded-lg animate-shimmer" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b flex-shrink-0"
        style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-body-sm font-semibold rounded-lg border transition-colors ${showFilters ? 'bg-[var(--clinical-50)] text-[var(--clinical-700)] border-[var(--clinical-200)]' : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-base)]'}`}
          >
            <Filter className="w-3.5 h-3.5" />
            Filters
          </button>
          <span className="text-body-sm" style={{ color: 'var(--text-muted)' }}>
            {filtered.length} / {records.length} records
          </span>
        </div>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-1.5 px-3 py-1.5 text-body-sm font-semibold border rounded-lg hover:bg-[var(--bg-base)] transition-colors"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
      </div>

      {showFilters && (
        <div
          className="flex flex-wrap items-end gap-3 px-4 py-3 border-b animate-fade-in"
          style={{ borderColor: 'var(--border-default)', background: 'var(--bg-base)' }}
        >
          <div>
            <label className="block text-label mb-1" style={{ color: 'var(--text-secondary)' }}>Severity</label>
            <select
              value={filterSeverity}
              onChange={e => setFilterSeverity(e.target.value)}
              className="text-body-sm border rounded-lg px-2 py-1.5 focus:outline-none"
              style={{ borderColor: 'var(--border-default)', borderRadius: 'var(--radius-button)', background: 'var(--bg-card)' }}
            >
              <option value="all">All</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div>
            <label className="block text-label mb-1" style={{ color: 'var(--text-secondary)' }}>Status</label>
            <select
              value={filterResolved}
              onChange={e => setFilterResolved(e.target.value)}
              className="text-body-sm border rounded-lg px-2 py-1.5 focus:outline-none"
              style={{ borderColor: 'var(--border-default)', borderRadius: 'var(--radius-button)', background: 'var(--bg-card)' }}
            >
              <option value="all">All</option>
              <option value="open">Open</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
          <div>
            <label className="block text-label mb-1" style={{ color: 'var(--text-secondary)' }}>Flag Type</label>
            <select
              value={filterFlagType}
              onChange={e => setFilterFlagType(e.target.value)}
              className="text-body-sm border rounded-lg px-2 py-1.5 focus:outline-none"
              style={{ borderColor: 'var(--border-default)', borderRadius: 'var(--radius-button)', background: 'var(--bg-card)' }}
            >
              <option value="">All</option>
              {flagCodes.map(c => <option key={c} value={c!}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-label mb-1" style={{ color: 'var(--text-secondary)' }}>Actor</label>
            <input
              value={filterActor}
              onChange={e => setFilterActor(e.target.value)}
              placeholder="Role or ID"
              className="text-body-sm border rounded-lg px-2 py-1.5 focus:outline-none w-32"
              style={{ borderColor: 'var(--border-default)', borderRadius: 'var(--radius-button)', background: 'var(--bg-card)' }}
            />
          </div>
          <div>
            <label className="block text-label mb-1" style={{ color: 'var(--text-secondary)' }}>Date From</label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={e => setFilterDateFrom(e.target.value)}
              className="text-body-sm border rounded-lg px-2 py-1.5 focus:outline-none"
              style={{ borderColor: 'var(--border-default)', borderRadius: 'var(--radius-button)', background: 'var(--bg-card)' }}
            />
          </div>
          <div>
            <label className="block text-label mb-1" style={{ color: 'var(--text-secondary)' }}>Date To</label>
            <input
              type="date"
              value={filterDateTo}
              onChange={e => setFilterDateTo(e.target.value)}
              className="text-body-sm border rounded-lg px-2 py-1.5 focus:outline-none"
              style={{ borderColor: 'var(--border-default)', borderRadius: 'var(--radius-button)', background: 'var(--bg-card)' }}
            />
          </div>
          <button
            onClick={() => {
              setFilterSeverity('all');
              setFilterResolved('all');
              setFilterFlagType('');
              setFilterActor('');
              setFilterDateFrom('');
              setFilterDateTo('');
            }}
            className="text-body-sm font-semibold px-3 py-1.5 rounded-lg border transition-colors hover:bg-[var(--bg-base)]"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
          >
            Clear
          </button>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <table className="w-full text-body-sm border-collapse">
          <thead className="sticky top-0" style={{ background: 'var(--bg-base)', zIndex: 1 }}>
            <tr className="border-b border-[var(--border-default)]">
              <th className="w-6 px-3 py-2.5" />
              {['Timestamp', 'Actor', 'Flag Type', 'Severity', 'Issue', 'Outcome', 'Resolved'].map(h => (
                <th
                  key={h}
                  className="px-4 py-2.5 text-left text-label whitespace-nowrap"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-default)]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-body-sm" style={{ color: 'var(--text-disabled)' }}>
                  No records match the current filters
                </td>
              </tr>
            ) : filtered.map(record => (
              <>
                <tr
                  key={record.id}
                  className="hover:bg-[var(--bg-row-hover)] cursor-pointer"
                  onClick={() => setExpandedId(expandedId === record.id ? null : record.id)}
                >
                  <td className="px-3 py-2.5" style={{ color: 'var(--text-muted)' }}>
                    {expandedId === record.id
                      ? <ChevronDown className="w-3.5 h-3.5" />
                      : <ChevronRight className="w-3.5 h-3.5" />
                    }
                  </td>
                  <td className="px-4 py-2.5 text-mono whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                    {new Date(record.created_at).toLocaleString('en-GB', {
                      day: '2-digit', month: 'short', year: '2-digit',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: 'var(--text-secondary)' }}>
                    <span className="text-mono">{record.created_by_role}</span>
                  </td>
                  <td className="px-4 py-2.5 text-mono" style={{ color: 'var(--text-secondary)' }}>
                    {record.flag_code ?? record.type}
                  </td>
                  <td className="px-4 py-2.5">
                    <SeverityBadge severity={record.severity} />
                  </td>
                  <td className="px-4 py-2.5 max-w-[280px] truncate" style={{ color: 'var(--text-primary)' }}>
                    {record.issue}
                  </td>
                  <td className="px-4 py-2.5 text-mono" style={{ color: 'var(--text-secondary)' }}>
                    {record.resolution_type ?? ' - '}
                  </td>
                  <td className="px-4 py-2.5">
                    {record.resolved ? (
                      <span className="text-label font-bold" style={{ color: 'var(--sla-safe)' }}>YES</span>
                    ) : (
                      <span className="text-label font-bold" style={{ color: 'var(--sla-breached)' }}>NO</span>
                    )}
                  </td>
                </tr>
                {expandedId === record.id && (
                  <tr key={`${record.id}-expanded`}>
                    <td colSpan={8} className="p-0 border-b border-[var(--border-default)]">
                      <ExpandedRow record={record} />
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
