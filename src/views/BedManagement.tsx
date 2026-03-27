import { useState, useEffect, useMemo } from 'react';
import {
  Plus, X, Pencil, RefreshCw, ChevronDown, ChevronRight,
  BedDouble, Building2, Users, Search,
} from 'lucide-react';
import { bedsApi, Bed as BedType, CreateBedPayload } from '../api/beds';
import { departmentsApi, Department } from '../api/departments';
import { patientsApi } from '../api/patients';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

type BedStatus = BedType['status'];

const BED_TYPE_LABELS: Record<BedType['bed_type'], string> = {
  general: 'General', icu: 'ICU', hdu: 'HDU', nicu: 'NICU',
  isolation: 'Isolation', maternity: 'Maternity', birthing: 'Birthing',
  paediatric: 'Paediatric', day_case: 'Day Case',
};

const BED_TYPE_COLORS: Record<BedType['bed_type'], { bg: string; color: string }> = {
  icu:       { bg: '#FEF2F2', color: '#B91C1C' },
  hdu:       { bg: '#FFF7ED', color: '#C2410C' },
  nicu:      { bg: '#FDF4FF', color: '#7E22CE' },
  isolation: { bg: '#F0FDF4', color: '#15803D' },
  maternity: { bg: '#FDF2F8', color: '#BE185D' },
  birthing:  { bg: '#FDF2F8', color: '#BE185D' },
  general:   { bg: '#F8FAFC', color: '#475569' },
  paediatric:{ bg: '#FFFBEB', color: '#92400E' },
  day_case:  { bg: '#F0FDF4', color: '#166534' },
};

const STATUS_CONFIG: Record<BedStatus, { bg: string; color: string; border: string; dot: string; label: string }> = {
  available:   { bg: '#F0FDF4', color: '#15803D', border: '#86EFAC', dot: '#22C55E',  label: 'Available'    },
  occupied:    { bg: '#FEF2F2', color: '#B91C1C', border: '#FCA5A5', dot: '#EF4444',  label: 'Occupied'     },
  reserved:    { bg: '#FFFBEB', color: '#92400E', border: '#FCD34D', dot: '#F59E0B',  label: 'Reserved'     },
  cleaning:    { bg: '#EFF6FF', color: '#1D4ED8', border: '#93C5FD', dot: '#3B82F6',  label: 'Cleaning'     },
  maintenance: { bg: '#F8FAFC', color: '#475569', border: '#CBD5E1', dot: '#94A3B8',  label: 'Maintenance'  },
};

