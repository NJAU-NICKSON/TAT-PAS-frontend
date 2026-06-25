import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { X, CheckCircle, AlertTriangle, Loader2, ShieldCheck, RefreshCw, ExternalLink } from 'lucide-react';
import Table, { Column } from '../components/Table';
import TablePagination from '../components/TablePagination';
import { useTableControls } from '../components/useTableControls';
import { SeverityBadge, TypeBadge } from '../components/StatusBadge';
import FormField from '../components/FormField';
import { useAuditViewModel } from '../viewModels/useAuditViewModel';
import { AuditRecord } from '../models/types';
import { auditsApi, IntegrityResult } from '../api/audits';
import { CountersignModal } from '../components/ui/CountersignModal';
import { toast } from 'sonner';

type TabValue = 'unresolved' | 'resolved' | 'all';
type AuditFilters = { resolved?: boolean };

function formatDate(iso?: string): string {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleString();
}

function shortIssue(issue: string): string {
  if (!issue) return 'N/A';
  const sla = issue.match(/(stat|urgent|routine|discharge|nicu|chemo)\s+prescription exceeded\s+(\d+)\s*min threshold by\s+([\d.]+)/i);
  if (sla) {
    const over = Math.round(parseFloat(sla[3]));
    return `SLA breach (${sla[1].toLowerCase()}): ${over} min over ${sla[2]} min limit`;
  }
  const sec = issue.match(/security event:\s*(.+)/i);
  if (sec) return `Security: ${sec[1].replace(/_/g, ' ')}`;
  return issue;
}

