import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, AlertTriangle, X, Loader as Loader2, Clock, FileText, ExternalLink } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePrescriptionViewModel } from '../viewModels/usePrescriptionViewModel';
import { StatusBadge } from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import FormField from '../components/FormField';
import { Prescription, PrescriptionStatus, AuditSeverity } from '../models/types';
import Table, { Column } from '../components/Table';
import TablePagination from '../components/TablePagination';
import { useTableControls } from '../components/useTableControls';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'flagged', label: 'Flagged' },
  { value: 'verified', label: 'Verified' },
  { value: 'dispensed', label: 'Dispensed' },
  { value: 'administered', label: 'Administered' },
  { value: 'archived', label: 'Archived' },
];

function formatDate(iso?: string): string {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleString();
}

function formatShortDate(iso?: string): string {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleDateString();
}

function tatMinutes(start?: string, end?: string): string {
  if (!start || !end) return 'N/A';
  const diff = (new Date(end).getTime() - new Date(start).getTime()) / 60000;
  if (diff < 60) return `${Math.round(diff)}m`;
  const h = Math.floor(diff / 60);
  const m = Math.round(diff % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

interface FlagFormData {
  issue: string;
  severity: AuditSeverity | '';
  recommendation: string;
}

interface FlagFormErrors {
  issue?: string;
  severity?: string;
  recommendation?: string;
}

export default function PrescriptionList() {
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const vm = usePrescriptionViewModel();

  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [confirmAction, setConfirmAction] = useState<{
    id: string;
    status: PrescriptionStatus;
    label: string;
    comment?: string;
  } | null>(null);

  const [flagModal, setFlagModal] = useState<{ prescriptionId: string } | null>(null);
  const [flagForm, setFlagForm] = useState<FlagFormData>({
    issue: '',
    severity: '',
    recommendation: '',
  });
  const [flagErrors, setFlagErrors] = useState<FlagFormErrors>({});

  const isPharmacist = hasRole('pharmacist');
  const isNurse = hasRole('nurse');
  const isAuditor = hasRole('auditor', 'admin');

  useEffect(() => {
    vm.loadPrescriptions({
      status: (statusFilter as PrescriptionStatus) || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, dateFrom, dateTo]);

  const handleConfirm = async () => {
    if (!confirmAction) return;
    await vm.updateStatus(confirmAction.id, confirmAction.status, {
      pharmacist_comment: confirmAction.comment,
    });
    setConfirmAction(null);
  };

  const openFlagModal = (prescriptionId: string) => {
    setFlagForm({ issue: '', severity: '', recommendation: '' });
    setFlagErrors({});
    setFlagModal({ prescriptionId });
  };

  const validateFlag = () => {
    const errs: FlagFormErrors = {};
    if (!flagForm.issue.trim()) errs.issue = 'Required';
    if (!flagForm.severity) errs.severity = 'Required';
    if (!flagForm.recommendation.trim()) errs.recommendation = 'Required';
    setFlagErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleFlagSubmit = async () => {
    if (!flagModal || !validateFlag()) return;
    await vm.addFlag(
      flagModal.prescriptionId,
      flagForm.issue,
      flagForm.severity as AuditSeverity,
      flagForm.recommendation
    );
    setFlagModal(null);
  };

  const tc = useTableControls<Prescription>({
    data: vm.prescriptions,
    initialSortKey: 'ordered_at',
    initialSortDir: 'desc',
    getSortValue: (row, key) => {
      switch (key) {
        case 'patient_id': return row.patient_name
          || (row.patient ? `${row.patient.first_name} ${row.patient.last_name}`.trim() : '');
        case 'medications': return row.medications.length;
        case 'status': return row.status;
        case 'ordered_at': return row.ordered_at || row.created_at;
        default: return (row as unknown as Record<string, unknown>)[key];
      }
    },
  });

  const columns: Column<Prescription>[] = [
    {
      key: 'patient_id',
      label: 'Patient',
      sortable: true,
      render: (row) => {
        const name = row.patient_name
          || (row.patient ? `${row.patient.first_name} ${row.patient.last_name}`.trim() : '');
        return name
          ? <span className="font-medium text-gray-800">{name}</span>
          : <span className="text-gray-400">Unknown Patient</span>;
      },
    },
    {
      key: 'medications',
      label: 'Medications',
      sortable: true,
      render: (row) => (
        <span className="text-gray-700">
          {row.medications.length} item{row.medications.length !== 1 ? 's' : ''}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'ordered_at',
      label: 'Ordered',
      sortable: true,
      render: (row) => formatShortDate(row.ordered_at || row.created_at),
    },
    {
      key: 'tat',
      label: 'TAT (Order to Verify)',
      render: (row) => (
        <span className="text-xs text-gray-500 flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {tatMinutes(row.ordered_at, row.verified_at)}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-2 flex-wrap">
          {isPharmacist && row.status === 'submitted' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setConfirmAction({ id: row.id, status: 'verified', label: 'Verify Prescription' });
              }}
              className="px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded-md font-medium transition-colors"
            >
              Verify
            </button>
          )}
          {isPharmacist && row.status === 'verified' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setConfirmAction({ id: row.id, status: 'dispensed', label: 'Dispense Prescription' });
              }}
              className="px-2.5 py-1 bg-sky-600 hover:bg-sky-700 text-white text-xs rounded-md font-medium transition-colors"
            >
              Dispense
            </button>
          )}
          {isNurse && row.status === 'dispensed' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setConfirmAction({ id: row.id, status: 'administered', label: 'Mark as Administered' });
              }}
              className="px-2.5 py-1 bg-green-700 hover:bg-green-800 text-white text-xs rounded-md font-medium transition-colors"
            >
              Administer
            </button>
          )}
          {isAuditor && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                openFlagModal(row.id);
              }}
              className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 text-xs rounded-md font-medium transition-colors border border-red-200"
            >
              Flag
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpandedId(expandedId === row.id ? null : row.id);
            }}
            className="px-2 py-1 text-gray-400 hover:text-gray-600 transition-colors"
            title="Toggle details"
          >
            {expandedId === row.id ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Prescriptions</h1>
        <p className="text-gray-500 text-sm mt-1">
          {isPharmacist ? 'Review, verify, and dispense prescriptions' :
           isNurse ? 'Record medication administration' :
           'View and manage prescriptions'}
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
            />
          </div>
          <button
            onClick={() => { setStatusFilter(''); setDateFrom(''); setDateTo(''); }}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {vm.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {vm.error}
        </div>
      )}

      <div>
        <Table
          columns={columns}
          data={tc.pageRows}
          isLoading={vm.isLoading}
          emptyMessage="No prescriptions found matching the current filters."
          sortKey={tc.sortKey}
          sortDir={tc.sortDir}
          onSort={tc.toggleSort}
        />
        {!vm.isLoading && vm.prescriptions.length > 0 && (
          <TablePagination
            page={tc.page} pageCount={tc.pageCount} pageSize={tc.pageSize}
            total={tc.total} rangeStart={tc.rangeStart} rangeEnd={tc.rangeEnd}
            setPage={tc.setPage} setPageSize={tc.setPageSize}
          />
        )}
      </div>

      {expandedId && (() => {
        const rx = vm.prescriptions.find((p) => p.id === expandedId);
        if (!rx) return null;
        return (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#1e3a5f]" />
                <h3 className="font-semibold text-gray-800">Prescription Detail</h3>
                <span className="font-mono text-xs text-gray-500">{rx.id.slice(0, 12)}...</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate(`/prescriptions/${rx.id}`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors hover:bg-green-50"
                  style={{ color: '#178A3D', borderColor: '#BBF7D0' }}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open full record
                </button>
                <button onClick={() => setExpandedId(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">Timeline</h4>
                <dl className="space-y-2 text-sm">
                  {[
                    ['Ordered', rx.ordered_at || rx.created_at],
                    ['Verified', rx.verified_at],
                    ['Dispensed', rx.dispensed_at],
                    ['Administered', rx.administered_at],
                  ].map(([label, val]) => (
                    <div key={label} className="flex gap-3">
                      <dt className="text-gray-500 w-28 flex-shrink-0">{label}:</dt>
                      <dd className="text-gray-800">{formatDate(val ?? undefined)}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">Details</h4>
                <dl className="space-y-2 text-sm">
                  <div className="flex gap-3">
                    <dt className="text-gray-500 w-28">Status:</dt>
                    <dd><StatusBadge status={rx.status} /></dd>
                  </div>
                  {rx.notes && (
                    <div className="flex gap-3">
                      <dt className="text-gray-500 w-28">Notes:</dt>
                      <dd className="text-gray-800">{rx.notes}</dd>
                    </div>
                  )}
                  {rx.pharmacist_comment && (
                    <div className="flex gap-3">
                      <dt className="text-gray-500 w-28">Pharmacist:</dt>
                      <dd className="text-gray-800">{rx.pharmacist_comment}</dd>
                    </div>
                  )}
                </dl>
              </div>

              <div className="md:col-span-2">
                <h4 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">Medications</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-50">
                        {['Name', 'Dose', 'Route', 'Frequency', 'Duration'].map((h) => (
                          <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase border-b border-gray-200">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rx.medications.map((med, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium text-gray-800">{med.name}</td>
                          <td className="px-3 py-2 text-gray-600">{med.dose}</td>
                          <td className="px-3 py-2 text-gray-600 capitalize">{med.route}</td>
                          <td className="px-3 py-2 text-gray-600 capitalize">{med.frequency}</td>
                          <td className="px-3 py-2 text-gray-600">{med.duration_days}d</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {rx.flags.length > 0 && (
                <div className="md:col-span-2">
                  <h4 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">Flags</h4>
                  <ul className="space-y-1">
                    {rx.flags.map((flag, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                        <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        {flag}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      <ConfirmDialog
        isOpen={!!confirmAction}
        title={confirmAction?.label ?? ''}
        message={`Are you sure you want to ${confirmAction?.label?.toLowerCase() ?? 'proceed'}?`}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmAction(null)}
        confirmLabel={confirmAction?.label ?? 'Confirm'}
        variant={confirmAction?.status === 'administered' ? 'default' : 'default'}
      />

      {flagModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setFlagModal(null)} />
          <div role="dialog" aria-modal="true" className="relative bg-white rounded-lg shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <h2 className="text-lg font-semibold text-gray-900">Flag Prescription</h2>
              </div>
              <button onClick={() => setFlagModal(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-6 space-y-1">
              <FormField
                label="Issue Description"
                name="issue"
                type="textarea"
                value={flagForm.issue}
                onChange={(e) => setFlagForm((prev) => ({ ...prev, issue: e.target.value }))}
                error={flagErrors.issue}
                required
                placeholder="Describe the issue found..."
                rows={3}
              />
              <FormField
                label="Severity"
                name="severity"
                type="select"
                value={flagForm.severity}
                onChange={(e) => setFlagForm((prev) => ({ ...prev, severity: e.target.value as AuditSeverity }))}
                error={flagErrors.severity}
                required
                options={[
                  { value: 'low', label: 'Low' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'high', label: 'High' },
                ]}
                placeholder="Select severity"
              />
              <FormField
                label="Recommendation"
                name="recommendation"
                type="textarea"
                value={flagForm.recommendation}
                onChange={(e) => setFlagForm((prev) => ({ ...prev, recommendation: e.target.value }))}
                error={flagErrors.recommendation}
                required
                placeholder="Recommended action or correction..."
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-100 rounded-b-2xl">
              <button
                onClick={() => setFlagModal(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleFlagSubmit}
                disabled={vm.isLoading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-60"
              >
                {vm.isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Submit Flag
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
