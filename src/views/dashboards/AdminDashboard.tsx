import { useState, useEffect, useCallback } from 'react';
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
  ShieldAlert, Pill, Timer, CheckCircle2,
  BedDouble, AlertTriangle, ChevronRight, X,
  TrendingUp, TrendingDown, Minus, Activity,
} from 'lucide-react';
import { analyticsApi, BottleneckData, TATHistoryEntry, LiveBreachResponse } from '../../api/analytics';
import { bedsApi, BedAvailabilitySummary } from '../../api/beds';
import { useWebSocket, WSEvent } from '../../context/WebSocketContext';
import { TATMetrics } from '../../models/types';
import { BreachBanner } from '../../components/ui/BreachBanner';
import { LiveMetricsSidebar, formatMin } from '../../components/ui/LiveMetricsSidebar';

interface PerformanceRow {
  doctor_id?: string;
  doctor_name?: string;
  pharmacist_id?: string;
  pharmacist_name?: string;
  prescriptions?: number;
  dispensed?: number;
  avg_order_to_submit?: number;
  avg_verify_to_dispense?: number;
  flag_rate?: number;
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-shimmer rounded-xl ${className}`} />;
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl overflow-hidden ${className}`}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        boxShadow: '0 1px 3px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.04)',
      }}
    >
      {children}
    </div>
  );
}

function CardHeader({ title, subtitle, icon: Icon, iconColor, iconBg, right }: {
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  iconColor?: string;
  iconBg?: string;
  right?: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center justify-between px-5 py-4"
      style={{ borderBottom: '1px solid var(--border-default)' }}
    >
      <div className="flex items-center gap-3">
        {Icon && (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: iconBg ?? 'var(--bg-base)' }}
          >
            <Icon className="w-4 h-4" style={{ color: iconColor ?? 'var(--text-secondary)' }} />
          </div>
        )}
        <div>
          <p className="text-body font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</p>
          {subtitle && <p className="text-caption mt-0.5" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>}
        </div>
      </div>
      {right && <div className="flex-shrink-0">{right}</div>}
    </div>
  );
}

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  accentColor: string;
  accentBg: string;
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
  danger?: boolean;
}

