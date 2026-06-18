import { useState, useEffect } from 'react';
import { X, CheckCircle, AlertTriangle, Loader2, ShieldCheck, RefreshCw } from 'lucide-react';
import Table, { Column } from '../components/Table';
import TablePagination from '../components/TablePagination';
import { useTableControls } from '../components/useTableControls';
import { SeverityBadge, TypeBadge } from '../components/StatusBadge';
import FormField from '../components/FormField';
import { useAuditViewModel } from '../viewModels/useAuditViewModel';
import { AuditRecord } from '../models/types';

type TabValue = 'unresolved' | 'resolved' | 'all';
type AuditFilters = { resolved?: boolean };

function formatDate(iso?: string): string {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleString();
}

export default function AuditQueue() {
  const vm = useAuditViewModel();
  const [activeTab, setActiveTab] = useState<TabValue>('unresolved');
  const [resolveModal, setResolveModal] = useState<AuditRecord | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [resolutionType, setResolutionType] = useState('');
  const [noteError, setNoteError] = useState('');
  const [typeError, setTypeError] = useState('');

  useEffect(() => {
    const filters: AuditFilters = {};
    if (activeTab === 'unresolved') {
      filters.resolved = false;
    } else if (activeTab === 'resolved') {
      filters.resolved = true;
    }
    vm.loadAudits(filters);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const openResolveModal = (record: AuditRecord) => {
    vm.clearError();
    setResolveModal(record);
    setResolutionNote('');
    setResolutionType('');
    setNoteError('');
    setTypeError('');
  };

  const handleResolve = async () => {
    if (!resolveModal) return;
    let valid = true;
    if (!resolutionNote.trim()) {
      setNoteError('Resolution note is required');
      valid = false;
    }
    if (!resolutionType) {
      setTypeError('Resolution type is required');
      valid = false;
    }
    if (!valid) return;

    const ok = await vm.resolveAudit(
      resolveModal.prescription_id,
      resolutionNote.trim(),
      resolutionType
    );
    if (ok) {
      setResolveModal(null);
      const filters: AuditFilters = {};
      if (activeTab === 'unresolved') filters.resolved = false;
      else if (activeTab === 'resolved') filters.resolved = true;
      vm.loadAudits(filters);
    }
  };

  const handleRefresh = () => {
    const filters: AuditFilters = {};
    if (activeTab === 'unresolved') filters.resolved = false;
    else if (activeTab === 'resolved') filters.resolved = true;
    vm.loadAudits(filters);
  };

  const SEVERITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const tc = useTableControls<AuditRecord>({
    data: vm.audits,
    initialSortKey: 'created_at',
    initialSortDir: 'desc',
    getSortValue: (row, key) => {
      switch (key) {
        case 'prescription_id': return row.rx_number ?? '';
        case 'severity': return SEVERITY_RANK[row.severity] ?? 99;
        case 'created_by_role': return row.created_by_role;
        case 'created_at': return row.created_at;
        case 'resolved_at': return row.resolved_at;
        default: return (row as unknown as Record<string, unknown>)[key];
      }
    },
  });

  const columns: Column<AuditRecord>[] = [
    {
      key: 'prescription_id',
      label: 'Prescription',
      sortable: true,
      render: (row) => (
        <div className="flex flex-col">
          {row.rx_number
            ? <span className="font-medium text-gray-800">{row.rx_number}</span>
            : <span className="text-gray-400">Unknown Rx</span>}
          {row.patient_name && (
            <span className="text-xs text-gray-500">{row.patient_name}</span>
          )}
        </div>
      ),
    },
    {
      key: 'issue',
      label: 'Issue',
      sortable: true,
      render: (row) => (
        <span className="text-gray-800 max-w-xs block truncate" title={row.issue}>
          {row.issue}
        </span>
      ),
    },
    {
      key: 'severity',
      label: 'Severity',
      sortable: true,
      render: (row) => <SeverityBadge severity={row.severity} />,
    },
    {
      key: 'type',
      label: 'Type',
      sortable: true,
      render: (row) => <TypeBadge type={row.type} />,
    },
    {
      key: 'created_by_role',
      label: 'Raised By',
      sortable: true,
      render: (row) => (
        <span className="capitalize text-gray-600">{row.created_by_role}</span>
      ),
    },
    {
      key: 'created_at',
      label: 'Created',
      sortable: true,
      render: (row) => (
        <span className="text-xs text-gray-500">{formatDate(row.created_at)}</span>
      ),
    },
    {
      key: 'resolved_at',
      label: 'Resolved At',
      render: (row) =>
        row.resolved_at ? (
          <span className="text-xs text-gray-500">{formatDate(row.resolved_at)}</span>
        ) : (
          <span className="text-xs text-gray-400"> - </span>
        ),
    },
    {
      key: 'resolved',
      label: 'Status',
      render: (row) =>
        row.resolved ? (
          <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
            <CheckCircle className="h-3.5 w-3.5" />
            Resolved
          </span>
        ) : (
          <span className="flex items-center gap-1 text-amber-600 text-xs font-medium">
            <AlertTriangle className="h-3.5 w-3.5" />
            Pending
          </span>
        ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) =>
        !row.resolved ? (
          <button
            onClick={() => openResolveModal(row)}
            className="px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded-md font-medium transition-colors"
          >
            Resolve
          </button>
        ) : (
          <button
            onClick={() => openResolveModal(row)}
            className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs rounded-md font-medium transition-colors"
          >
            View
          </button>
        ),
    },
  ];

  const tabs: { value: TabValue; label: string }[] = [
    { value: 'unresolved', label: 'Unresolved' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'all', label: 'All Records' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Review Queue</h1>
          <p className="text-gray-500 text-sm mt-1">
            Review prescription flags and take action
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={vm.isLoading}
          className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-md text-sm hover:bg-gray-50"
        >
          <RefreshCw className={`h-4 w-4 ${vm.isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors duration-150 ${
              activeTab === tab.value
                ? 'bg-white text-[#1e3a5f] shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {vm.error && !resolveModal && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {vm.error}
        </div>
      )}

      <div>
        <Table
          columns={columns}
          data={tc.pageRows}
          isLoading={vm.isLoading}
          sortKey={tc.sortKey}
          sortDir={tc.sortDir}
          onSort={tc.toggleSort}
          emptyMessage={
            activeTab === 'unresolved'
              ? 'No unresolved audit records. All flags have been addressed.'
              : activeTab === 'resolved'
              ? 'No resolved audit records yet.'
              : 'No audit records found.'
          }
        />
        {!vm.isLoading && vm.audits.length > 0 && (
          <TablePagination
            page={tc.page} pageCount={tc.pageCount} pageSize={tc.pageSize}
            total={tc.total} rangeStart={tc.rangeStart} rangeEnd={tc.rangeEnd}
            setPage={tc.setPage} setPageSize={tc.setPageSize}
          />
        )}
      </div>

      {resolveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setResolveModal(null)}
          />
          <div role="dialog" aria-modal="true" className="relative bg-white rounded-lg shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-[#1e3a5f]" />
                <h2 className="text-lg font-semibold text-gray-900">
                  {resolveModal.resolved ? 'Audit Record' : 'Resolve Audit Flag'}
                </h2>
              </div>
              <button
                onClick={() => setResolveModal(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-6 space-y-5">
              {vm.error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                  {vm.error}
                </div>
              )}

              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 mb-1 uppercase font-semibold tracking-wide">Issue</p>
                    <p className="text-gray-800 text-sm">{resolveModal.issue}</p>
                  </div>
                  <div className="flex-shrink-0">
                    <SeverityBadge severity={resolveModal.severity} />
                  </div>
                </div>

                <div>
                  <p className="text-xs text-gray-500 mb-1 uppercase font-semibold tracking-wide">Recommendation</p>
                  <p className="text-gray-700 text-sm">{resolveModal.recommendation}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-1">Type</p>
                    <TypeBadge type={resolveModal.type} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-1">Raised By</p>
                    <p className="text-gray-700 capitalize">{resolveModal.created_by_role}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-1">Created</p>
                    <p className="text-gray-700">{formatDate(resolveModal.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-1">Prescription</p>
                    {resolveModal.rx_number
                      ? <p className="text-gray-700 font-medium text-sm">{resolveModal.rx_number}</p>
                      : <p className="text-gray-700 text-sm">Unknown Rx</p>}
                    {resolveModal.patient_name && (
                      <p className="text-gray-500 text-xs mt-0.5">{resolveModal.patient_name}</p>
                    )}
                  </div>
                </div>
              </div>

              {resolveModal.resolved && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2 text-green-700 font-medium text-sm">
                    <CheckCircle className="h-4 w-4" />
                    Resolved
                  </div>
                  {resolveModal.resolved_at && (
                    <p className="text-xs text-green-600">
                      Resolved on {formatDate(resolveModal.resolved_at)}
                    </p>
                  )}
                  {resolveModal.resolution_note && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-1">Resolution Note</p>
                      <p className="text-gray-700 text-sm">{resolveModal.resolution_note}</p>
                    </div>
                  )}
                </div>
              )}

              {!resolveModal.resolved && (
                <div className="space-y-4">
                  <FormField
                    label="Resolution Note"
                    name="resolution_note"
                    type="textarea"
                    value={resolutionNote}
                    onChange={(e) => {
                      setResolutionNote(e.target.value);
                      if (noteError) setNoteError('');
                    }}
                    error={noteError}
                    required
                    placeholder="Describe how this issue was resolved..."
                    rows={3}
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Resolution Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={resolutionType}
                      onChange={(e) => {
                        setResolutionType(e.target.value);
                        if (typeError) setTypeError('');
                      }}
                      className={`block w-full rounded-md border px-3 py-2 text-sm ${
                        typeError ? 'border-red-400 bg-red-50' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select resolution type</option>
                      <option value="accepted_risk">Accepted Risk</option>
                      <option value="dose_adjusted">Dose Adjusted</option>
                      <option value="drug_changed">Drug Changed</option>
                      <option value="prescription_cancelled">Prescription Cancelled</option>
                      <option value="false_positive">False Positive</option>
                    </select>
                    {typeError && <p className="mt-1 text-xs text-red-600">{typeError}</p>}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-100 rounded-b-2xl">
              <button
                onClick={() => setResolveModal(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors"
              >
                {resolveModal.resolved ? 'Close' : 'Cancel'}
              </button>
              {!resolveModal.resolved && (
                <button
                  onClick={handleResolve}
                  disabled={vm.isLoading}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-60"
                >
                  {vm.isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Mark as Resolved
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
