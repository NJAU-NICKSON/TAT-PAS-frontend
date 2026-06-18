import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, ChevronRight, X, Search, RefreshCw, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import TablePagination from '../components/TablePagination';
import { useTableControls } from '../components/useTableControls';
import { visitsApi, Visit, CreateVisitPayload, VisitType } from '../api/visits';
import { departmentsApi, Department } from '../api/departments';
import { patientsApi } from '../api/patients';
import { Patient } from '../models/types';
import { toast } from 'sonner';

type ListResult<T> = T[] | { items?: T[] };

const VISIT_TYPES: { value: VisitType; label: string }[] = [
  { value: 'opd',          label: 'OPD  -  Outpatient'       },
  { value: 'ipd',          label: 'IPD  -  Inpatient'         },
  { value: 'emergency',    label: 'Emergency'               },
  { value: 'day_surgery',  label: 'Day Surgery'             },
  { value: 'maternity',    label: 'Maternity'               },
  { value: 'paediatric',   label: 'Paediatric'              },
  { value: 'nicu',         label: 'NICU'                    },
];

const PRIORITIES = [
  { value: 'routine',   label: 'Routine',   color: '#178A3D' },
  { value: 'urgent',    label: 'Urgent',    color: '#D97706' },
  { value: 'critical',  label: 'Critical',  color: '#DC2626' },
  { value: 'immediate', label: 'Immediate', color: '#178A3D' },
];

