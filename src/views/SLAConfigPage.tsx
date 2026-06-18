import { useState, useEffect } from 'react';
import { Timer, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { slaApi, SLAConfigEntry } from '../api/sla';

const PRIORITY_LABELS: Record<string, string> = {
  stat: 'STAT (immediate)',
  nicu: 'NICU',
  urgent: 'Urgent',
  discharge: 'Discharge',
  routine: 'Routine',
  chemo: 'Chemotherapy',
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

  const load = () => {
    setLoading(true);
    slaApi.getConfig()
      .then(res => {
        setConfig(res.data);
        setDraft(Object.fromEntries(res.data.map(c => [c.priority, String(c.threshold_min)])));
      })
      .catch(() => toast.error('Failed to load SLA configuration'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

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
    </div>
  );
}
