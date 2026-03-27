import React, { useEffect } from 'react';
import {
  ResponsiveContainer,
  BarChart, Bar,
  AreaChart, Area,
  XAxis, YAxis,
  Tooltip, CartesianGrid,
} from 'recharts';
import {
  Download, Clock, TrendingUp, AlertTriangle, CheckCircle,
  FileText, Loader2, Calendar, Flag, BarChart2, Zap,
} from 'lucide-react';
import { useAnalyticsViewModel } from '../viewModels/useAnalyticsViewModel';

function formatMinutes(minutes: number): string {
  if (!minutes || isNaN(minutes)) return 'N/A';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl ${className}`}
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-card)' }}
    >
      {children}
    </div>
  );
}

interface KpiProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  accentColor: string;
}
function KpiCard({ label, value, sub, icon, accentColor }: KpiProps) {
  return (
    <Card>
      <div className="flex items-start gap-4 p-5" style={{ borderLeft: `3px solid ${accentColor}` }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${accentColor}18` }}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-caption font-semibold uppercase tracking-wider truncate" style={{ color: 'var(--text-muted)' }}>{label}</p>
          <p className="text-2xl font-extrabold tabular-nums mt-0.5 leading-none" style={{ color: 'var(--text-primary)' }}>{value}</p>
          {sub && <p className="text-caption mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
        </div>
      </div>
    </Card>
  );
}

function DarkTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="px-3 py-2 rounded-lg text-sm" style={{ background: '#1E293B', color: '#F8FAFC', boxShadow: 'var(--shadow-elevated)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <p className="font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.7)' }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="tabular-nums">{p.name}: <span className="font-bold">{p.value} min</span></p>
      ))}
    </div>
  );
}

