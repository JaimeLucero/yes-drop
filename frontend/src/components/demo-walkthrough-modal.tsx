'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Send,
  Mail,
  MousePointerClick,
  LayoutDashboard,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Paperclip,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface DemoWalkthroughModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const AUTO_ADVANCE_MS = 5000

const steps = [
  {
    icon: Send,
    title: 'Send a request by email',
    caption: 'Add who approves, a title, a deadline, and any files. Send now or schedule it for later.',
    Panel: CreatePanel,
  },
  {
    icon: Mail,
    title: 'Your approver gets an email',
    caption: 'A clean, branded email lands in their inbox with one-click Approve and Reject buttons. No account, no sign-in.',
    Panel: EmailPanel,
  },
  {
    icon: MousePointerClick,
    title: 'One click to decide',
    caption: 'They tap a button and optionally leave a comment. That is the entire approver experience.',
    Panel: DecisionPanel,
  },
  {
    icon: LayoutDashboard,
    title: 'Reminders + tracking, automatic',
    caption: 'Automatic reminders chase non-responders until your deadline, and your dashboard updates live — so you never write a follow-up again.',
    Panel: DashboardPanel,
  },
]

export function DemoWalkthroughModal({ open, onOpenChange }: DemoWalkthroughModalProps) {
  const [step, setStep] = useState(0)
  const [paused, setPaused] = useState(false)

  // Reset to first step whenever the modal is opened.
  useEffect(() => {
    if (open) {
      setStep(0)
      setPaused(false)
    }
  }, [open])

  // Auto-advance until the last step, unless the user has taken manual control.
  useEffect(() => {
    if (!open || paused || step >= steps.length - 1) return
    const timer = setTimeout(() => setStep((s) => Math.min(s + 1, steps.length - 1)), AUTO_ADVANCE_MS)
    return () => clearTimeout(timer)
  }, [open, paused, step])

  const goTo = (next: number) => {
    setPaused(true)
    setStep(Math.max(0, Math.min(next, steps.length - 1)))
  }

  const current = steps[step]
  const Panel = current.Panel
  const isLast = step === steps.length - 1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <current.icon className="h-4 w-4 text-primary" />
            </span>
            {current.title}
          </DialogTitle>
        </DialogHeader>

        <div className="py-2">
          {/* Mock product panel */}
          <div className="rounded-2xl border border-border bg-secondary/40 p-5 min-h-[260px] flex items-center justify-center">
            <Panel />
          </div>

          <p className="mt-4 text-sm text-foreground/70 leading-relaxed text-center px-4 min-h-[40px]">
            {current.caption}
          </p>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2">
          {steps.map((s, i) => (
            <button
              key={s.title}
              aria-label={`Go to step ${i + 1}`}
              onClick={() => goTo(i)}
              className={`h-2 rounded-full transition-all ${
                i === step ? 'w-6 bg-primary' : 'w-2 bg-border hover:bg-primary/40'
              }`}
            />
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <button
            onClick={() => goTo(step - 1)}
            disabled={step === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-foreground/70 rounded-lg hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>

          {isLast ? (
            <Link href="/login">
              <button className="group inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors">
                Get started free
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </Link>
          ) : (
            <button
              onClick={() => goTo(step + 1)}
              className="group inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors"
            >
              Next
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ---------- Mock panels (purely illustrative, no backend) ---------- */

function CreatePanel() {
  return (
    <div className="w-full max-w-sm space-y-3 text-left">
      <Field label="Approver email" value="cfo@acme.com" />
      <Field label="Title" value="Q3 Marketing Budget" />
      <div>
        <p className="text-xs font-medium text-foreground/50 mb-1">Attachment</p>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground/70">
          <Paperclip className="h-4 w-4 text-foreground/40" />
          budget-q3.pdf
        </div>
      </div>
      <div className="flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground py-2.5 text-sm font-medium">
        <Send className="h-4 w-4" /> Send request
      </div>
    </div>
  )
}

function EmailPanel() {
  return (
    <div className="w-full max-w-sm overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="bg-primary px-4 py-3">
        <p className="text-primary-foreground font-semibold text-sm">YesDrop</p>
        <p className="text-primary-foreground/80 text-[11px]">Approval request from you@acme.com</p>
      </div>
      <div className="p-4 space-y-3">
        <div className="border-l-4 border-primary bg-secondary/50 px-3 py-2 rounded">
          <p className="font-semibold text-sm text-foreground">Q3 Marketing Budget</p>
          <p className="text-[11px] text-foreground/50">Needs your approval</p>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 text-white py-2 text-xs font-semibold">
            <CheckCircle className="h-3.5 w-3.5" /> Approve
          </div>
          <div className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-red-500 text-white py-2 text-xs font-semibold">
            <XCircle className="h-3.5 w-3.5" /> Reject
          </div>
        </div>
      </div>
    </div>
  )
}

function DecisionPanel() {
  return (
    <div className="w-full max-w-sm space-y-4 text-center">
      <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
        <CheckCircle className="h-5 w-5" /> Approved
      </div>
      <div className="rounded-lg border border-border bg-background px-3 py-2 text-left">
        <p className="text-xs font-medium text-foreground/50 mb-1">Comment (optional)</p>
        <p className="text-sm text-foreground/80">Looks good, approved for Q3.</p>
      </div>
      <p className="text-xs text-foreground/50">No login. No app to download. Just a decision.</p>
    </div>
  )
}

function DashboardPanel() {
  const rows = [
    { title: 'Q3 Marketing Budget', state: 'Approved', color: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
    { title: 'Vendor Contract', state: 'Pending', color: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
    { title: 'Hiring Req #214', state: 'Reminder sent', color: 'text-blue-600 dark:text-blue-400', dot: 'bg-blue-500' },
  ]
  return (
    <div className="w-full max-w-sm space-y-2">
      {rows.map((r) => (
        <div key={r.title} className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${r.dot}`} />
            <span className="text-sm font-medium text-foreground">{r.title}</span>
          </div>
          <span className={`text-xs font-semibold ${r.color}`}>{r.state}</span>
        </div>
      ))}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-foreground/50 mb-1">{label}</p>
      <div className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">{value}</div>
    </div>
  )
}
