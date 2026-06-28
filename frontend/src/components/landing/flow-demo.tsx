'use client'

import { useEffect, useState } from 'react'
import { Send, Check, X, Paperclip, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const STEPS = ['Send by email', 'They decide', 'You track'] as const

/**
 * Hero signature: a looping demo of the core loop — send a request, the approver
 * decides in one click, the dashboard updates. CSS crossfade between three stacked
 * panels; pauses/holds the final state under prefers-reduced-motion.
 */
export function FlowDemo() {
  const [step, setStep] = useState(0)
  const [auto, setAuto] = useState(true)

  useEffect(() => {
    if (!auto) return
    // Respect reduced-motion: leave the first panel showing, don't cycle.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => setStep((s) => (s + 1) % 3), 2600)
    return () => clearInterval(t)
  }, [auto])

  const select = (i: number) => {
    setAuto(false)
    setStep(i)
  }

  return (
    <div className="w-full max-w-md">
      <div className="relative h-[380px]">
        <Panel active={step === 0}>
          <SendPanel />
        </Panel>
        <Panel active={step === 1}>
          <DecidePanel />
        </Panel>
        <Panel active={step === 2}>
          <TrackPanel />
        </Panel>
      </div>

      {/* Step indicator */}
      <div className="mt-5 flex items-center justify-center gap-2">
        {STEPS.map((label, i) => (
          <button
            key={label}
            onClick={() => select(i)}
            className={cn(
              'flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              i === step ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
            )}
            aria-current={i === step ? 'step' : undefined}
          >
            <span className="data-num">{i + 1}</span>
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function Panel({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'absolute inset-0 transition-all duration-500 ease-out',
        active ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0'
      )}
      aria-hidden={!active}
    >
      {children}
    </div>
  )
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
      <div className="border-b border-border px-5 py-3">
        <span className="text-sm font-heading font-semibold text-foreground">{title}</span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">{value}</div>
    </div>
  )
}

function SendPanel() {
  return (
    <Shell title="New request">
      <div className="space-y-3">
        <Row label="Approver" value="cfo@acme.com" />
        <Row label="Title" value="Budget approval — Q3" />
        <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Paperclip className="h-3.5 w-3.5" /> budget-q3.pdf
        </div>
        <div className="flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground">
          <Send className="h-4 w-4" /> Send request
        </div>
      </div>
    </Shell>
  )
}

function DecidePanel() {
  return (
    <Shell title="Approver's inbox">
      <div className="space-y-4">
        <div className="rounded-lg border-l-2 border-primary bg-secondary/50 px-3 py-2">
          <p className="text-sm font-semibold text-foreground">Budget approval — Q3</p>
          <p className="text-xs text-muted-foreground">from you@acme.com · needs your approval</p>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Requesting sign-off on the Q3 marketing budget. Details attached.
        </p>
        <div className="flex gap-2">
          <span className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-500 py-2.5 text-sm font-semibold text-white">
            <Check className="h-4 w-4" /> Approve
          </span>
          <span className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-card py-2.5 text-sm font-semibold text-muted-foreground">
            <X className="h-4 w-4" /> Reject
          </span>
        </div>
        <p className="text-center text-[11px] text-muted-foreground">No account. No login. One click.</p>
      </div>
    </Shell>
  )
}

function TrackPanel() {
  return (
    <Shell title="Your dashboard">
      <div className="space-y-2.5">
        <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 dark:border-emerald-900 dark:bg-emerald-950/30">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">Budget approval — Q3</p>
            <p className="truncate text-xs text-muted-foreground">cfo@acme.com approved · just now</p>
          </div>
          <span className="rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
            Approved
          </span>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 opacity-70">
          <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">Contract review</p>
            <p className="truncate text-xs text-muted-foreground">reminder sent · awaiting reply</p>
          </div>
          <span className="data-num text-[11px] text-muted-foreground">1h</span>
        </div>
      </div>
    </Shell>
  )
}
