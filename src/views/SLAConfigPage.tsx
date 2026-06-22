import { useState, useEffect } from 'react';
import { Timer, Loader2, RefreshCw, BookOpen, Pill, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { slaApi, SLAConfigEntry, DoseLimitEntry, DoseBand } from '../api/sla';

const PRIORITY_LABELS: Record<string, string> = {
  stat: 'STAT (immediate)',
  nicu: 'NICU',
  urgent: 'Urgent',
  discharge: 'Discharge',
  routine: 'Routine',
  chemo: 'Chemotherapy',
};

// Published standard each default is grounded in (shown next to each row).
const PRIORITY_STANDARD: Record<string, string> = {
  stat: 'Standard: ~15 min pharmacy dispense (ISMP)',
  nicu: 'Tightened for neonatal risk',
  urgent: 'Standard: within 30 min (ISMP/ASHP)',
  discharge: 'Prepared during discharge workflow',
  routine: 'Standard: ~60 min window (ISMP)',
  chemo: 'Extended for safe preparation',
};

const PRIORITY_DESC: Record<string, string> = {
  stat: 'Life-threatening orders that must be dispensed immediately.',
  nicu: 'Neonatal intensive care orders.',
  urgent: 'Time-sensitive orders requiring prompt dispensing.',
  discharge: 'Take-home medications prepared at discharge.',
  routine: 'Standard ward and outpatient orders.',
  chemo: 'Chemotherapy preparations with extended handling time.',
};

export default function SLAConfigPage() {
  const [config, setConfig] = useState<SLAConfigEntry[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [doses, setDoses] = useState<DoseLimitEntry[]>([]);
  const [doseDraft, setDoseDraft] = useState<Record<string, DoseLimitEntry>>({});
  const [savingDose, setSavingDose] = useState<string | null>(null);

  const blankBand: DoseBand = { min_age_years: 0, max_age_years: 120, max_mg_per_kg_day: 0, abs_max_mg_day: 0 };
  const blankDose: DoseLimitEntry = { drug: '', adult_max_single_mg: 0, bands: [{ ...blankBand }] };
  const [newDose, setNewDose] = useState<DoseLimitEntry>(blankDose);
  const [addingDose, setAddingDose] = useState(false);
  const [showAddDose, setShowAddDose] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([slaApi.getConfig(), slaApi.getDoseLimits()])
      .then(([cfg, dl]) => {
        setConfig(cfg.data);
        setDraft(Object.fromEntries(cfg.data.map(c => [c.priority, String(c.threshold_min)])));
        setDoses(dl.data);
        setDoseDraft(Object.fromEntries(dl.data.map(d => [d.drug, JSON.parse(JSON.stringify(d))])));
      })
      .catch(() => toast.error('Failed to load configuration'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const validateDose = (entry: DoseLimitEntry): string | null => {
    if (entry.adult_max_single_mg <= 0) return 'Adult max single dose must be greater than 0';
    if (!entry.bands.length) return 'Add at least one age band';
    for (const b of entry.bands) {
      if (b.max_age_years <= b.min_age_years) return 'Each band: max age must be greater than min age';
      if (b.abs_max_mg_day <= 0) return 'Each band: absolute max/day must be greater than 0';
      if (b.max_mg_per_kg_day < 0) return 'mg/kg/day cannot be negative';
    }
    return null;
  };

  const setBandField = (drug: string, idx: number, field: keyof DoseBand, value: number) => {
    setDoseDraft(prev => {
      const e = prev[drug];
      const bands = e.bands.map((b, i) => i === idx ? { ...b, [field]: value } : b);
      return { ...prev, [drug]: { ...e, bands } };
    });
  };

  const addBandToDraft = (drug: string) => {
    setDoseDraft(prev => ({ ...prev, [drug]: { ...prev[drug], bands: [...prev[drug].bands, { ...blankBand }] } }));
  };

  const removeBandFromDraft = (drug: string, idx: number) => {
    setDoseDraft(prev => ({ ...prev, [drug]: { ...prev[drug], bands: prev[drug].bands.filter((_, i) => i !== idx) } }));
  };

  const saveDose = async (drug: string) => {
    const entry = doseDraft[drug];
    const err = validateDose(entry);
    if (err) { toast.error(err); return; }
    setSavingDose(drug);
    try {
      const res = await slaApi.updateDoseLimit(entry);
      setDoses(prev => prev.map(d => d.drug === drug ? res.data : d));
      toast.success(`${drug} dose limits updated`);
    } catch {
      toast.error('Failed to update dose limits');
    } finally {
      setSavingDose(null);
    }
  };

  const addDose = async () => {
    const entry = { ...newDose, drug: newDose.drug.trim().toLowerCase() };
    if (!entry.drug) { toast.error('Enter a drug name'); return; }
    if (doses.some(d => d.drug === entry.drug)) { toast.error('That drug already exists; edit it below'); return; }
    const err = validateDose(entry);
    if (err) { toast.error(err); return; }
    setAddingDose(true);
    try {
      const res = await slaApi.updateDoseLimit(entry);
      setDoses(prev => [...prev, res.data].sort((a, b) => a.drug.localeCompare(b.drug)));
      setDoseDraft(prev => ({ ...prev, [res.data.drug]: JSON.parse(JSON.stringify(res.data)) }));
      setNewDose({ drug: '', adult_max_single_mg: 0, bands: [{ ...blankBand }] });
      setShowAddDose(false);
      toast.success(`${entry.drug} added`);
    } catch {
      toast.error('Failed to add drug');
    } finally {
      setAddingDose(false);
    }
  };

  const save = async (priority: string) => {
    const val = Number(draft[priority]);
    if (!val || val <= 0) {
      toast.error('Threshold must be a number greater than 0');
      return;
    }
    setSavingId(priority);
    try {
      const res = await slaApi.updateConfig(priority, val);
      setConfig(prev => prev.map(c => c.priority === priority ? res.data : c));
      toast.success(`${PRIORITY_LABELS[priority] ?? priority} SLA set to ${val} min`);
    } catch {
      toast.error('Failed to update SLA threshold');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-h1" style={{ color: 'var(--text-primary)' }}>SLA Configuration</h1>
          <p className="text-body-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Turnaround-time thresholds per prescription priority. A prescription breaches SLA when its pharmacy time exceeds the threshold; a warning fires at 75% of it.
          </p>
        </div>
        <button
          onClick={load} disabled={loading}
          className="p-2 rounded-lg border transition-colors hover:bg-[var(--bg-base)] disabled:opacity-60"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div
        className="flex items-start gap-3 px-4 py-3 rounded-lg"
        style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)' }}
      >
        <BookOpen className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--clinical-600)' }} />
        <p className="text-caption" style={{ color: 'var(--text-secondary)' }}>
          Defaults follow published medication-administration standards: STAT orders dispense within
          ~15 minutes and reach the patient within ~30 minutes; urgent orders within ~30 minutes; routine
          orders within a ~60-minute window (ISMP / ASHP guidance). Adjust per your facility's policy;
          every change is recorded in the audit trail.
        </p>
      </div>

      <div className="overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-card)' }}>
        <div className="flex items-center gap-2 px-5 py-3.5" style={{ borderBottom: '1px solid var(--border-default)', background: 'var(--surface-1)' }}>
          <Timer className="w-4 h-4" style={{ color: 'var(--clinical-600)' }} />
          <span className="text-body-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Pharmacy Turnaround Thresholds</span>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm px-5 py-8" style={{ color: 'var(--text-muted)' }}>
            <Loader2 className="w-4 h-4 animate-spin" /> Loading thresholds…
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border-default)' }}>
            {config.map(c => {
              const dirty = draft[c.priority] !== String(c.threshold_min);
              return (
                <div key={c.priority} className="flex items-center gap-4 px-5 py-4 flex-wrap">
                  <div className="flex-1 min-w-[180px]">
                    <p className="text-body-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{PRIORITY_LABELS[c.priority] ?? c.priority}</p>
                    <p className="text-caption mt-0.5" style={{ color: 'var(--text-muted)' }}>{PRIORITY_DESC[c.priority] ?? ''}</p>
                    {PRIORITY_STANDARD[c.priority] && (
                      <p className="text-meta mt-1" style={{ color: 'var(--clinical-600)' }}>{PRIORITY_STANDARD[c.priority]}</p>
                    )}
                  </div>

                  <div className="text-right">
                    <p className="text-caption" style={{ color: 'var(--text-muted)' }}>Warning at</p>
                    <p className="text-body-sm font-semibold tabular-nums" style={{ color: '#C2410C' }}>{c.warning_min} min</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <input
                        type="number"
                        min={1}
                        value={draft[c.priority] ?? ''}
                        onChange={e => setDraft(prev => ({ ...prev, [c.priority]: e.target.value }))}
                        className="w-28 pl-3 pr-10 py-1.5 rounded-lg text-sm text-right outline-none"
                        style={{ background: 'var(--bg-base)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-caption" style={{ color: 'var(--text-muted)' }}>min</span>
                    </div>
                    <button
                      onClick={() => save(c.priority)}
                      disabled={!dirty || savingId === c.priority}
                      className="flex items-center justify-center gap-1 w-20 px-3 py-1.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-40"
                      style={{ background: 'var(--clinical-600)' }}
                    >
                      {savingId === c.priority ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Prescription dosing limits used by the audit engine */}
      <div className="overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-card)' }}>
        <div className="flex items-center gap-2 px-5 py-3.5" style={{ borderBottom: '1px solid var(--border-default)', background: 'var(--surface-1)' }}>
          <Pill className="w-4 h-4" style={{ color: 'var(--clinical-600)' }} />
          <span className="text-body-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Prescription Dosing Limits</span>
          <span className="text-caption ml-1 hidden sm:inline" style={{ color: 'var(--text-muted)' }}>weight/age dose checks</span>
          <button
            onClick={() => setShowAddDose(v => !v)}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-caption font-semibold text-white"
            style={{ background: 'var(--clinical-600)' }}
          >
            <Plus className="w-3.5 h-3.5" /> Add Drug
          </button>
        </div>

        <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--border-default)' }}>
          <p className="text-caption" style={{ color: 'var(--text-muted)' }}>
            Each drug has age bands. A prescription is checked against the band matching the patient's age (weight-based mg/kg/day and an absolute daily ceiling). A drug with no band for the patient's age is flagged.
          </p>
        </div>

        {showAddDose && (
          <div className="px-5 py-4 space-y-3" style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border-default)' }}>
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-meta mb-1" style={{ color: 'var(--text-muted)' }}>Drug name</label>
                <input
                  value={newDose.drug}
                  onChange={e => setNewDose(p => ({ ...p, drug: e.target.value }))}
                  placeholder="e.g. ceftriaxone"
                  className="w-44 px-2 py-1.5 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="block text-meta mb-1" style={{ color: 'var(--text-muted)' }}>Adult max single dose (mg)</label>
                <input
                  type="number" min={0}
                  value={String(newDose.adult_max_single_mg)}
                  onChange={e => setNewDose(p => ({ ...p, adult_max_single_mg: Number(e.target.value) }))}
                  className="w-40 px-2 py-1.5 rounded-lg text-sm text-right outline-none"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                />
              </div>
            </div>
            <BandEditor
              bands={newDose.bands}
              onChange={(idx, field, v) => setNewDose(p => ({ ...p, bands: p.bands.map((b, i) => i === idx ? { ...b, [field]: v } : b) }))}
              onAdd={() => setNewDose(p => ({ ...p, bands: [...p.bands, { ...blankBand }] }))}
              onRemove={idx => setNewDose(p => ({ ...p, bands: p.bands.filter((_, i) => i !== idx) }))}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowAddDose(false); }} className="px-3 py-1.5 rounded-lg text-sm border" style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>Cancel</button>
              <button
                onClick={addDose}
                disabled={addingDose || !newDose.drug.trim()}
                className="flex items-center gap-1 px-4 py-1.5 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
                style={{ background: 'var(--clinical-700)' }}
              >
                {addingDose ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Drug'}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-sm px-5 py-8" style={{ color: 'var(--text-muted)' }}>
            <Loader2 className="w-4 h-4 animate-spin" /> Loading dose limits…
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border-default)' }}>
            {doses.map(d => {
              const dr = doseDraft[d.drug];
              if (!dr) return null;
              const dirty = JSON.stringify(dr) !== JSON.stringify(d);
              return (
                <div key={d.drug} className="px-5 py-4">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-body-sm font-semibold capitalize" style={{ color: 'var(--text-primary)' }}>{d.drug}</span>
                    <label className="flex items-center gap-1.5 text-caption" style={{ color: 'var(--text-muted)' }}>
                      Adult max single (mg)
                      <input
                        type="number" min={0}
                        value={String(dr.adult_max_single_mg)}
                        onChange={e => setDoseDraft(prev => ({ ...prev, [d.drug]: { ...prev[d.drug], adult_max_single_mg: Number(e.target.value) } }))}
                        className="w-24 px-2 py-1 rounded-lg text-sm text-right outline-none"
                        style={{ background: 'var(--bg-base)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                      />
                    </label>
                    <button
                      onClick={() => saveDose(d.drug)}
                      disabled={!dirty || savingDose === d.drug}
                      className="ml-auto flex items-center justify-center gap-1 w-20 px-3 py-1.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-40"
                      style={{ background: 'var(--clinical-600)' }}
                    >
                      {savingDose === d.drug ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                    </button>
                  </div>
                  <BandEditor
                    bands={dr.bands}
                    onChange={(idx, field, v) => setBandField(d.drug, idx, field, v)}
                    onAdd={() => addBandToDraft(d.drug)}
                    onRemove={idx => removeBandFromDraft(d.drug, idx)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Editable list of age bands for one drug.
function BandEditor({ bands, onChange, onAdd, onRemove }: {
  bands: DoseBand[];
  onChange: (idx: number, field: keyof DoseBand, value: number) => void;
  onAdd: () => void;
  onRemove: (idx: number) => void;
}) {
  const cell = (idx: number, field: keyof DoseBand, step?: number) => (
    <input
      type="number" min={0} step={step}
      value={String(bands[idx][field])}
      onChange={e => onChange(idx, field, Number(e.target.value))}
      className="w-20 px-2 py-1 rounded-lg text-sm text-right outline-none"
      style={{ background: 'var(--bg-base)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
    />
  );
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 px-1">
        {['Min age (yrs)', 'Max age (yrs)', 'Max per kg (mg/kg/day)', 'Absolute max/day (mg)', ''].map((h, i) => (
          <span key={i} className="text-meta font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</span>
        ))}
      </div>
      {bands.map((_, idx) => (
        <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-center">
          {cell(idx, 'min_age_years', 0.25)}
          {cell(idx, 'max_age_years', 0.25)}
          {cell(idx, 'max_mg_per_kg_day')}
          {cell(idx, 'abs_max_mg_day')}
          <button
            onClick={() => onRemove(idx)}
            disabled={bands.length <= 1}
            className="p-1.5 rounded-md disabled:opacity-30"
            style={{ color: '#DC2626' }}
            title="Remove band"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button
        onClick={onAdd}
        className="flex items-center gap-1 text-caption font-semibold"
        style={{ color: 'var(--clinical-600)' }}
      >
        <Plus className="w-3.5 h-3.5" /> Add age band
      </button>
    </div>
  );
}