export default function AuditQueue() {
  const vm = useAuditViewModel();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const rxFilter = searchParams.get('rx')?.trim() ?? '';
  const [activeTab, setActiveTab] = useState<TabValue>(rxFilter ? 'all' : 'unresolved');
  const [resolveModal, setResolveModal] = useState<AuditRecord | null>(null);
  const [countersignModal, setCountersignModal] = useState<AuditRecord | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [resolutionType, setResolutionType] = useState('');
  const [noteError, setNoteError] = useState('');
  const [typeError, setTypeError] = useState('');
  const [integrity, setIntegrity] = useState<IntegrityResult | null>(null);
  const [checkingIntegrity, setCheckingIntegrity] = useState(false);

  const runIntegrityCheck = async () => {
    setCheckingIntegrity(true);
    try {
      const res = await auditsApi.verifyIntegrity();
      setIntegrity(res.data);
      toast[res.data.intact ? 'success' : 'error'](
        res.data.intact ? 'Audit trail is intact' : 'Audit trail integrity issue detected'
      );
    } catch {
      toast.error('Failed to run integrity check');
    } finally {
      setCheckingIntegrity(false);
    }
  };

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

  const handleCountersignSuccess = async () => {
    const filters: AuditFilters = {};
    if (activeTab === 'unresolved') filters.resolved = false;
    else if (activeTab === 'resolved') filters.resolved = true;
    await vm.loadAudits(filters);
    // Mark the open resolve modal as countersigned so the resolve action unlocks.
    setResolveModal((prev) => (prev ? { ...prev, countersigned: true } : prev));
    setCountersignModal(null);
    vm.clearError();
    toast.success('Flag countersigned. You may now mark it as resolved.');
  };

  const handleResolve = async () => {
    if (!resolveModal) return;
    if (resolveModal.esig_required && !resolveModal.countersigned) {
      setCountersignModal(resolveModal);
      return;
    }
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
  const filteredAudits = rxFilter
    ? vm.audits.filter(a =>
        (a.rx_number ?? '').toLowerCase() === rxFilter.toLowerCase() ||
        a.prescription_id === rxFilter
      )
    : vm.audits;
  const tc = useTableControls<AuditRecord>({
    data: filteredAudits,
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
        <span className="text-gray-700 text-sm block max-w-[320px] truncate" title={row.issue}>
          {shortIssue(row.issue)}
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
        <div className="flex items-center gap-2">
          <button
            onClick={runIntegrityCheck}
            disabled={checkingIntegrity}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-md text-sm hover:bg-gray-50 disabled:opacity-60"
          >
            <ShieldCheck className={`h-4 w-4 ${checkingIntegrity ? 'animate-pulse' : ''}`} />
            {checkingIntegrity ? 'Checking…' : 'Integrity Check'}
          </button>
          <button
            onClick={handleRefresh}
            disabled={vm.isLoading}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-md text-sm hover:bg-gray-50"
          >
            <RefreshCw className={`h-4 w-4 ${vm.isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {integrity && (
        <div
          className={`flex items-start gap-3 px-4 py-3 rounded-lg border ${integrity.intact ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}
        >
          {integrity.intact
            ? <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            : <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />}
          <div className="text-sm">
            <p className={`font-semibold ${integrity.intact ? 'text-green-800' : 'text-red-800'}`}>
              {integrity.intact ? 'Audit trail is intact (tamper-evident hash chain verified)' : 'Audit trail integrity problem detected'}
            </p>
            <p className="text-gray-600 mt-0.5">
              {integrity.total_chained_records} chained records checked
              {integrity.unchained_records > 0 ? `, ${integrity.unchained_records} unchained` : ''}.
              {!integrity.intact && integrity.first_break_at ? ` First break at record ${integrity.first_break_at}.` : ''}
            </p>
            {!integrity.intact && integrity.issues.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {integrity.issues.map((iss, i) => (
                  <li key={i} className="text-xs text-red-700 bg-red-100/60 rounded px-2 py-1.5">
                    <span className="font-mono font-semibold">{iss.record_id}</span>
                    {': '}{iss.problem}
                    <span className="block text-red-600/80 mt-0.5">{iss.detail}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

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

      {rxFilter && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg bg-green-50 border border-green-200 text-sm">
          <span className="text-green-800">
            Showing flags for prescription <span className="font-semibold">{rxFilter}</span>
          </span>
          <button
            onClick={() => { searchParams.delete('rx'); setSearchParams(searchParams); }}
            className="flex items-center gap-1 text-green-700 hover:text-green-900 font-medium"
          >
            <X className="h-3.5 w-3.5" />
            Clear filter
          </button>
        </div>
      )}

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
                  <p className="text-gray-700 text-sm">{resolveModal.recommendation || 'Review with the prescribing doctor.'}</p>
                </div>

                {(resolveModal.drug_name || resolveModal.dose || resolveModal.patient_age != null) && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                    <p className="text-xs text-amber-700 mb-1 uppercase font-semibold tracking-wide">Flagged Medication</p>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-gray-500">Drug</p>
                        <p className="font-semibold text-gray-800">{resolveModal.drug_name ?? '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Prescribed dose</p>
                        <p className="font-semibold text-gray-800">{resolveModal.dose ?? '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Patient age</p>
                        <p className="font-semibold text-gray-800">{resolveModal.patient_age != null ? `${resolveModal.patient_age} yrs` : '-'}</p>
                      </div>
                    </div>
                  </div>
                )}

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

              {!resolveModal.resolved && resolveModal.esig_required && !resolveModal.countersigned && (
                <div className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-700">Countersign required</p>
                      <p className="text-xs text-red-600 mt-0.5">
                        High severity flags must be countersigned by a different auditor before they can be resolved.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setCountersignModal(resolveModal)}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Countersign
                  </button>
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

            <div className="flex items-center justify-between gap-3 px-6 py-4 bg-gray-50 border-t border-gray-100 rounded-b-2xl">
              {resolveModal.prescription_id ? (
                <button
                  onClick={() => navigate(`/prescriptions/${resolveModal.prescription_id}`)}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg border transition-colors hover:bg-white"
                  style={{ color: '#178A3D', borderColor: '#BBF7D0' }}
                >
                  <ExternalLink className="h-4 w-4" />
                  View Full Prescription
                </button>
              ) : <span />}
              <div className="flex gap-3">
              <button
                onClick={() => setResolveModal(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors"
              >
                {resolveModal.resolved ? 'Close' : 'Cancel'}
              </button>
              {!resolveModal.resolved && (
                <button
                  onClick={handleResolve}
                  disabled={vm.isLoading || (resolveModal.esig_required && !resolveModal.countersigned)}
                  title={
                    resolveModal.esig_required && !resolveModal.countersigned
                      ? 'Countersign required before this flag can be resolved'
                      : undefined
                  }
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {vm.isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Mark as Resolved
                </button>
              )}
              </div>
            </div>
          </div>
        </div>
      )}

      {countersignModal && (
        <CountersignModal
          flag={countersignModal}
          onSuccess={handleCountersignSuccess}
          onClose={() => setCountersignModal(null)}
        />
      )}
    </div>
  );
}