const STATUS_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  registered:           { bg: '#EFF6FF', color: '#0F6E2F', border: '#BFDBFE' },
  triaged:              { bg: '#FFFBEB', color: '#92400E', border: '#FDE68A' },
  waiting_for_doctor:   { bg: '#FFFBEB', color: '#92400E', border: '#FDE68A' },
  in_consultation:      { bg: '#FAF5FF', color: '#6B21A8', border: '#E9D5FF' },
  awaiting_results:     { bg: '#FFFBEB', color: '#92400E', border: '#FDE68A' },
  treatment_in_progress:{ bg: '#EFF6FF', color: '#0F6E2F', border: '#BFDBFE' },
  admitted:             { bg: '#EFF6FF', color: '#0F6E2F', border: '#BFDBFE' },
  in_ward:              { bg: '#EFF6FF', color: '#0F6E2F', border: '#BFDBFE' },
  ready_for_discharge:  { bg: '#F0FDF4', color: '#15803D', border: '#BBF7D0' },
  discharged:           { bg: '#F0FDF4', color: '#15803D', border: '#BBF7D0' },
  cancelled:            { bg: '#FEF2F2', color: '#B91C1C', border: '#FECACA' },
};

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-caption font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        {label}{required && <span style={{ color: '#DC2626' }}> *</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = 'w-full px-3 py-2.5 rounded-lg text-body-sm outline-none transition-colors';
const inputStyle = { background: 'var(--bg-base)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' };

function PatientSearch({
  selectedPatientRef,
  onSelect,
  onClear,
}: {
  selectedPatientRef: React.MutableRefObject<Patient | null>;
  onSelect: (p: Patient) => void;
  onClear: () => void;
}) {
  const [query, setQuery]         = useState('');
  const [results, setResults]     = useState<Patient[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen]           = useState(false);
  const [chip, setChip]           = useState<Patient | null>(null);
  const debounce                  = useRef<ReturnType<typeof setTimeout>>();

  const onSelectRef = useRef(onSelect);
  const onClearRef  = useRef(onClear);
  onSelectRef.current = onSelect;
  onClearRef.current  = onClear;

  const doSelect = useCallback((p: Patient) => {
    selectedPatientRef.current = p;
    setChip(p);
    setResults([]);
    setOpen(false);
    onSelectRef.current(p);
  }, [selectedPatientRef]);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    setSearching(true);
    try {
      const res = await patientsApi.search(q, 0, 8);
      const items: Patient[] = res.data.patients ?? [];
      if (items.length === 1) {
        setQuery(`${items[0].first_name} ${items[0].last_name}`);
        doSelect(items[0]);
      } else if (items.length > 1) {
        setResults(items);
        setOpen(true);
      } else {
        setResults([]);
        setOpen(false);
      }
    } catch {} finally { setSearching(false); }
  }, [doSelect]);

  const handleChange = (v: string) => {
    setQuery(v);
    setChip(null);
    selectedPatientRef.current = null;
    onClearRef.current();
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => doSearch(v), 350);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (results.length > 0) doSelect(results[0]);
    }
  };

  if (chip) {
    return (
      <div className="flex items-center justify-between px-3 py-2.5 rounded-lg"
        style={{ background: '#F0FDF4', border: '1px solid #86EFAC' }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: '#BBF7D0', color: '#15803D' }}>
            {chip.first_name[0]}{chip.last_name[0]}
          </div>
          <div>
            <p className="text-body-sm font-semibold" style={{ color: '#15803D' }}>{chip.first_name} {chip.last_name}</p>
            <p className="text-caption" style={{ color: '#16a34a' }}>MRN: {chip.mrn}</p>
          </div>
        </div>
        <button type="button"
          onClick={() => { setChip(null); selectedPatientRef.current = null; onClearRef.current(); setQuery(''); }}
          className="text-xs font-semibold px-2 py-1 rounded-md hover:bg-green-100 transition-colors"
          style={{ color: '#15803D' }}>
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
        <input
          value={query}
          onChange={e => handleChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={handleKeyDown}
          className={`${inputCls} pl-9`}
          style={inputStyle}
          placeholder="Search by name or MRN"
          autoFocus
        />
        {searching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: 'var(--clinical-600)' }} />
        )}
      </div>
      {open && results.length > 0 && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-1 rounded-lg overflow-hidden z-20"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-elevated)' }}>
            {results.map(p => (
              <button key={p.id} type="button"
                onMouseDown={e => { e.preventDefault(); doSelect(p); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[var(--bg-base)] transition-colors">
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                  style={{ background: 'var(--clinical-100)', color: 'var(--clinical-700)' }}>
                  {p.first_name[0]}{p.last_name[0]}
                </div>
                <div>
                  <p className="text-body-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{p.first_name} {p.last_name}</p>
                  <p className="text-caption" style={{ color: 'var(--text-muted)' }}>MRN: {p.mrn}</p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function NewVisitModal({ departments, onSave, onClose }: {
  departments: Department[];
  onSave: (visit: Visit) => void;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<CreateVisitPayload>>({
    visit_type: 'opd',
    priority: 'routine',
  });

  const selectedPatientRef = useRef<Patient | null>(null);

  const set = (k: keyof CreateVisitPayload, v: string) =>
    setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const patient = selectedPatientRef.current;
    if (!patient) {
      toast.error('Please search for and select a patient first.');
      return;
    }
    if (!form.department_id) {
      toast.error('Please select a department.');
      return;
    }
    setSaving(true);
    try {
      const payload: CreateVisitPayload = {
        ...(form as CreateVisitPayload),
        patient_id: patient.id,
      };
      const res = await visitsApi.create(payload);
      toast.success(`Visit ${res.data.visit_number} registered`);
      onSave(res.data);
    } catch (err) {
      const detail =
        typeof err === 'object' &&
        err !== null &&
        'response' in err
          ? (err as { response?: { data?: { detail?: string | { message?: string } } } }).response?.data?.detail
          : undefined;
      toast.error(typeof detail === 'string' ? detail : detail?.message ?? 'Failed to create visit');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <form
          onSubmit={handleSubmit}
          onClick={e => e.stopPropagation()}
          className="w-full max-w-lg rounded-lg overflow-hidden animate-slide-up"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-modal)' }}
        >
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
            <div>
              <h2 className="text-h3" style={{ color: 'var(--text-primary)' }}>Register New Visit</h2>
              <p className="text-caption mt-0.5" style={{ color: 'var(--text-muted)' }}>Create a new patient visit record</p>
            </div>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-base)]" style={{ color: 'var(--text-muted)' }}>
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-6 py-5 space-y-4">
            <Field label="Patient" required>
              <PatientSearch
                selectedPatientRef={selectedPatientRef}
                onSelect={() => {}}
                onClear={() => {}}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Visit Type" required>
                <select value={form.visit_type ?? 'opd'} onChange={e => set('visit_type', e.target.value)} className={inputCls} style={inputStyle}>
                  {VISIT_TYPES.map(vt => <option key={vt.value} value={vt.value}>{vt.label}</option>)}
                </select>
              </Field>
              <Field label="Department" required>
                <select value={form.department_id ?? ''} onChange={e => set('department_id', e.target.value)} className={inputCls} style={inputStyle} required>
                  <option value="">Select department</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Priority">
              <div className="grid grid-cols-4 gap-2">
                {PRIORITIES.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => set('priority', p.value)}
                    className="py-2 rounded-lg text-caption font-semibold border transition-all"
                    style={{
                      background: form.priority === p.value ? p.color + '18' : 'var(--bg-base)',
                      borderColor: form.priority === p.value ? p.color : 'var(--border-default)',
                      color: form.priority === p.value ? p.color : 'var(--text-secondary)',
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Chief Complaint">
              <textarea
                value={form.chief_complaint ?? ''}
                onChange={e => set('chief_complaint', e.target.value)}
                className={inputCls}
                style={{ ...inputStyle, resize: 'none' }}
                rows={2}
                placeholder="Brief description of the patient's complaint"
              />
            </Field>
          </div>

          <div className="flex justify-end gap-3 px-6 py-4" style={{ borderTop: '1px solid var(--border-default)', background: 'var(--bg-base)' }}>
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-body-sm font-semibold border transition-colors hover:bg-[var(--bg-row-hover)]" style={{ color: 'var(--text-primary)', borderColor: 'var(--border-default)' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className="px-5 py-2 rounded-lg text-body-sm font-semibold text-white hover:opacity-90 disabled:opacity-60" style={{ background: 'var(--clinical-600)' }}>
              {saving ? 'Registering' : 'Register Visit'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

export default function VisitManagement() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [visits, setVisits]         = useState<Visit[]>([]);
  const [departments, setDepts]     = useState<Department[]>([]);
  const [isLoading, setLoading]     = useState(false);
  const [showNew, setShowNew]       = useState(searchParams.get('new') === '1');
  const [statusFilter, setFilter]   = useState<string>('all');

  const loadData = async () => {
    setLoading(true);
    try {
      const [visRes, deptRes] = await Promise.all([
        visitsApi.list(),
        departmentsApi.list({ limit: 100 }),
      ]);
      setVisits(Array.isArray(visRes.data) ? visRes.data : []);
      const deptData = deptRes.data as ListResult<Department>;
      const deptList = Array.isArray(deptData) ? deptData : deptData.items ?? [];
      setDepts(deptList);
    } catch {
      toast.error('Failed to load visits');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const activeStatuses = ['registered', 'triaged', 'waiting_for_doctor', 'in_consultation', 'awaiting_results', 'treatment_in_progress', 'admitted', 'in_ward'];
  const filtered = statusFilter === 'all' ? visits
    : statusFilter === 'active' ? visits.filter(v => activeStatuses.includes(v.status))
    : visits.filter(v => v.status === statusFilter);

  const tc = useTableControls<Visit>({
    data: filtered,
    initialSortKey: 'registered_at',
    initialSortDir: 'desc',
    getSortValue: (v, key) => {
      switch (key) {
        case 'visit_number': return v.visit_number;
        case 'patient':      return v.patient_name;
        case 'visit_type':   return v.visit_type;
        case 'status':       return v.status;
        case 'priority':     return v.priority;
        case 'registered_at': return v.registered_at;
        default: return (v as unknown as Record<string, unknown>)[key];
      }
    },
  });

  const priorityStyle = (p: string) => {
    const found = PRIORITIES.find(pr => pr.value === p);
    return found ? { color: found.color, bg: found.color + '14', border: found.color + '40' } : { color: '#475569', bg: '#F8FAFC', border: '#E2E8F0' };
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1" style={{ color: 'var(--text-primary)' }}>Visit Management</h1>
          <p className="text-body-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {visits.filter(v => activeStatuses.includes(v.status)).length} active · {visits.length} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-body-sm font-semibold border transition-colors hover:bg-[var(--bg-base)] disabled:opacity-60"
            style={{ color: 'var(--text-primary)', borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-body-sm font-semibold text-white hover:opacity-90"
            style={{ background: 'var(--clinical-600)' }}
          >
            <Plus className="w-4 h-4" />
            New Visit
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: 'var(--bg-base)', border: '1px solid var(--border-default)' }}>
        {[
          { key: 'all',        label: 'All',        count: visits.length },
          { key: 'active',     label: 'Active',     count: visits.filter(v => activeStatuses.includes(v.status)).length },
          { key: 'discharged', label: 'Discharged', count: visits.filter(v => v.status === 'discharged').length },
          { key: 'cancelled',  label: 'Cancelled',  count: visits.filter(v => v.status === 'cancelled').length },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-body-sm font-semibold transition-colors"
            style={{
              background: statusFilter === tab.key ? 'var(--bg-card)' : 'transparent',
              color: statusFilter === tab.key ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: statusFilter === tab.key ? 'var(--shadow-card)' : 'none',
            }}
          >
            {tab.label}
            <span className="text-caption font-bold px-1.5 rounded-full" style={{ background: statusFilter === tab.key ? 'var(--bg-base)' : 'transparent', color: 'var(--text-muted)' }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-card)' }}>
        <table className="w-full text-body-sm">
          <thead>
            <tr style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border-default)' }}>
              {([
                ['Visit #', 'visit_number'], ['Patient', 'patient'], ['Type', 'visit_type'],
                ['Status', 'status'], ['Priority', 'priority'], ['Registered', 'registered_at'], ['', ''],
              ] as [string, string][]).map(([h, sortK]) => {
                const active = sortK && tc.sortKey === sortK;
                return (
                  <th
                    key={h || 'actions'}
                    onClick={sortK ? () => tc.toggleSort(sortK) : undefined}
                    className={`px-4 py-3 text-left text-caption font-semibold uppercase tracking-wider ${sortK ? 'cursor-pointer select-none' : ''}`}
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {h}
                      {sortK && (active
                        ? (tc.sortDir === 'asc'
                            ? <ChevronUp className="w-3.5 h-3.5" style={{ color: 'var(--clinical-600)' }} />
                            : <ChevronDown className="w-3.5 h-3.5" style={{ color: 'var(--clinical-600)' }} />)
                        : <ChevronsUpDown className="w-3.5 h-3.5" style={{ color: 'var(--text-disabled)' }} />)}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [1,2,3,4,5].map(i => (
                <tr key={i} style={{ borderTop: '1px solid var(--border-default)', background: i % 2 === 0 ? 'var(--bg-base)' : 'var(--bg-card)' }}>
                  {[1,2,3,4,5,6,7].map(j => (
                    <td key={j} className="px-4 py-3"><div className="h-4 rounded animate-shimmer" style={{ width: `${40 + j * 8}%` }} /></td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-body-sm" style={{ color: 'var(--text-muted)' }}>No visits found.</td>
              </tr>
            ) : tc.pageRows.map((v, i) => {
              const st = STATUS_STYLES[v.status] ?? STATUS_STYLES.registered;
              const pr = priorityStyle(v.priority);
              return (
                <tr key={v.id} style={{ borderTop: '1px solid var(--border-default)', background: i % 2 === 1 ? 'var(--bg-base)' : 'var(--bg-card)' }}>
                  <td className="px-4 py-3 font-bold font-mono text-body-sm" style={{ color: 'var(--text-primary)' }}>{v.visit_number}</td>
                  <td className="px-4 py-3 font-semibold" style={{ color: 'var(--text-primary)' }}>
                    <div>
                      <div>{v.patient_name ?? 'Unknown Patient'}</div>
                      {(v.ward_name || v.bed_label) && (
                        <div className="text-caption font-normal mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {[v.ward_name, v.bed_label].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 capitalize" style={{ color: 'var(--text-secondary)' }}>{v.visit_type.replace('_', ' ')}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-caption font-semibold capitalize" style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.color }} />
                      {v.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-caption font-semibold capitalize" style={{ background: pr.bg, color: pr.color, border: `1px solid ${pr.border}` }}>
                      {v.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-caption" style={{ color: 'var(--text-muted)' }}>
                    {new Date(v.registered_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => navigate(`/visits/${v.id}`)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-caption font-semibold border transition-colors hover:bg-[var(--bg-base)]"
                      style={{ color: 'var(--clinical-600)', borderColor: 'var(--border-default)' }}
                    >
                      View <ChevronRight className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!isLoading && filtered.length > 0 && (
          <TablePagination
            page={tc.page} pageCount={tc.pageCount} pageSize={tc.pageSize}
            total={tc.total} rangeStart={tc.rangeStart} rangeEnd={tc.rangeEnd}
            setPage={tc.setPage} setPageSize={tc.setPageSize}
          />
        )}
      </div>

      {showNew && (
        <NewVisitModal
          departments={departments}
          onSave={visit => { setVisits(prev => [visit, ...prev]); setShowNew(false); }}
          onClose={() => setShowNew(false)}
        />
      )}
    </div>
  );
}