const inputCls = 'w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-colors';
const inputStyle = {
  background: 'var(--bg-base)',
  border: '1px solid var(--border-default)',
  color: 'var(--text-primary)',
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

function BedCell({
  bed, patientName, onEdit, canEdit,
}: {
  bed: BedType; patientName?: string; onEdit: () => void; canEdit: boolean;
}) {
  const cfg = STATUS_CONFIG[bed.status];
  const typeCfg = BED_TYPE_COLORS[bed.bed_type] ?? BED_TYPE_COLORS.general;

  return (
    <div
      className="relative rounded-xl p-3 flex flex-col gap-1.5 transition-shadow hover:shadow-md"
      style={{
        background: cfg.bg,
        border: `1.5px solid ${cfg.border}`,
        minWidth: 120,
      }}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-bold text-sm leading-tight" style={{ color: cfg.color }}>
          {bed.bed_label}
        </span>
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
      </div>

      <p className="text-xs leading-snug font-semibold truncate" style={{ color: cfg.color }}>
        {bed.status === 'occupied' && patientName
          ? patientName
          : cfg.label}
      </p>

      <span
        className="text-caption font-semibold px-1.5 py-0.5 rounded-md self-start"
        style={{ background: typeCfg.bg, color: typeCfg.color, fontSize: 10 }}
      >
        {BED_TYPE_LABELS[bed.bed_type] ?? bed.bed_type}
      </span>

      {canEdit && (
        <button
          onClick={onEdit}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded-md transition-opacity"
          style={{ background: 'rgba(0,0,0,0.07)', color: cfg.color }}
          title="Edit status"
        >
          <Pencil className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

function AddBedModal({ departments, onSave, onClose }: {
  departments: Department[];
  onSave: (bed: BedType) => void;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<CreateBedPayload>>({ bed_type: 'general', status: 'available' });
  const set = (k: keyof CreateBedPayload, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.department_id || !form.ward_name || !form.room_number || !form.bed_label) {
      toast.error('Please fill all required fields.');
      return;
    }
    setSaving(true);
    try {
      const payload: CreateBedPayload = {
        ...form as CreateBedPayload,
        bed_number: form.bed_number || form.room_number || '01',
      };
      const res = await bedsApi.create(payload);
      toast.success(`Bed "${form.bed_label}" created`);
      onSave(res.data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      toast.error(e?.response?.data?.detail ?? 'Failed to create');
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
          className="w-full max-w-lg rounded-2xl overflow-hidden"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-modal)' }}
        >
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
            <div>
              <h2 className="text-h3" style={{ color: 'var(--text-primary)' }}>Add Bed</h2>
              <p className="text-caption mt-0.5" style={{ color: 'var(--text-muted)' }}>Register in a department</p>
            </div>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-base)]" style={{ color: 'var(--text-muted)' }}>
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-6 py-5 space-y-4">
            <Field label="Bed Type" required>
              <select value={form.bed_type ?? 'general'} onChange={e => set('bed_type', e.target.value)} className={inputCls} style={inputStyle}>
                {(Object.keys(BED_TYPE_LABELS) as Array<BedType['bed_type']>).map(t => (
                  <option key={t} value={t}>{BED_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Department" required>
                <select value={form.department_id ?? ''} onChange={e => set('department_id', e.target.value)} className={inputCls} style={inputStyle} required>
                  <option value="">Selectâ€¦</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </Field>
              <Field label="Ward Name" required>
                <input
                  value={form.ward_name ?? ''} onChange={e => set('ward_name', e.target.value)}
                  className={inputCls} style={inputStyle}
                  placeholder="e.g. General Ward A" required
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Room Number" required>
                <input value={form.room_number ?? ''} onChange={e => set('room_number', e.target.value)} className={inputCls} style={inputStyle} placeholder="e.g. R01" required />
              </Field>
              <Field label="Bed Number" required>
                <input value={form.bed_number ?? ''} onChange={e => set('bed_number', e.target.value)} className={inputCls} style={inputStyle} placeholder="e.g. 1" required />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Bed Label" required>
                <input
                  value={form.bed_label ?? ''} onChange={e => set('bed_label', e.target.value)}
                  className={inputCls} style={inputStyle}
                  placeholder="e.g. GMW-R01-B1" required
                />
              </Field>
              <Field label="Initial Status">
                <select value={form.status ?? 'available'} onChange={e => set('status', e.target.value)} className={inputCls} style={inputStyle}>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Notes">
              <textarea
                value={form.notes ?? ''} onChange={e => set('notes', e.target.value)}
                className={inputCls} style={{ ...inputStyle, resize: 'none' }} rows={2}
                placeholder="Optional notesâ€¦"
              />
            </Field>
          </div>

          <div className="flex justify-end gap-3 px-6 py-4" style={{ borderTop: '1px solid var(--border-default)', background: 'var(--bg-base)' }}>
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold border hover:bg-[var(--bg-row-hover)]" style={{ color: 'var(--text-primary)', borderColor: 'var(--border-default)' }}>Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60" style={{ background: 'var(--clinical-600)' }}>
              {saving ? 'Savingâ€¦' : 'Add Bed'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

function EditStatusModal({ bed, onSave, onClose }: {
  bed: BedType; onSave: (u: BedType) => void; onClose: () => void;
}) {
  const [status, setStatus] = useState(bed.status);
  const [notes, setNotes] = useState(bed.notes ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await bedsApi.update(bed.id, { status, notes: notes || undefined });
      toast.success(`"${bed.bed_label}" updated to ${STATUS_CONFIG[status].label}`);
      onSave(res.data);
    } catch {
      toast.error('Failed to update');
    } finally { setSaving(false); }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div onClick={e => e.stopPropagation()} className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-modal)' }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
            <div>
              <h3 className="text-body font-bold" style={{ color: 'var(--text-primary)' }}>{bed.bed_label}</h3>
              <p className="text-caption mt-0.5" style={{ color: 'var(--text-muted)' }}>{bed.ward_name} Â· {BED_TYPE_LABELS[bed.bed_type]}</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-base)]" style={{ color: 'var(--text-muted)' }}><X className="w-4 h-4" /></button>
          </div>
          <div className="px-5 py-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => setStatus(k as BedStatus)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold text-left transition-all"
                  style={{
                    background: status === k ? v.bg : 'var(--bg-base)',
                    border: `1.5px solid ${status === k ? v.border : 'var(--border-default)'}`,
                    color: status === k ? v.color : 'var(--text-muted)',
                  }}
                >
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: v.dot }} />
                  {v.label}
                </button>
              ))}
            </div>
            <Field label="Notes">
              <textarea value={notes} onChange={e => setNotes(e.target.value)} className={inputCls} style={{ ...inputStyle, resize: 'none' }} rows={2} placeholder="Optional notesâ€¦" />
            </Field>
          </div>
          <div className="flex justify-end gap-3 px-5 py-4" style={{ borderTop: '1px solid var(--border-default)', background: 'var(--bg-base)' }}>
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold border hover:bg-[var(--bg-row-hover)]" style={{ color: 'var(--text-primary)', borderColor: 'var(--border-default)' }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60" style={{ background: 'var(--clinical-600)' }}>
              {saving ? 'Savingâ€¦' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function DepartmentAccordion({
  dept, beds, patientNames, onEdit, canEdit, search,
}: {
  dept: Department;
  beds: BedType[];
  patientNames: Record<string, string>;
  onEdit: (b: BedType) => void;
  canEdit: boolean;
  search: string;
}) {
  const [open, setOpen] = useState(false);

  // Filter beds by search
  const filtered = search
    ? beds.filter(b =>
        b.bed_label.toLowerCase().includes(search) ||
        b.ward_name.toLowerCase().includes(search) ||
        (patientNames[b.current_patient_id ?? ''] ?? '').toLowerCase().includes(search)
      )
    : beds;

  // Group by ward
  const byWard = useMemo(() => {
    const map: Record<string, BedType[]> = {};
    for (const b of filtered) {
      if (!map[b.ward_name]) map[b.ward_name] = [];
      map[b.ward_name].push(b);
    }
    return map;
  }, [filtered]);

  const total     = beds.length;
  const available = beds.filter(b => b.status === 'available').length;
  const occupied  = beds.filter(b => b.status === 'occupied').length;
  const pct       = total > 0 ? Math.round((occupied / total) * 100) : 0;
  const nearCap   = pct >= 80;

  // Auto-open when there's a search match
  const hasMatch = search && filtered.length > 0;
  const isOpen = open || !!hasMatch;

  if (search && filtered.length === 0) return null;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-card)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-[var(--bg-row-hover)]"
        style={{ background: 'var(--bg-card)' }}
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(37,99,235,0.1)' }}>
          <Building2 className="w-4.5 h-4.5" style={{ color: 'var(--clinical-600)' }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-body font-bold" style={{ color: 'var(--text-primary)' }}>{dept.name}</span>
            <span className="text-caption font-semibold px-2 py-0.5 rounded-full capitalize" style={{ background: 'var(--surface-1)', color: 'var(--text-muted)', border: '1px solid var(--border-default)' }}>
              {dept.type}
            </span>
            {nearCap && (
              <span className="text-caption font-bold px-2 py-0.5 rounded-full" style={{ background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FCA5A5' }}>
                Near Capacity
              </span>
            )}
          </div>
          <p className="text-caption mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Floor {dept.floor}{dept.wing ? ` Â· Wing ${dept.wing}` : ''} Â· {Object.keys(byWard).length} ward{Object.keys(byWard).length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="hidden sm:flex flex-col items-end gap-1.5 flex-shrink-0">
          <span className="text-caption font-bold tabular-nums" style={{ color: nearCap ? '#B91C1C' : 'var(--text-primary)' }}>
            {occupied}/{total} occupied
          </span>
          <div className="w-32 h-2 rounded-full overflow-hidden" style={{ background: 'var(--border-default)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${pct}%`,
                background: pct >= 80 ? '#EF4444' : pct >= 60 ? '#F59E0B' : '#22C55E',
              }}
            />
          </div>
          <span className="text-caption" style={{ color: '#22C55E' }}>{available} available</span>
        </div>

        <div className="flex-shrink-0 ml-2">
          {isOpen
            ? <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            : <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />}
        </div>
      </button>

      {isOpen && (
        <div className="divide-y" style={{ borderTop: '1px solid var(--border-default)', borderColor: 'var(--border-default)' }}>
          {Object.entries(byWard).map(([wardName, wardBeds]) => {
            const wAvail = wardBeds.filter(b => b.status === 'available').length;
            const wOcc   = wardBeds.filter(b => b.status === 'occupied').length;
            return (
              <div key={wardName} className="px-5 py-4 space-y-3" style={{ background: 'var(--surface-0)' }}>
                <div className="flex items-center gap-3">
                  <BedDouble className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                  <span className="text-body-sm font-bold" style={{ color: 'var(--text-primary)' }}>{wardName}</span>
                  <span className="text-caption ml-auto tabular-nums" style={{ color: 'var(--text-muted)' }}>
                    {wardBeds.length} bed{wardBeds.length !== 1 ? 's' : ''} Â·{' '}
                    <span style={{ color: '#22C55E' }}>{wAvail} free</span>
                    {wOcc > 0 && <span style={{ color: '#EF4444' }}> Â· {wOcc} occupied</span>}
                  </span>
                </div>

                <div className="group grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
                  {wardBeds.map(bed => (
                    <BedCell
                      key={bed.id}
                      bed={bed}
                      patientName={patientNames[bed.current_patient_id ?? '']}
                      onEdit={() => onEdit(bed)}
                      canEdit={canEdit}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {Object.keys(byWard).length === 0 && (
            <p className="px-5 py-6 text-sm text-center" style={{ color: 'var(--text-muted)' }}>No beds in this department yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function BedManagement() {
  const { user } = useAuth();
  const [beds, setBeds]             = useState<BedType[]>([]);
  const [departments, setDepts]     = useState<Department[]>([]);
  const [patientNames, setNames]    = useState<Record<string, string>>({});
  const [isLoading, setLoading]     = useState(false);
  const [showAdd, setShowAdd]       = useState(false);
  const [editBed, setEditBed]       = useState<BedType | null>(null);
  const [search, setSearch]         = useState('');

  const canEdit = user?.role !== 'receptionist';
  const canAdd  = user?.role === 'admin';

  const loadData = async () => {
    setLoading(true);
    try {
      const [bedRes, deptRes] = await Promise.all([
        bedsApi.list(),
        departmentsApi.list({ limit: 100 }),
      ]);
      const bedList: BedType[] = Array.isArray(bedRes.data) ? bedRes.data : [];
      const deptList: Department[] = Array.isArray(deptRes.data)
        ? deptRes.data
        : (deptRes.data as { items?: Department[] }).items ?? [];

      setBeds(bedList);
      setDepts(deptList);

      const patientIds = [...new Set(
        bedList.filter(b => b.current_patient_id).map(b => b.current_patient_id!)
      )];
      if (patientIds.length > 0) {
        const results = await Promise.allSettled(patientIds.map(id => patientsApi.getById(id)));
        const names: Record<string, string> = {};
        results.forEach((r, i) => {
          if (r.status === 'fulfilled') {
            const p = r.value.data;
            names[patientIds[i]] = `${p.first_name} ${p.last_name}`;
          }
        });
        setNames(names);
      }
    } catch {
      toast.error('Failed to load department data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const bedsByDept = useMemo(() => {
    const map: Record<string, BedType[]> = {};
    for (const b of beds) {
      if (!map[b.department_id]) map[b.department_id] = [];
      map[b.department_id].push(b);
    }
    return map;
  }, [beds]);

  const activeDepts  = departments.filter(d => bedsByDept[d.id]?.length);
  const total        = beds.length;
  const available    = beds.filter(b => b.status === 'available').length;
  const occupied     = beds.filter(b => b.status === 'occupied').length;
  const cleaning     = beds.filter(b => b.status === 'cleaning').length;
  const maintenance  = beds.filter(b => b.status === 'maintenance').length;
  const sq           = search.toLowerCase().trim();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-h1" style={{ color: 'var(--text-primary)' }}>Departments & Wards</h1>
          <p className="text-body-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {activeDepts.length} department{activeDepts.length !== 1 ? 's' : ''} Â· {total} beds
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData} disabled={isLoading}
            className="p-2 rounded-lg border transition-colors hover:bg-[var(--bg-base)] disabled:opacity-60"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          {canAdd && (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90"
              style={{ background: 'var(--clinical-600)' }}
            >
              <Plus className="w-4 h-4" /> Add Bed
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total Beds',  value: total,       color: 'var(--text-primary)', bg: 'var(--bg-card)' },
          { label: 'Available',   value: available,   color: '#15803D',             bg: '#F0FDF4' },
          { label: 'Occupied',    value: occupied,    color: '#B91C1C',             bg: '#FEF2F2' },
          { label: 'Cleaning',    value: cleaning,    color: '#1D4ED8',             bg: '#EFF6FF' },
          { label: 'Maintenance', value: maintenance, color: '#475569',             bg: '#F8FAFC' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className="rounded-xl p-4 text-center" style={{ background: bg, border: '1px solid var(--border-default)' }}>
            <p className="text-caption font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</p>
            <p className="text-2xl font-extrabold tabular-nums mt-1" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search bed, ward, or patientâ€¦"
          className="w-full pl-9 pr-4 py-2 text-sm rounded-xl outline-none"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {activeDepts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Users className="w-12 h-12" style={{ color: 'var(--text-muted)' }} />
              <p className="text-body-sm" style={{ color: 'var(--text-muted)' }}>No beds registered yet. Add your first bed to get started.</p>
            </div>
          ) : (
            activeDepts.map(dept => (
              <DepartmentAccordion
                key={dept.id}
                dept={dept}
                beds={bedsByDept[dept.id] ?? []}
                patientNames={patientNames}
                onEdit={setEditBed}
                canEdit={canEdit}
                search={sq}
              />
            ))
          )}
        </div>
      )}

      {showAdd && (
        <AddBedModal
          departments={departments}
          onSave={bed => { setBeds(prev => [...prev, bed]); setShowAdd(false); }}
          onClose={() => setShowAdd(false)}
        />
      )}
      {editBed && (
        <EditStatusModal
          bed={editBed}
          onSave={updated => {
            setBeds(prev => prev.map(b => b.id === updated.id ? updated : b));
            setEditBed(null);
          }}
          onClose={() => setEditBed(null)}
        />
      )}
    </div>
  );
}
