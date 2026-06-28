'use client'

import { useEffect, useRef, useState } from 'react'
import { getPublicStats, type PublicStats } from '@/lib/api'

// Below this many real sends, show illustrative copy instead of tiny real numbers.
const REAL_THRESHOLD = 500

interface Metric {
  label: string
  value: string
  sub?: string
}

function useCountUp(target: number, durationMs = 1400, run = true) {
  const [val, setVal] = useState(0)
  const startedRef = useRef(false)

  useEffect(() => {
    if (!run || startedRef.current) return
    startedRef.current = true
    let raf = 0
    let start: number | null = null
    const tick = (t: number) => {
      if (start === null) start = t
      const p = Math.min((t - start) / durationMs, 1)
      // easeOutCubic
      const eased = 1 - Math.pow(1 - p, 3)
      setVal(Math.round(eased * target))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, durationMs, run])

  return val
}

function CountUpStat({ target, suffix = '', run }: { target: number; suffix?: string; run: boolean }) {
  const val = useCountUp(target, 1400, run)
  return (
    <>
      {val.toLocaleString()}
      {suffix}
    </>
  )
}

export function StatStrip({ tone = 'default' }: { tone?: 'default' | 'onPrimary' }) {
  const [stats, setStats] = useState<PublicStats | null>(null)
  const [loaded, setLoaded] = useState(false)

  const valueClass = tone === 'onPrimary' ? 'text-primary-foreground' : 'text-foreground'
  const labelClass = tone === 'onPrimary' ? 'text-primary-foreground/65' : 'text-foreground/55'

  useEffect(() => {
    let active = true
    getPublicStats()
      .then((s) => active && setStats(s))
      .catch(() => active && setStats(null))
      .finally(() => active && setLoaded(true))
    return () => {
      active = false
    }
  }, [])

  const real = stats && stats.total_sent >= REAL_THRESHOLD

  // Illustrative fallback (pre-threshold or fetch failure).
  const metrics: Metric[] = real
    ? [
        { label: 'Requests sent', value: stats!.total_sent.toLocaleString() },
        {
          label: 'Approval rate',
          value: stats!.approval_rate != null ? `${stats!.approval_rate}%` : '—',
        },
        {
          label: 'Avg response',
          value:
            stats!.avg_response_hours != null
              ? formatHours(stats!.avg_response_hours)
              : '—',
        },
        { label: 'Teams onboard', value: stats!.active_users.toLocaleString() },
      ]
    : [
        { label: 'Built for', value: 'Fast teams' },
        { label: 'Approver setup', value: 'Zero' },
        { label: 'Follow-up emails', value: 'None' },
        { label: 'Time to send', value: 'Seconds' },
      ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-lg">
      {metrics.map((m) => (
        <div key={m.label} className="text-center sm:text-left">
          <div className={`text-lg lg:text-xl font-heading font-semibold tabular-nums ${valueClass}`}>
            {/* Animate count-ups only for the real numeric values */}
            {real && m.label === 'Requests sent' && loaded ? (
              <CountUpStat target={stats!.total_sent} run />
            ) : real && m.label === 'Teams onboard' && loaded ? (
              <CountUpStat target={stats!.active_users} run />
            ) : (
              m.value
            )}
          </div>
          <div className={`text-xs mt-1 ${labelClass}`}>{m.label}</div>
        </div>
      ))}
    </div>
  )
}

function formatHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}m`
  if (h < 48) return `${h % 1 === 0 ? h : h.toFixed(1)}h`
  return `${Math.round(h / 24)}d`
}
