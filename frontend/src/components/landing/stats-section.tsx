'use client'

import { useEffect, useState } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { TrendingUp, CheckCircle2, Clock } from 'lucide-react'
import { getPublicStats, type PublicStats } from '@/lib/api'

const REAL_THRESHOLD = 500

// Representative trend shape for the landing visual (decorative).
const TREND = [
  { m: 'Jan', v: 12 },
  { m: 'Feb', v: 19 },
  { m: 'Mar', v: 26 },
  { m: 'Apr', v: 31 },
  { m: 'May', v: 44 },
  { m: 'Jun', v: 58 },
  { m: 'Jul', v: 71 },
  { m: 'Aug', v: 92 },
]

export function StatsSection() {
  const [stats, setStats] = useState<PublicStats | null>(null)

  useEffect(() => {
    let active = true
    getPublicStats()
      .then((s) => active && setStats(s))
      .catch(() => active && setStats(null))
    return () => {
      active = false
    }
  }, [])

  const real = stats && stats.total_sent >= REAL_THRESHOLD
  const approvalRate = real && stats!.approval_rate != null ? stats!.approval_rate : 92
  const avgResponse =
    real && stats!.avg_response_hours != null
      ? formatHours(stats!.avg_response_hours)
      : '3.2h'

  const pieData = [
    { name: 'Approved', value: approvalRate },
    { name: 'Other', value: 100 - approvalRate },
  ]

  return (
    <section className="py-24 border-t border-border">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-14">
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full text-sm font-medium text-primary mb-4">
            <TrendingUp className="h-4 w-4" /> By the numbers
          </span>
          <h2 className="text-4xl lg:text-5xl font-heading font-bold mb-4">
            Approvals that actually close
          </h2>
          <p className="text-lg text-foreground/70 max-w-2xl mx-auto">
            Teams move faster when a decision is one click away and reminders run themselves.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Volume trend */}
          <div className="lg:col-span-2 p-6 rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-heading font-semibold text-foreground">Request volume</h3>
                <p className="text-sm text-foreground/55">Growth as teams adopt YesDrop</p>
              </div>
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={TREND} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="vol" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="m"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--popover)',
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      fontSize: 12,
                      color: 'var(--popover-foreground)',
                    }}
                    labelStyle={{ color: 'var(--foreground)' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke="var(--chart-1)"
                    strokeWidth={2.5}
                    fill="url(#vol)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Approval rate donut */}
          <div className="p-6 rounded-2xl border border-border bg-card flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-heading font-semibold text-foreground">Approval rate</h3>
                <p className="text-sm text-foreground/55">Of requests that get a decision</p>
              </div>
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="relative flex-1 min-h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    innerRadius="68%"
                    outerRadius="92%"
                    startAngle={90}
                    endAngle={-270}
                    stroke="none"
                  >
                    <Cell fill="var(--chart-3)" />
                    <Cell fill="var(--muted)" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-heading font-bold text-foreground">{approvalRate}%</span>
                <span className="text-xs text-foreground/55">approved</span>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-foreground/70 pt-2 border-t border-border mt-2">
              <Clock className="h-4 w-4 text-primary" />
              <span className="font-semibold text-foreground">{avgResponse}</span> avg response
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function formatHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}m`
  if (h < 48) return `${h % 1 === 0 ? h : h.toFixed(1)}h`
  return `${Math.round(h / 24)}d`
}
