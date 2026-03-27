import { useState, useEffect, useMemo } from 'react';
import { X, Pencil, RefreshCw, Building2, DoorOpen, Plus } from 'lucide-react';
import { consultationRoomsApi, ConsultationRoom, CreateConsultationRoomPayload } from '../api/consultationRooms';
import { departmentsApi, Department } from '../api/departments';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

type RoomStatus = ConsultationRoom['status'];

const ROOM_STATUS_CONFIG: Record<RoomStatus, { bg: string; color: string; border: string; dot: string; label: string }> = {
  available: { bg: '#F0FDF4', color: '#15803D', border: '#86EFAC', dot: '#22C55E', label: 'Available' },
  occupied:  { bg: '#FEF2F2', color: '#B91C1C', border: '#FCA5A5', dot: '#EF4444', label: 'Occupied'  },
  cleaning:  { bg: '#EFF6FF', color: '#1D4ED8', border: '#93C5FD', dot: '#3B82F6', label: 'Cleaning'  },
  reserved:  { bg: '#FFFBEB', color: '#92400E', border: '#FCD34D', dot: '#F59E0B', label: 'Reserved'  },
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

function RoomCell({ room, onEdit, canEdit }: {
  room: ConsultationRoom; onEdit: () => void; canEdit: boolean;
}) {
  const cfg = ROOM_STATUS_CONFIG[room.status];
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-2"
      style={{ background: cfg.bg, border: `1.5px solid ${cfg.border}` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-sm" style={{ color: cfg.color }}>{room.room_name}</p>
          <p className="text-caption mt-0.5" style={{ color: cfg.color, opacity: 0.8 }}>
            {room.room_number}{room.floor ? ` Â· Floor ${room.floor}` : ''}
          </p>
        </div>
        <span
          className="flex items-center gap-1 text-caption font-bold px-2 py-0.5 rounded-full flex-shrink-0"
          style={{ background: 'rgba(0,0,0,0.06)', color: cfg.color }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.dot }} />
          {cfg.label}
        </span>
      </div>

      {room.current_doctor_name && (
        <p className="text-xs font-semibold" style={{ color: cfg.color }}>
          Doctor: {room.current_doctor_name}
        </p>
      )}
      {room.status === 'occupied' && room.current_patient_name && (
        <p className="text-xs font-semibold" style={{ color: cfg.color }}>
          Patient: {room.current_patient_name}
        </p>
      )}
      {room.notes && (
        <p className="text-caption italic truncate" style={{ color: cfg.color, opacity: 0.7 }}>{room.notes}</p>
      )}

      {canEdit && (
        <button
          onClick={onEdit}
          className="flex items-center gap-1 text-caption font-semibold px-2 py-1 rounded-lg border self-start mt-1 hover:opacity-80 transition-opacity"
          style={{ borderColor: cfg.border, color: cfg.color }}
        >
          <Pencil className="w-3 h-3" /> Update
        </button>
      )}
    </div>
  );
}

function EditRoomStatusModal({ room, onSave, onClose }: {
  room: ConsultationRoom;
  onSave: (u: ConsultationRoom) => void;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<RoomStatus>(room.status);
  const [notes, setNotes]   = useState(room.notes ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await consultationRoomsApi.update(room.id, { status, notes: notes || undefined });
      toast.success(`"${room.room_name}" updated to ${ROOM_STATUS_CONFIG[status].label}`);
      onSave(res.data);
    } catch {
      toast.error('Failed to update room');
    } finally { setSaving(false); }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div onClick={e => e.stopPropagation()} className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-modal)' }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
            <div>
              <h3 className="text-body font-bold" style={{ color: 'var(--text-primary)' }}>{room.room_name}</h3>
              <p className="text-caption mt-0.5" style={{ color: 'var(--text-muted)' }}>{room.room_number}</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-base)]" style={{ color: 'var(--text-muted)' }}><X className="w-4 h-4" /></button>
          </div>
          <div className="px-5 py-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {(Object.entries(ROOM_STATUS_CONFIG) as [RoomStatus, typeof ROOM_STATUS_CONFIG[RoomStatus]][]).map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => setStatus(k)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold text-left transition-all"
                  style={{
                    background: status === k ? v.bg   : 'var(--bg-base)',
                    border:    `1.5px solid ${status === k ? v.border : 'var(--border-default)'}`,
                    color:      status === k ? v.color : 'var(--text-muted)',
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

function AddRoomModal({ departments, onSave, onClose }: {
  departments: Department[];
  onSave: (r: ConsultationRoom) => void;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<CreateConsultationRoomPayload>>({ status: 'available' });
  const set = (k: keyof CreateConsultationRoomPayload, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.department_id || !form.room_number || !form.room_name) {
      toast.error('Please fill all required fields.');
      return;
    }
    setSaving(true);
    try {
      const res = await consultationRoomsApi.create(form as CreateConsultationRoomPayload);
      toast.success(`Room "${form.room_name}" created`);
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
          className="w-full max-w-md rounded-2xl overflow-hidden"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-modal)' }}
        >
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
            <div>
              <h2 className="text-h3" style={{ color: 'var(--text-primary)' }}>Add Consultation Room</h2>
              <p className="text-caption mt-0.5" style={{ color: 'var(--text-muted)' }}>Register a new room</p>
            </div>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-base)]" style={{ color: 'var(--text-muted)' }}>
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-6 py-5 space-y-4">
            <Field label="Department" required>
              <select value={form.department_id ?? ''} onChange={e => set('department_id', e.target.value)} className={inputCls} style={inputStyle} required>
                <option value="">Selectâ€¦</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Room Number" required>
                <input value={form.room_number ?? ''} onChange={e => set('room_number', e.target.value)} className={inputCls} style={inputStyle} placeholder="e.g. OPD-CR-01" required />
              </Field>
              <Field label="Floor">
                <input value={form.floor ?? ''} onChange={e => set('floor', e.target.value)} className={inputCls} style={inputStyle} placeholder="e.g. G" />
              </Field>
            </div>

            <Field label="Room Name" required>
              <input value={form.room_name ?? ''} onChange={e => set('room_name', e.target.value)} className={inputCls} style={inputStyle} placeholder="e.g. Consultation Room 1" required />
            </Field>

            <Field label="Initial Status">
              <select value={form.status ?? 'available'} onChange={e => set('status', e.target.value)} className={inputCls} style={inputStyle}>
                {(Object.entries(ROOM_STATUS_CONFIG) as [RoomStatus, typeof ROOM_STATUS_CONFIG[RoomStatus]][]).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </Field>

            <Field label="Notes">
              <textarea value={form.notes ?? ''} onChange={e => set('notes', e.target.value)} className={inputCls} style={{ ...inputStyle, resize: 'none' }} rows={2} placeholder="Optional notesâ€¦" />
            </Field>
          </div>

          <div className="flex justify-end gap-3 px-6 py-4" style={{ borderTop: '1px solid var(--border-default)', background: 'var(--bg-base)' }}>
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold border hover:bg-[var(--bg-row-hover)]" style={{ color: 'var(--text-primary)', borderColor: 'var(--border-default)' }}>Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60" style={{ background: 'var(--clinical-600)' }}>
              {saving ? 'Savingâ€¦' : 'Add Room'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

export default function ConsultationRoomManagement() {
  const { user } = useAuth();
  const [rooms, setRooms]           = useState<ConsultationRoom[]>([]);
  const [departments, setDepts]     = useState<Department[]>([]);
  const [isLoading, setLoading]     = useState(false);
  const [editRoom, setEditRoom]     = useState<ConsultationRoom | null>(null);
  const [showAdd, setShowAdd]       = useState(false);

  const canEdit = ['admin', 'nurse', 'receptionist', 'doctor'].includes(user?.role ?? '');
  const canAdd  = user?.role === 'admin';

  const loadData = async () => {
    setLoading(true);
    try {
      const [roomRes, deptRes] = await Promise.all([
        consultationRoomsApi.list(),
        departmentsApi.list({ limit: 100 }),
      ]);
      setRooms(Array.isArray(roomRes.data) ? roomRes.data : []);
      const deptData = deptRes.data;
      setDepts(Array.isArray(deptData) ? deptData : (deptData as { items?: Department[] }).items ?? []);
    } catch {
      toast.error('Failed to load consultation rooms');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const deptMap = useMemo(
    () => Object.fromEntries(departments.map(d => [d.id, d.name])),
    [departments]
  );

  const byDept = useMemo(() => {
    const map: Record<string, ConsultationRoom[]> = {};
    for (const r of rooms) {
      const key = deptMap[r.department_id] ?? r.department_id;
      if (!map[key]) map[key] = [];
      map[key].push(r);
    }
    return map;
  }, [rooms, deptMap]);

  const available = rooms.filter(r => r.status === 'available').length;
  const occupied  = rooms.filter(r => r.status === 'occupied').length;
  const cleaning  = rooms.filter(r => r.status === 'cleaning').length;
  const reserved  = rooms.filter(r => r.status === 'reserved').length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-h1" style={{ color: 'var(--text-primary)' }}>Consultation Rooms</h1>
          <p className="text-body-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {rooms.length} room{rooms.length !== 1 ? 's' : ''} Â· {available} available
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
              <Plus className="w-4 h-4" /> Add Room
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total',     value: rooms.length, color: 'var(--text-primary)', bg: 'var(--bg-card)' },
          { label: 'Available', value: available,    color: '#15803D',             bg: '#F0FDF4' },
          { label: 'Occupied',  value: occupied,     color: '#B91C1C',             bg: '#FEF2F2' },
          { label: 'Cleaning',  value: cleaning + reserved, color: '#1D4ED8',      bg: '#EFF6FF' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className="rounded-xl p-4 text-center" style={{ background: bg, border: '1px solid var(--border-default)' }}>
            <p className="text-caption font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</p>
            <p className="text-2xl font-extrabold tabular-nums mt-1" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="h-32 rounded-2xl animate-pulse" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }} />
          ))}
        </div>
      ) : rooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <DoorOpen className="w-12 h-12" style={{ color: 'var(--text-muted)' }} />
          <p className="text-body-sm font-semibold" style={{ color: 'var(--text-muted)' }}>No consultation rooms registered</p>
          {canAdd && (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 mt-1"
              style={{ background: 'var(--clinical-600)' }}
            >
              <Plus className="w-4 h-4" /> Add first room
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(byDept).map(([deptName, deptRooms]) => (
            <div key={deptName} className="space-y-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                <span className="text-body-sm font-bold" style={{ color: 'var(--text-primary)' }}>{deptName}</span>
                <span className="text-caption" style={{ color: 'var(--text-muted)' }}>
                  â€” {deptRooms.length} room{deptRooms.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                {deptRooms.map(r => (
                  <RoomCell
                    key={r.id}
                    room={r}
                    onEdit={() => setEditRoom(r)}
                    canEdit={canEdit}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <AddRoomModal
          departments={departments}
          onSave={room => { setRooms(prev => [...prev, room]); setShowAdd(false); }}
          onClose={() => setShowAdd(false)}
        />
      )}
      {editRoom && (
        <EditRoomStatusModal
          room={editRoom}
          onSave={updated => {
            setRooms(prev => prev.map(r => r.id === updated.id ? updated : r));
            setEditRoom(null);
          }}
          onClose={() => setEditRoom(null)}
        />
      )}
    </div>
  );
}