function KpiCard({ label, value, sub, icon: Icon, accentColor, accentBg, trend, trendLabel, danger }: KpiCardProps) {
  return (
    <div
      className="flex flex-col p-5 rounded-xl transition-all duration-150 cursor-default"
      style={{
        background: danger ? '#FEF2F2' : 'var(--bg-card)',
        border: `1px solid ${danger ? '#FECACA' : 'var(--border-default)'}`,
        boxShadow: '0 1px 3px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.04)',
        borderLeft: `3px solid ${danger ? '#DC2626' : accentColor}`,
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(15,23,42,0.10)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.transform = '';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.04)';
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: danger ? 'rgba(220,38,38,0.10)' : accentBg }}
        >
          <Icon className="w-5 h-5" style={{ color: danger ? '#DC2626' : accentColor }} />
        </div>
        {trend && trendLabel && (
          <div
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
            style={{
              background: trend === 'up' ? '#F0FDF4' : trend === 'down' ? '#FEF2F2' : '#F8FAFC',
              color: trend === 'up' ? '#15803D' : trend === 'down' ? '#B91C1C' : '#64748B',
            }}
          >
            {trend === 'up' ? <TrendingUp className="w-3 h-3" /> : trend === 'down' ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
            <span>{trendLabel}</span>
          </div>
        )}
      </div>
      <p
        className="tabular-nums font-extrabold leading-none tracking-tight"
        style={{ fontSize: '2.5rem', color: danger ? '#DC2626' : 'var(--text-primary)' }}
      >
        {value}
      </p>
      <p className="text-body-sm font-semibold mt-2" style={{ color: 'var(--text-primary)' }}>{label}</p>
      {sub && <p className="text-caption mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
    </div>
  );
}

const PIPELINE_STAGES = [
  { label: 'Ordered',      color: '#3B82F6', bg: 'rgba(59,130,246,0.10)'  },
  { label: 'Verified',     color: '#7C3AED', bg: 'rgba(124,58,237,0.10)'  },
  { label: 'Dispensed',    color: '#0891B2', bg: 'rgba(8,145,178,0.10)'   },
  { label: 'Administered', color: '#059669', bg: 'rgba(5,150,105,0.10)'   },
];

function PrescriptionPipeline({ metrics }: { metrics: TATMetrics | null }) {
  const gaps = [
    metrics?.average_order_to_verify_minutes,
    metrics?.average_verify_to_dispense_minutes,
    metrics?.average_dispense_to_administer_minutes,
  ];

  return (
    <Card>
      <CardHeader
        title="Prescription Flow"
        subtitle="Average time between each stage"
        icon={Activity}
        iconBg="rgba(37,99,235,0.08)"
        iconColor="#2563EB"
      />
      <div className="p-6">
        <div className="flex items-start">
          {PIPELINE_STAGES.map((stage, i) => (
            <div key={stage.label} className="flex items-start flex-1 min-w-0">
              <div className="flex flex-col items-center gap-2 flex-shrink-0">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-base"
                  style={{
                    background: stage.bg,
                    color: stage.color,
                    border: `2px solid ${stage.color}30`,
                    boxShadow: `0 0 0 4px ${stage.bg}`,
                  }}
                >
                  {i + 1}
                </div>
                <span className="text-caption font-semibold text-center whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                  {stage.label}
                </span>
              </div>

              {i < PIPELINE_STAGES.length - 1 && (
                <div className="flex-1 flex flex-col items-center pt-3 px-3">
                  <span
                    className="text-xs font-bold tabular-nums mb-2 px-2.5 py-1 rounded-full"
                    style={{
                      background: 'var(--bg-base)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-default)',
                    }}
                  >
                    {formatMin(gaps[i])}
                  </span>
                  <div className="w-full flex items-center">
                    <div
                      className="flex-1 h-0.5 rounded-full"
                      style={{ background: `linear-gradient(90deg, ${stage.color}50, ${PIPELINE_STAGES[i + 1].color}50)` }}
                    />
                    <svg width="6" height="8" viewBox="0 0 6 8" fill={PIPELINE_STAGES[i + 1].color} style={{ opacity: 0.6 }}>
                      <polygon points="0,0 6,4 0,8" />
                    </svg>
                  </div>
                  <span className="text-[10px] mt-1.5" style={{ color: 'var(--text-muted)' }}>avg wait</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function BedSummaryWidget({ summary }: { summary: BedAvailabilitySummary[] }) {
  const total     = summary.reduce((s, d) => s + d.total, 0);
  const available = summary.reduce((s, d) => s + d.available, 0);
  const occupied  = summary.reduce((s, d) => s + d.occupied, 0);
  const cleaning  = summary.reduce((s, d) => s + d.cleaning, 0);
  const other     = total - available - occupied - cleaning;
  const occupancyPct = total > 0 ? Math.round((occupied / total) * 100) : 0;

  const segments = [
    { count: occupied,  color: occupancyPct > 85 ? '#DC2626' : '#2563EB', label: 'Occupied'  },
    { count: cleaning,  color: '#D97706', label: 'Cleaning'  },
    { count: available, color: '#059669', label: 'Available' },
    { count: other,     color: '#94A3B8', label: 'Other'     },
  ];

  const chips = [
    { label: 'Available', count: available, color: '#059669', bg: '#F0FDF4', border: '#BBF7D0' },
    { label: 'Occupied',  count: occupied,  color: occupancyPct > 85 ? '#DC2626' : '#1D4ED8', bg: occupancyPct > 85 ? '#FEF2F2' : '#EFF6FF', border: occupancyPct > 85 ? '#FECACA' : '#BFDBFE' },
    { label: 'Cleaning',  count: cleaning,  color: '#92400E', bg: '#FFFBEB', border: '#FDE68A' },
    { label: 'Other',     count: other,     color: '#475569', bg: '#F8FAFC', border: '#E2E8F0' },
  ];

  return (
    <Card>
      <CardHeader
        title="Bed Availability"
        subtitle={`${total} beds · ${summary.length} department${summary.length !== 1 ? 's' : ''}`}
        icon={BedDouble}
        iconBg="rgba(37,99,235,0.08)"
        iconColor="#2563EB"
        right={
          <div className="text-right">
            <p
              className="text-2xl font-extrabold tabular-nums leading-none"
              style={{ color: occupancyPct > 85 ? '#DC2626' : 'var(--text-primary)' }}
            >
              {occupancyPct}%
            </p>
            <p className="text-caption mt-0.5" style={{ color: 'var(--text-muted)' }}>occupancy</p>
          </div>
        }
      />
      <div className="p-5 space-y-4">
        <div className="flex h-3 rounded-full overflow-hidden gap-0.5" style={{ background: 'var(--surface-3)' }}>
          {total > 0 && segments.map(seg => seg.count > 0 && (
            <div
              key={seg.label}
              className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-700"
              style={{ width: `${(seg.count / total) * 100}%`, background: seg.color }}
              title={`${seg.label}: ${seg.count}`}
            />
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {chips.map(chip => (
            <div
              key={chip.label}
              className="flex items-center justify-between px-3 py-2.5 rounded-lg"
              style={{ background: chip.bg, border: `1px solid ${chip.border}` }}
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: chip.color }} />
                <span className="text-caption font-semibold" style={{ color: chip.color }}>{chip.label}</span>
              </div>
              <span className="text-body font-extrabold tabular-nums" style={{ color: chip.color }}>{chip.count}</span>
            </div>
          ))}
        </div>

        {summary.length > 0 && (
          <div className="space-y-2 pt-1 border-t" style={{ borderColor: 'var(--border-default)' }}>
            {summary.map(dept => {
              const deptPct = dept.total > 0 ? Math.round((dept.occupied / dept.total) * 100) : 0;
              return (
                <div key={dept.department_id} className="flex items-center gap-3">
                  <span className="text-caption font-medium w-12 shrink-0 tabular-nums" style={{ color: 'var(--text-muted)' }}>
                    {dept.department_code}
                  </span>
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${deptPct}%`,
                        background: deptPct > 85 ? '#DC2626' : '#2563EB',
                      }}
                    />
                  </div>
                  <span className="text-caption tabular-nums w-16 text-right shrink-0" style={{ color: 'var(--text-secondary)' }}>
                    {dept.available}/{dept.total} free
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}

function ComplianceTrend({ history }: { history: TATHistoryEntry[] }) {
  if (!history.length) return null;

  const avg = history.reduce((s, d) => s + (d.resolution_rate ?? 0), 0) / history.length;
  const last = history[history.length - 1];
  const todayRate = last?.resolution_rate ?? 0;
  const isGood = todayRate >= 80;

  return (
    <Card>
      <CardHeader
        title="30-Day Compliance Trend"
        subtitle="SLA flag resolution rate over time"
        right={
          <div className="flex items-center gap-2">
            <span className="text-caption" style={{ color: 'var(--text-muted)' }}>
              Avg <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{avg.toFixed(1)}%</span>
            </span>
            <span
              className="text-caption font-semibold px-2.5 py-1 rounded-full"
              style={{
                background: isGood ? '#F0FDF4' : '#FFFBEB',
                color: isGood ? '#15803D' : '#92400E',
                border: `1px solid ${isGood ? '#BBF7D0' : '#FDE68A'}`,
              }}
            >
              Today {todayRate.toFixed(1)}%
            </span>
          </div>
        }
      />
      <div className="px-5 pb-5 pt-4">
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={history} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="compGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#059669" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#059669" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
              tickFormatter={d => d.slice(5)}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
              unit="%"
              domain={[0, 100]}
              axisLine={false}
              tickLine={false}
              width={32}
            />
            <Tooltip
              formatter={v => [typeof v === 'number' ? `${v.toFixed(1)}%` : '']}
              contentStyle={{
                fontSize: 12,
                borderRadius: 10,
                border: '1px solid var(--border-default)',
                boxShadow: 'var(--shadow-elevated)',
                background: '#1E293B',
                color: '#F1F5F9',
              }}
              labelStyle={{ color: '#94A3B8', marginBottom: 2 }}
            />
            <Area
              type="monotone"
              dataKey="resolution_rate"
              name="Resolution Rate"
              stroke="#059669"
              strokeWidth={2}
              fill="url(#compGradient)"
              dot={false}
              activeDot={{ r: 4, fill: '#059669', stroke: '#fff', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function PerformanceTable({ role, data }: { role: 'doctor' | 'pharmacist'; data: PerformanceRow[] }) {
  const isDoctor = role === 'doctor';
  return (
    <Card>
      <CardHeader
        title={isDoctor ? 'Doctor Performance' : 'Pharmacist Performance'}
        subtitle={isDoctor ? 'Prescriptions written and average submission time' : 'Dispensing throughput and timing'}
        right={
          <span
            className="text-caption font-semibold px-2.5 py-1 rounded-full"
            style={{ background: 'var(--bg-base)', color: 'var(--text-muted)', border: '1px solid var(--border-default)' }}
          >
            {data.length} staff
          </span>
        }
      />
      <div className="overflow-x-auto">
        <table className="w-full text-body-sm">
          <thead>
            <tr style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border-default)' }}>
              <th className="px-5 py-3 text-left text-caption font-semibold" style={{ color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>#</th>
              <th className="px-5 py-3 text-left text-caption font-semibold" style={{ color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Name</th>
              {isDoctor ? (
                <>
                  <th className="px-5 py-3 text-right text-caption font-semibold" style={{ color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Rx Written</th>
                  <th className="px-5 py-3 text-right text-caption font-semibold" style={{ color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Avg Submit</th>
                  <th className="px-5 py-3 text-right text-caption font-semibold" style={{ color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Flag Rate</th>
                </>
              ) : (
                <>
                  <th className="px-5 py-3 text-right text-caption font-semibold" style={{ color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Dispensed</th>
                  <th className="px-5 py-3 text-right text-caption font-semibold" style={{ color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Avg Verify'Dispense</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-body-sm" style={{ color: 'var(--text-muted)' }}>
                  No performance data available
                </td>
              </tr>
            ) : data.map((row, i) => {
              const flagRate = row.flag_rate ?? 0;
              const isBadFlag = flagRate > 20;
              return (
                <tr
                  key={i}
                  style={{
                    borderTop: '1px solid var(--border-default)',
                    background: i % 2 === 1 ? 'var(--bg-base)' : 'var(--bg-card)',
                  }}
                >
                  <td className="px-5 py-3.5 tabular-nums font-medium" style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                  <td className="px-5 py-3.5 font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {row.doctor_name ?? row.pharmacist_name ?? 'Unknown'}
                  </td>
                  {isDoctor ? (
                    <>
                      <td className="px-5 py-3.5 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>{row.prescriptions ?? 0}</td>
                      <td className="px-5 py-3.5 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>{formatMin(row.avg_order_to_submit)}</td>
                      <td className="px-5 py-3.5 text-right">
                        <span
                          className="inline-flex items-center justify-end tabular-nums font-semibold text-caption px-2 py-0.5 rounded-full"
                          style={{
                            background: isBadFlag ? '#FEF2F2' : '#F0FDF4',
                            color: isBadFlag ? '#B91C1C' : '#15803D',
                          }}
                        >
                          {flagRate.toFixed(1)}%
                        </span>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-5 py-3.5 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>{row.dispensed ?? 0}</td>
                      <td className="px-5 py-3.5 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>{formatMin(row.avg_verify_to_dispense)}</td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function BottleneckSection({ data }: { data: BottleneckData }) {
  const [drillStage, setDrillStage] = useState<string | null>(null);

  const STAGES = [
    { key: 'verification_queue',   name: 'Submit -> Verify',       shortName: 'Verification'   },
    { key: 'dispensing_queue',     name: 'Verify -> Dispense',     shortName: 'Dispensing'     },
    { key: 'administration_queue', name: 'Dispense -> Administer', shortName: 'Administration' },
  ] as const;

  const stagesWithData = STAGES.map(s => ({
    ...s,
    avg:   (data[s.key] as { avg: number }).avg   ?? 0,
    p95:   (data[s.key] as { p95: number }).p95   ?? 0,
    count: (data[s.key] as { count: number }).count ?? 0,
  }));

  const maxAvg = Math.max(...stagesWithData.map(s => s.avg), 1);
  const worstStage = [...stagesWithData].sort((a, b) => b.avg - a.avg)[0];
  const drillData = drillStage ? stagesWithData.find(s => s.name === drillStage) : null;

  return (
    <div
      className="relative rounded-xl overflow-hidden"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        boxShadow: '0 1px 3px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.04)',
        minHeight: 220,
      }}
    >
      <CardHeader
        title="Bottleneck Analysis"
        subtitle="Queue depth and average wait per pipeline stage"
        icon={AlertTriangle}
        iconBg="rgba(245,158,11,0.10)"
        iconColor="#D97706"
        right={
          worstStage?.avg > 0 ? (
            <span
              className="text-caption font-semibold px-2.5 py-1 rounded-full"
              style={{ background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }}
            >
              Worst: {worstStage.shortName} · {formatMin(worstStage.avg)}
            </span>
          ) : undefined
        }
      />

      <div className="p-5 space-y-5">
        {stagesWithData.map(stage => {
          const avgPct = maxAvg > 0 ? (stage.avg / maxAvg) * 100 : 0;
          const p95Pct = maxAvg > 0 ? (stage.p95 / maxAvg) * 100 : 0;
          const isWorst = stage.name === worstStage?.name && stage.avg > 0;

          return (
            <div key={stage.name}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {isWorst && (
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#DC2626' }} />
                  )}
                  <span className="text-body-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{stage.name}</span>
                  {stage.count > 0 && (
                    <span
                      className="text-caption font-semibold px-1.5 py-0.5 rounded-full"
                      style={{ background: 'var(--bg-base)', color: 'var(--text-muted)', border: '1px solid var(--border-default)' }}
                    >
                      {stage.count} waiting
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-body-sm font-bold tabular-nums" style={{ color: isWorst ? '#DC2626' : 'var(--text-primary)' }}>
                    {formatMin(stage.avg)}
                  </span>
                  <span className="text-caption tabular-nums" style={{ color: 'var(--text-muted)' }}>p95: {formatMin(stage.p95)}</span>
                  <button
                    onClick={() => setDrillStage(stage.name)}
                    className="flex items-center gap-0.5 text-caption font-semibold transition-colors hover:underline"
                    style={{ color: '#2563EB' }}
                  >
                    Detail <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="relative h-3 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ width: `${p95Pct}%`, background: isWorst ? 'rgba(220,38,38,0.12)' : 'rgba(37,99,235,0.10)', transition: 'width 0.5s ease' }}
                />
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${avgPct}%`,
                    background: isWorst
                      ? 'linear-gradient(90deg, #DC2626, #EF4444)'
                      : 'linear-gradient(90deg, #1D4ED8, #2563EB)',
                    transition: 'width 0.5s ease',
                    minWidth: stage.avg > 0 ? 8 : 0,
                  }}
                />
              </div>
            </div>
          );
        })}

        <div className="flex items-center gap-4 pt-1" style={{ borderTop: '1px solid var(--border-default)' }}>
          {[
            { color: '#2563EB', label: 'Average' },
            { color: 'rgba(37,99,235,0.25)', label: 'P95' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: item.color }} />
              <span className="text-caption" style={{ color: 'var(--text-muted)' }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {drillData && (
        <div
          className="absolute inset-0 flex flex-col animate-fade-in rounded-xl overflow-hidden"
          style={{ background: 'var(--bg-card)', zIndex: 5 }}
        >
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
            <p className="text-body font-semibold" style={{ color: 'var(--text-primary)' }}>{drillData.name}  -  Detail</p>
            <button
              onClick={() => setDrillStage(null)}
              className="p-1.5 rounded-lg transition-colors hover:bg-[var(--bg-base)]"
              style={{ color: 'var(--text-muted)' }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 p-5">
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: 'Queue Depth',  value: String(drillData.count), sub: 'prescriptions waiting' },
                { label: 'Average Wait', value: formatMin(drillData.avg), sub: 'per prescription' },
                { label: 'P95 Wait',     value: formatMin(drillData.p95), sub: '95th percentile' },
              ].map(({ label, value, sub }) => (
                <div key={label} className="p-4 rounded-xl" style={{ background: 'var(--bg-base)', border: '1px solid var(--border-default)' }}>
                  <p className="text-caption font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
                  <p className="text-time-card font-extrabold tabular-nums" style={{ color: 'var(--text-primary)' }}>{value}</p>
                  <p className="text-caption mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</p>
                </div>
              ))}
            </div>
            {drillData.avg > 60 && (
              <div
                className="flex items-start gap-2.5 p-3.5 rounded-xl text-body-sm font-medium"
                style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C' }}
              >
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                Average wait exceeds 1 hour  -  this stage is a bottleneck requiring immediate attention.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function AdminDashboard() {
  const { subscribe } = useWebSocket();
  const [liveMetrics, setLiveMetrics]     = useState<TATMetrics | null>(null);
  const [bottleneck, setBottleneck]       = useState<BottleneckData | null>(null);
  const [history, setHistory]             = useState<TATHistoryEntry[]>([]);
  const [breaches, setBreaches]           = useState<LiveBreachResponse>({ breach_count: 0, oldest_breach_at: null, breaches: [] });
  const [doctorStats, setDoctorStats]     = useState<PerformanceRow[]>([]);
  const [pharmacistStats, setPharmacistStats] = useState<PerformanceRow[]>([]);
  const [bedSummary, setBedSummary]        = useState<BedAvailabilitySummary[]>([]);
  const [loading, setLoading]             = useState(true);

  const loadData = useCallback(async () => {
    const [liveRes, bottleneckRes, historyRes, breachRes, doctorRes, pharmacistRes, bedsRes] =
      await Promise.allSettled([
        analyticsApi.getLiveTAT(),
        analyticsApi.getBottlenecks(),
        analyticsApi.getTATHistory(30),
        analyticsApi.getLiveBreaches(),
        analyticsApi.getPerformance('doctor'),
        analyticsApi.getPerformance('pharmacist'),
        bedsApi.availabilitySummary(),
      ]);

    if (liveRes.status === 'fulfilled')        setLiveMetrics(liveRes.value.data);
    if (bottleneckRes.status === 'fulfilled')  setBottleneck(bottleneckRes.value.data);
    if (historyRes.status === 'fulfilled')
      setHistory(Array.isArray(historyRes.value.data) ? historyRes.value.data : []);
    if (breachRes.status === 'fulfilled')      setBreaches(breachRes.value.data);
    if (doctorRes.status === 'fulfilled')
      setDoctorStats(Array.isArray(doctorRes.value.data) ? doctorRes.value.data as PerformanceRow[] : []);
    if (pharmacistRes.status === 'fulfilled')
      setPharmacistStats(Array.isArray(pharmacistRes.value.data) ? pharmacistRes.value.data as PerformanceRow[] : []);
    if (bedsRes.status === 'fulfilled')
      setBedSummary(Array.isArray(bedsRes.value.data) ? bedsRes.value.data : []);

    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const events = ['sla.breached', 'prescription.status_changed', 'audit.flag_resolved'];
    const unsubs = events.map(ev =>
      subscribe(ev, (_: WSEvent) => {
        analyticsApi.getLiveTAT().then(r => setLiveMetrics(r.data)).catch(() => null);
        analyticsApi.getLiveBreaches().then(r => setBreaches(r.data)).catch(() => null);
      })
    );
    return () => unsubs.forEach(u => u());
  }, [subscribe]);

  const oldestBreachElapsed = breaches.oldest_breach_at
    ? (Date.now() - new Date(breaches.oldest_breach_at).getTime()) / 60000
    : null;

  const sidebarMetrics = [
    { label: 'Active Breaches', value: breaches.breach_count, danger: true },
    { label: 'Rx Today',        value: liveMetrics?.total_prescriptions ?? 0 },
    { label: 'Open Flags',      value: liveMetrics?.flagged_count ?? 0 },
    { label: 'Completed',       value: liveMetrics?.completed_prescriptions ?? 0 },
  ];

  const sidebarFooter = {
    label: 'Avg TAT Today',
    value: formatMin(liveMetrics?.average_total_tat_minutes),
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <BreachBanner count={breaches.breach_count} oldestElapsedMin={oldestBreachElapsed} />

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto" style={{ background: '#F1F5F9' }}>
          <div
            className="px-8 pt-7 pb-6"
            style={{
              background: 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 60%, #2563EB 100%)',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div className="flex items-end justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="text-caption font-bold px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.8)', letterSpacing: '0.08em', textTransform: 'uppercase' }}
                  >
                    Admin Dashboard
                  </span>
                  {breaches.breach_count > 0 && (
                    <span
                      className="text-caption font-bold px-2.5 py-1 rounded-full animate-breach-pulse"
                      style={{ background: 'rgba(220,38,38,0.3)', color: '#FCA5A5', border: '1px solid rgba(220,38,38,0.5)' }}
                    >
                      {breaches.breach_count} SLA Breach{breaches.breach_count > 1 ? 'es' : ''}
                    </span>
                  )}
                </div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Operations Overview</h1>
                <p className="text-body-sm mt-1" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  Real-time prescription turnaround and SLA monitoring
                </p>
              </div>
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
              >
                <div className="w-2 h-2 rounded-full" style={{ background: '#34D399' }} />
                <span className="text-body-sm font-medium text-white">
                  {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>
          </div>

          <div className="px-8 py-6 space-y-6">
            {loading ? (
              <div className="space-y-5">
                <div className="grid grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-36" />)}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Skeleton className="h-44" />
                  <Skeleton className="h-44" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Skeleton className="h-52" />
                  <Skeleton className="h-52" />
                </div>
                <Skeleton className="h-48" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <KpiCard
                    label="Active Breaches"
                    value={breaches.breach_count}
                    sub="SLA violations right now"
                    icon={ShieldAlert}
                    accentColor="#DC2626"
                    accentBg="rgba(220,38,38,0.10)"
                    danger={breaches.breach_count > 0}
                  />
                  <KpiCard
                    label="Prescriptions Today"
                    value={liveMetrics?.total_prescriptions ?? 0}
                    sub="ordered since midnight"
                    icon={Pill}
                    accentColor="#2563EB"
                    accentBg="rgba(37,99,235,0.10)"
                  />
                  <KpiCard
                    label="Avg Total TAT"
                    value={formatMin(liveMetrics?.average_total_tat_minutes)}
                    sub="order ' administered"
                    icon={Timer}
                    accentColor="#7C3AED"
                    accentBg="rgba(124,58,237,0.10)"
                  />
                  <KpiCard
                    label="Resolution Rate"
                    value={liveMetrics ? `${liveMetrics.resolution_rate.toFixed(1)}%` : ' - '}
                    sub="flag resolution today"
                    icon={CheckCircle2}
                    accentColor="#059669"
                    accentBg="rgba(5,150,105,0.10)"
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                  <div className="lg:col-span-3">
                    <PrescriptionPipeline metrics={liveMetrics} />
                  </div>
                  <div className="lg:col-span-2">
                    <BedSummaryWidget summary={bedSummary} />
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {bottleneck && <BottleneckSection data={bottleneck} />}
                  <ComplianceTrend history={history} />
                </div>

                <PerformanceTable role="doctor" data={doctorStats} />
                <PerformanceTable role="pharmacist" data={pharmacistStats} />
              </>
            )}
          </div>
        </div>

        <LiveMetricsSidebar
          title="Live Status"
          metrics={sidebarMetrics}
          footer={sidebarFooter}
        />
      </div>
    </div>
  );
}