export default function AnalyticsDashboard() {
  const vm = useAnalyticsViewModel();

  useEffect(() => {
    vm.loadMetrics();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApply = () => vm.loadMetrics();

  const handleReset = () => {
    vm.setDateRange('', '');
    setTimeout(() => vm.loadMetrics(), 0);
  };

  /* Build stage chart data */
  const stageData = vm.metrics ? [
    { stage: 'Order â†’ Verify',   minutes: Math.round(vm.metrics.average_order_to_verify_minutes ?? 0) },
    { stage: 'Verify â†’ Dispense', minutes: Math.round(vm.metrics.average_verify_to_dispense_minutes ?? 0) },
    { stage: 'Dispense â†’ Admin',  minutes: Math.round(vm.metrics.average_dispense_to_administer_minutes ?? 0) },
  ] : [];

  /* Simulated daily-trend area from slowest prescriptions (last 7) */
  const trendData = vm.metrics?.slowest_prescriptions
    ? [...vm.metrics.slowest_prescriptions]
        .sort((a, b) => new Date(a.ordered_at).getTime() - new Date(b.ordered_at).getTime())
        .slice(-7)
        .map((p, i) => ({
          day: `#${i + 1}`,
          tat: Math.round(p.total_tat_minutes),
        }))
    : [];

  const completionRate = vm.metrics
    ? vm.metrics.total_prescriptions > 0
      ? Math.round((vm.metrics.completed_prescriptions / vm.metrics.total_prescriptions) * 100)
      : 0
    : null;

  const slowest = vm.metrics?.slowest_prescriptions ?? [];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div
        style={{
          background: 'linear-gradient(135deg, #0F172A 0%, #1E3A5F 60%, #1D4ED8 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}
      >
        <div className="px-7 py-6">
          <p className="text-caption font-bold mb-1.5" style={{ color: 'rgba(255,255,255,0.55)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Analytics
          </p>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-bold text-white">Turnaround Time Report</h1>
              <p className="text-body-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>

            <div className="flex items-end gap-2 flex-wrap">
              <div>
                <p className="text-[10px] font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>From</p>
                <input
                  type="date"
                  value={vm.dateRange.from}
                  onChange={e => vm.setDateRange(e.target.value, vm.dateRange.to)}
                  className="px-2.5 py-1.5 rounded-lg text-sm tabular-nums focus:outline-none"
                  style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', colorScheme: 'dark' }}
                />
              </div>
              <div>
                <p className="text-[10px] font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>To</p>
                <input
                  type="date"
                  value={vm.dateRange.to}
                  onChange={e => vm.setDateRange(vm.dateRange.from, e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg text-sm tabular-nums focus:outline-none"
                  style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', colorScheme: 'dark' }}
                />
              </div>
              <button
                onClick={handleApply}
                disabled={vm.isLoading}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors"
                style={{ background: '#2563EB', color: '#fff' }}
              >
                Apply
              </button>
              <button
                onClick={handleReset}
                className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)' }}
              >
                Reset
              </button>
              <button
                onClick={vm.exportCSV}
                disabled={vm.isLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' }}
              >
                {vm.isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                Export CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-7 py-5 space-y-5" style={{ background: 'var(--bg-base)' }}>

        {vm.error && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--status-critical-bg)', border: '1px solid var(--status-critical-border)', color: 'var(--status-critical-text)' }}>
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {vm.error}
          </div>
        )}

        {vm.isLoading && !vm.metrics && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 rounded-xl animate-shimmer" />
            ))}
          </div>
        )}

        {vm.metrics && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <KpiCard
                label="Total Rx"
                value={vm.metrics.total_prescriptions}
                icon={<FileText className="w-4 h-4" style={{ color: '#2563EB' }} />}
                accentColor="#2563EB"
              />
              <KpiCard
                label="Completed"
                value={vm.metrics.completed_prescriptions}
                sub={completionRate !== null ? `${completionRate}% completion` : undefined}
                icon={<CheckCircle className="w-4 h-4" style={{ color: '#059669' }} />}
                accentColor="#059669"
              />
              <KpiCard
                label="Avg Total TAT"
                value={formatMinutes(vm.metrics.average_total_tat_minutes)}
                sub="Order to administration"
                icon={<Clock className="w-4 h-4" style={{ color: '#D97706' }} />}
                accentColor="#D97706"
              />
              <KpiCard
                label="Flagged"
                value={vm.metrics.flagged_count}
                sub={`${vm.metrics.resolved_flags_count} resolved`}
                icon={<Flag className="w-4 h-4" style={{ color: '#DC2626' }} />}
                accentColor="#DC2626"
              />
              <KpiCard
                label="Resolution Rate"
                value={`${Math.round((vm.metrics.resolution_rate ?? 0) * 100)}%`}
                icon={<TrendingUp className="w-4 h-4" style={{ color: '#7C3AED' }} />}
                accentColor="#7C3AED"
              />
            </div>

            {vm.isLoading && (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm" style={{ background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.15)', color: '#2563EB' }}>
                <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                Refreshing analytics data…
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

              <Card className="lg:col-span-3">
                <div className="flex items-center justify-between px-5 pt-5 pb-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(37,99,235,0.1)' }}>
                      <BarChart2 className="w-3.5 h-3.5" style={{ color: '#2563EB' }} />
                    </div>
                    <div>
                      <h2 className="text-body font-semibold" style={{ color: 'var(--text-primary)' }}>Average TAT per Stage</h2>
                      <p className="text-caption" style={{ color: 'var(--text-muted)' }}>Minutes from order to administration</p>
                    </div>
                  </div>
                  <span className="text-caption font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(37,99,235,0.1)', color: '#2563EB' }}>
                    {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
                <div className="px-4 py-5">
                  {stageData.every(d => d.minutes === 0) ? (
                    <div className="flex items-center justify-center h-52 text-sm" style={{ color: 'var(--text-muted)' }}>
                      No stage TAT data available for the selected period.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={stageData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-3)" vertical={false} />
                        <XAxis
                          dataKey="stage"
                          tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                          axisLine={false} tickLine={false}
                        />
                        <YAxis
                          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                          axisLine={false} tickLine={false}
                          unit=" m"
                        />
                        <Tooltip content={<DarkTooltip />} />
                        <Bar dataKey="minutes" name="Avg TAT" fill="#2563EB" radius={[6, 6, 0, 0]} maxBarSize={72} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </Card>

              <Card className="lg:col-span-2">
                <div className="flex items-center gap-2.5 px-5 pt-5 pb-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(220,38,38,0.1)' }}>
                    <TrendingUp className="w-3.5 h-3.5" style={{ color: '#DC2626' }} />
                  </div>
                  <div>
                    <h2 className="text-body font-semibold" style={{ color: 'var(--text-primary)' }}>Slowest Prescriptions</h2>
                    <p className="text-caption" style={{ color: 'var(--text-muted)' }}>TAT trend (longest cases)</p>
                  </div>
                </div>
                <div className="px-4 py-5">
                  {trendData.length === 0 ? (
                    <div className="flex items-center justify-center h-52 text-sm" style={{ color: 'var(--text-muted)' }}>
                      No data available.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={trendData} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
                        <defs>
                          <linearGradient id="tatGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#DC2626" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#DC2626" stopOpacity={0.03} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-3)" vertical={false} />
                        <XAxis
                          dataKey="day"
                          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                          axisLine={false} tickLine={false}
                        />
                        <YAxis
                          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                          axisLine={false} tickLine={false}
                          unit=" m"
                        />
                        <Tooltip content={<DarkTooltip />} />
                        <Area
                          type="monotone"
                          dataKey="tat"
                          name="TAT"
                          stroke="#DC2626"
                          strokeWidth={2}
                          fill="url(#tatGrad)"
                          dot={{ fill: '#DC2626', r: 3 }}
                          activeDot={{ r: 5, fill: '#DC2626' }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

              <Card className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.1)' }}>
                    <CheckCircle className="w-3.5 h-3.5" style={{ color: '#7C3AED' }} />
                  </div>
                  <h3 className="text-body font-semibold" style={{ color: 'var(--text-primary)' }}>Flag Resolution</h3>
                </div>
                <div className="flex items-end gap-2 mb-3">
                  <span className="text-3xl font-extrabold tabular-nums leading-none" style={{ color: '#7C3AED' }}>
                    {Math.round((vm.metrics.resolution_rate ?? 0) * 100)}%
                  </span>
                  <span className="text-caption pb-1" style={{ color: 'var(--text-muted)' }}>resolution rate</span>
                </div>
                <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.round((vm.metrics.resolution_rate ?? 0) * 100)}%`, background: '#7C3AED' }}
                  />
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-caption" style={{ color: 'var(--text-muted)' }}>{vm.metrics.resolved_flags_count} resolved</span>
                  <span className="text-caption" style={{ color: 'var(--text-muted)' }}>{vm.metrics.flagged_count} total flags</span>
                </div>
              </Card>

              <Card className="p-5 lg:col-span-2">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(5,150,105,0.1)' }}>
                    <Clock className="w-3.5 h-3.5" style={{ color: '#059669' }} />
                  </div>
                  <h3 className="text-body font-semibold" style={{ color: 'var(--text-primary)' }}>Stage Breakdown</h3>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Order â†’ Verify',    val: vm.metrics.average_order_to_verify_minutes,          color: '#2563EB' },
                    { label: 'Verify â†’ Dispense', val: vm.metrics.average_verify_to_dispense_minutes,        color: '#059669' },
                    { label: 'Dispense â†’ Admin',  val: vm.metrics.average_dispense_to_administer_minutes,    color: '#D97706' },
                  ].map(({ label, val, color }) => (
                    <div key={label} className="rounded-xl p-3 text-center" style={{ background: `${color}10`, border: `1px solid ${color}30` }}>
                      <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color }}>{label}</p>
                      <p className="text-xl font-extrabold tabular-nums leading-none" style={{ color }}>{formatMinutes(val ?? 0)}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {vm.bottlenecks && (() => {
              const stages = [
                { label: 'Audit / Verification Queue', key: 'verification_queue' as const, color: '#2563EB', desc: 'Submit → Verify' },
                { label: 'Dispensing Queue',            key: 'dispensing_queue'    as const, color: '#059669', desc: 'Verify → Dispense' },
                { label: 'Administration Queue',        key: 'administration_queue' as const, color: '#D97706', desc: 'Dispense → Administer' },
              ].map(s => ({ ...s, avg: vm.bottlenecks![s.key].avg, p95: vm.bottlenecks![s.key].p95, count: vm.bottlenecks![s.key].count }))
               .sort((a, b) => b.avg - a.avg);

              const topBottleneck = stages[0];

              return (
                <Card>
                  <div className="flex items-center justify-between px-5 pt-5 pb-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(220,38,38,0.1)' }}>
                        <Zap className="w-3.5 h-3.5" style={{ color: '#DC2626' }} />
                      </div>
                      <div>
                        <h2 className="text-body font-semibold" style={{ color: 'var(--text-primary)' }}>Bottleneck Analysis</h2>
                        <p className="text-caption" style={{ color: 'var(--text-muted)' }}>
                          Primary bottleneck: <strong style={{ color: '#DC2626' }}>{topBottleneck.label}</strong> — avg {formatMinutes(topBottleneck.avg)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {stages.map((s, i) => (
                      <div
                        key={s.key}
                        className="rounded-xl p-4"
                        style={{
                          background: i === 0 ? 'rgba(220,38,38,0.05)' : 'var(--surface-1)',
                          border: `1.5px solid ${i === 0 ? '#FCA5A5' : 'var(--border-default)'}`,
                        }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-caption font-semibold" style={{ color: i === 0 ? '#DC2626' : 'var(--text-secondary)' }}>
                            {i === 0 && '⚠ '}{s.label}
                          </p>
                          {i === 0 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#DC2626', color: 'white' }}>
                              SLOWEST
                            </span>
                          )}
                        </div>
                        <p className="text-caption mb-2" style={{ color: 'var(--text-muted)' }}>{s.desc}</p>
                        <div className="flex gap-4">
                          <div>
                            <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Avg</p>
                            <p className="text-lg font-extrabold tabular-nums leading-none" style={{ color: i === 0 ? '#DC2626' : s.color }}>
                              {formatMinutes(s.avg)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>P95</p>
                            <p className="text-lg font-extrabold tabular-nums leading-none" style={{ color: 'var(--text-secondary)' }}>
                              {formatMinutes(s.p95)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Cases</p>
                            <p className="text-lg font-extrabold tabular-nums leading-none" style={{ color: 'var(--text-secondary)' }}>
                              {s.count}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })()}

            {slowest.length > 0 && (
              <Card>
                <div className="flex items-center justify-between px-5 pt-5 pb-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(220,38,38,0.1)' }}>
                      <AlertTriangle className="w-3.5 h-3.5" style={{ color: '#DC2626' }} />
                    </div>
                    <div>
                      <h2 className="text-body font-semibold" style={{ color: 'var(--text-primary)' }}>Slowest Prescriptions</h2>
                      <p className="text-caption" style={{ color: 'var(--text-muted)' }}>Prescriptions with longest total turnaround time</p>
                    </div>
                  </div>
                  <span className="text-caption font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(220,38,38,0.1)', color: '#DC2626' }}>
                    {slowest.length} items
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-default)', background: 'var(--surface-1)' }}>
                        {['#', 'Prescription', 'Patient', 'Total TAT', 'Ordered At'].map(h => (
                          <th key={h} className="text-left px-5 py-3 text-caption font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {slowest.map((p, i) => {
                        const tatMin = Math.round(p.total_tat_minutes);
                        const isHigh = tatMin > 120;
                        return (
                          <tr
                            key={p.id}
                            style={{
                              borderBottom: '1px solid var(--border-default)',
                              background: i % 2 === 0 ? 'transparent' : 'var(--surface-1)',
                            }}
                          >
                            <td className="px-5 py-3 text-caption font-bold tabular-nums" style={{ color: 'var(--text-muted)' }}>
                              {i + 1}
                            </td>
                            <td className="px-5 py-3">
                              <span className="font-mono text-xs px-2 py-0.5 rounded" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
                                {p.rx_number ?? p.id.slice(0, 8).toUpperCase()}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                              {p.patient_name ?? 'Unknown Patient'}
                            </td>
                            <td className="px-5 py-3">
                              <span
                                className="flex items-center gap-1.5 font-semibold tabular-nums w-fit px-2.5 py-1 rounded-lg"
                                style={{
                                  background: isHigh ? '#FEF2F2' : '#F0FDF4',
                                  color:      isHigh ? '#DC2626' : '#059669',
                                  border:     `1px solid ${isHigh ? '#FECACA' : '#BBF7D0'}`,
                                }}
                              >
                                <Clock className="w-3 h-3" />
                                {formatMinutes(p.total_tat_minutes)}
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                                <Calendar className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                                {new Date(p.ordered_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </>
        )}

        {!vm.metrics && !vm.isLoading && !vm.error && (
          <Card className="p-8 text-center">
            <BarChart2 className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
            <p className="text-body font-semibold" style={{ color: 'var(--text-secondary)' }}>No analytics data</p>
            <p className="text-caption mt-1" style={{ color: 'var(--text-muted)' }}>
              Ensure the backend is running and prescriptions have been processed.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
