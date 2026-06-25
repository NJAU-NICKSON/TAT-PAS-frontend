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
      className={className}
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-card)' }}
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
      <div className="px-4 py-3.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-caption font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</p>
          <span className="flex-shrink-0" style={{ color: accentColor }}>{icon}</span>
        </div>
        <p className="text-xl font-bold tabular-nums mt-1.5 leading-none" style={{ color: 'var(--text-primary)' }}>{value}</p>
        {sub && <p className="text-caption mt-1.5" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
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

  const stageData = vm.metrics ? [
    { stage: 'Order -> Verify',   minutes: Math.round(vm.metrics.average_order_to_verify_minutes ?? 0) },
    { stage: 'Verify -> Dispense', minutes: Math.round(vm.metrics.average_verify_to_dispense_minutes ?? 0) },
    { stage: 'Dispense -> Admin',  minutes: Math.round(vm.metrics.average_dispense_to_administer_minutes ?? 0) },
  ] : [];

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

  const fmtDay = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const rangeLabel = vm.dateRange.from || vm.dateRange.to
    ? (vm.dateRange.from && vm.dateRange.to && vm.dateRange.from !== vm.dateRange.to
        ? `${fmtDay(vm.dateRange.from)} - ${fmtDay(vm.dateRange.to)}`
        : fmtDay(vm.dateRange.from || vm.dateRange.to))
    : 'All time';

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div
        className="flex items-center justify-between gap-4 flex-wrap px-6 py-2.5 flex-shrink-0"
        style={{ background: '#FFFFFF', borderBottom: '1px solid var(--border-default)' }}
      >
        <h1 className="text-base font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>Turnaround Time Report</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={vm.dateRange.from}
            onChange={e => vm.setDateRange(e.target.value, vm.dateRange.to)}
            className="px-2.5 py-1.5 text-sm tabular-nums focus:outline-none"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-button)', color: 'var(--text-primary)' }}
          />
          <span className="text-meta" style={{ color: 'var(--text-muted)' }}>to</span>
          <input
            type="date"
            value={vm.dateRange.to}
            onChange={e => vm.setDateRange(vm.dateRange.from, e.target.value)}
            className="px-2.5 py-1.5 text-sm tabular-nums focus:outline-none"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-button)', color: 'var(--text-primary)' }}
          />
          <button
            onClick={handleApply}
            disabled={vm.isLoading}
            className="px-3 py-1.5 text-sm font-semibold text-white transition-colors"
            style={{ background: 'var(--scion-green-600)', borderRadius: 'var(--radius-button)' }}
          >
            Apply
          </button>
          <button
            onClick={handleReset}
            className="px-3 py-1.5 text-sm font-medium transition-colors"
            style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-button)' }}
          >
            Reset
          </button>
          <button
            onClick={vm.exportCSV}
            disabled={vm.isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50"
            style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-button)' }}
          >
            {vm.isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Export CSV
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-7 py-5 space-y-5" style={{ background: 'var(--bg-base)' }}>

        {vm.error && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm" style={{ background: 'var(--status-critical-bg)', border: '1px solid var(--status-critical-border)', color: 'var(--status-critical-text)' }}>
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {vm.error}
          </div>
        )}

        {vm.isLoading && !vm.metrics && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 rounded-lg animate-shimmer" />
            ))}
          </div>
        )}

        {vm.metrics && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <KpiCard
                label="Total Rx"
                value={vm.metrics.total_prescriptions}
                icon={<FileText className="w-4 h-4" style={{ color: '#178A3D' }} />}
                accentColor="#178A3D"
              />
              <KpiCard
                label="Completed"
                value={vm.metrics.completed_prescriptions}
                sub={completionRate !== null ? `${completionRate}% completion` : undefined}
                icon={<CheckCircle className="w-4 h-4" style={{ color: '#178A3D' }} />}
                accentColor="#178A3D"
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
                value={`${Math.round(vm.metrics.resolution_rate ?? 0)}%`}
                icon={<TrendingUp className="w-4 h-4" style={{ color: '#178A3D' }} />}
                accentColor="#178A3D"
              />
            </div>

            {vm.isLoading && (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm" style={{ background: 'rgba(23,138,61,0.08)', border: '1px solid rgba(23,138,61,0.15)', color: '#178A3D' }}>
                <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                Refreshing analytics data...
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

              <Card className="lg:col-span-3">
                <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid var(--border-default)' }}>
                  <div className="flex items-center gap-2.5">
                    <BarChart2 className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                    <div>
                      <h2 className="text-body-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Average TAT per Stage</h2>
                      <p className="text-caption" style={{ color: 'var(--text-muted)' }}>Minutes from order to administration</p>
                    </div>
                  </div>
                  <span className="text-caption font-semibold px-2 py-0.5" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-badge)' }}>
                    {rangeLabel}
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
                        <Bar dataKey="minutes" name="Avg TAT" fill="#178A3D" radius={[6, 6, 0, 0]} maxBarSize={72} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </Card>

              <Card className="lg:col-span-2">
                <div className="flex items-center gap-2.5 px-5 py-3.5" style={{ borderBottom: '1px solid var(--border-default)' }}>
                  <TrendingUp className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                  <div>
                    <h2 className="text-body-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Slowest Prescriptions</h2>
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
                  <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                  <h3 className="text-body-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Flag Resolution</h3>
                </div>
                <div className="flex items-end gap-2 mb-3">
                  <span className="text-3xl font-extrabold tabular-nums leading-none" style={{ color: '#178A3D' }}>
                    {Math.round(vm.metrics.resolution_rate ?? 0)}%
                  </span>
                  <span className="text-caption pb-1" style={{ color: 'var(--text-muted)' }}>resolution rate</span>
                </div>
                <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, Math.round(vm.metrics.resolution_rate ?? 0))}%`, background: '#178A3D' }}
                  />
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-caption" style={{ color: 'var(--text-muted)' }}>{vm.metrics.resolved_flags_count} resolved</span>
                  <span className="text-caption" style={{ color: 'var(--text-muted)' }}>{vm.metrics.flagged_count} total flags</span>
                </div>
              </Card>

              <Card className="p-5 lg:col-span-2">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                  <h3 className="text-body-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Stage Breakdown</h3>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Order -> Verify',    val: vm.metrics.average_order_to_verify_minutes,          color: '#178A3D' },
                    { label: 'Verify -> Dispense', val: vm.metrics.average_verify_to_dispense_minutes,        color: '#178A3D' },
                    { label: 'Dispense -> Admin',  val: vm.metrics.average_dispense_to_administer_minutes,    color: '#D97706' },
                  ].map(({ label, val, color }) => (
                    <div key={label} className="rounded-lg p-3 text-center" style={{ background: `${color}10`, border: `1px solid ${color}30` }}>
                      <p className="text-micro font-semibold uppercase tracking-wider mb-1" style={{ color }}>{label}</p>
                      <p className="text-xl font-extrabold tabular-nums leading-none" style={{ color }}>{formatMinutes(val ?? 0)}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {vm.bottlenecks && (() => {
              const stages = [
                { label: 'Audit / Verification Queue', key: 'verification_queue' as const, color: '#178A3D', desc: 'Submit -> Verify' },
                { label: 'Dispensing Queue',            key: 'dispensing_queue'    as const, color: '#178A3D', desc: 'Verify -> Dispense' },
                { label: 'Administration Queue',        key: 'administration_queue' as const, color: '#D97706', desc: 'Dispense -> Administer' },
              ].map(s => ({ ...s, avg: vm.bottlenecks![s.key].avg, p95: vm.bottlenecks![s.key].p95, count: vm.bottlenecks![s.key].count }))
               .sort((a, b) => b.avg - a.avg);

              const topBottleneck = stages[0];

              return (
                <Card>
                  <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid var(--border-default)' }}>
                    <div className="flex items-center gap-2.5">
                      <Zap className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                      <div>
                        <h2 className="text-body-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Bottleneck Analysis</h2>
                        <p className="text-caption" style={{ color: 'var(--text-muted)' }}>
                          Primary bottleneck: <strong style={{ color: '#DC2626' }}>{topBottleneck.label}</strong> - avg {formatMinutes(topBottleneck.avg)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {stages.map((s, i) => (
                      <div
                        key={s.key}
                        className="rounded-lg p-4"
                        style={{
                          background: i === 0 ? 'rgba(220,38,38,0.05)' : 'var(--surface-1)',
                          border: `1.5px solid ${i === 0 ? '#FCA5A5' : 'var(--border-default)'}`,
                        }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-caption font-semibold" style={{ color: i === 0 ? '#DC2626' : 'var(--text-secondary)' }}>
                            {i === 0 && ' '}{s.label}
                          </p>
                          {i === 0 && (
                            <span className="text-micro font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#DC2626', color: 'white' }}>
                              SLOWEST
                            </span>
                          )}
                        </div>
                        <p className="text-caption mb-2" style={{ color: 'var(--text-muted)' }}>{s.desc}</p>
                        <div className="flex gap-4">
                          <div>
                            <p className="text-micro uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Avg</p>
                            <p className="text-lg font-extrabold tabular-nums leading-none" style={{ color: i === 0 ? '#DC2626' : s.color }}>
                              {formatMinutes(s.avg)}
                            </p>
                          </div>
                          <div>
                            <p className="text-micro uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>P95</p>
                            <p className="text-lg font-extrabold tabular-nums leading-none" style={{ color: 'var(--text-secondary)' }}>
                              {formatMinutes(s.p95)}
                            </p>
                          </div>
                          <div>
                            <p className="text-micro uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Cases</p>
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
                <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid var(--border-default)' }}>
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                    <div>
                      <h2 className="text-body-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Slowest Prescriptions</h2>
                      <p className="text-caption" style={{ color: 'var(--text-muted)' }}>Prescriptions with longest total turnaround time</p>
                    </div>
                  </div>
                  <span className="text-caption font-semibold px-2 py-0.5" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-badge)' }}>
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
                                  color:      isHigh ? '#DC2626' : '#178A3D',
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
