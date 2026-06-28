'use client'

import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { Send, Clock, CheckCircle2, Timer } from 'lucide-react'
import { getMyStats } from '@/lib/api'

const STATUS_COLORS: Record<string, string> = {
  approved: '#10b981',
  pending: '#f59e0b',
  rejected: '#ef4444',
  scheduled: '#3b82f6',
  draft: '#9ca3af',
  ignored: '#6b7280',
}

function formatHours(h: number | null): string {
  if (h == null) return '—'
  if (h < 1) return `${Math.round(h * 60)}m`
  if (h < 48) return `${h % 1 === 0 ? h : h.toFixed(1)}h`
  return `${Math.round(h / 24)}d`
}

export function AnalyticsBand() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-stats'],
    queryFn: getMyStats,
    refetchInterval: 30000,
  })

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl border border-border bg-card animate-pulse" />
        ))}
      </div>
    )
  }

  const cards = [
    { label: 'Total sent', value: data.sent, icon: Send, accent: 'text-primary' },
    { label: 'Pending', value: data.pending, icon: Clock, accent: 'text-amber-600 dark:text-amber-400' },
    { label: 'Approved', value: data.approved, icon: CheckCircle2, accent: 'text-emerald-600 dark:text-emerald-400' },
    {
      label: 'Avg response',
      value: formatHours(data.avg_response_hours),
      icon: Timer,
      accent: 'text-primary',
    },
  ]

  const statusData = Object.entries(data.by_status || {})
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }))

  const volume = (data.volume_30d || []).map((d) => ({
    date: format(parseISO(d.date), 'MMM d'),
    count: d.count,
  }))

  return (
    <div className="mb-8 space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-foreground/55 uppercase tracking-wide">{c.label}</span>
              <c.icon className={`h-4 w-4 ${c.accent}`} />
            </div>
            <div className="text-3xl font-heading font-bold text-foreground tabular-nums">{c.value}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Volume */}
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5">
          <div className="mb-4">
            <h3 className="font-heading font-semibold text-foreground">Volume (last 30 days)</h3>
            <p className="text-sm text-foreground/55">Requests you sent over time</p>
          </div>
          <div className="h-52">
            {volume.length >= 2 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={volume} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dashVol" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--popover)',
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      fontSize: 12,
                      color: 'var(--popover-foreground)',
                    }}
                  />
                  <Area type="monotone" dataKey="count" stroke="var(--chart-1)" strokeWidth={2.5} fill="url(#dashVol)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-foreground/50">
                Not enough data yet — send a few requests to see your trend.
              </div>
            )}
          </div>
        </div>

        {/* Status breakdown */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-4">
            <h3 className="font-heading font-semibold text-foreground">By status</h3>
            <p className="text-sm text-foreground/55">All your requests</p>
          </div>
          <div className="h-52 relative">
            {statusData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} dataKey="value" innerRadius="60%" outerRadius="90%" stroke="none" paddingAngle={2}>
                      {statusData.map((s) => (
                        <Cell key={s.name} fill={STATUS_COLORS[s.name] || '#9ca3af'} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: 'var(--popover)',
                        border: '1px solid var(--border)',
                        borderRadius: 12,
                        fontSize: 12,
                        color: 'var(--popover-foreground)',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-heading font-bold text-foreground">{data.total}</span>
                  <span className="text-xs text-foreground/55">total</span>
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-foreground/50">No requests yet.</div>
            )}
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
            {statusData.map((s) => (
              <div key={s.name} className="flex items-center gap-1.5 text-xs text-foreground/70">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLORS[s.name] || '#9ca3af' }} />
                {s.name.charAt(0).toUpperCase() + s.name.slice(1)} ({s.value})
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
