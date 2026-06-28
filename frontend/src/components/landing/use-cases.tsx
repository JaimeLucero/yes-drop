'use client'

import { useState } from 'react'
import { Paperclip, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type Example = {
  tab: string
  title: string
  approver: string
  blurb: string
  file: string
  deadline: string
}

const EXAMPLES: Example[] = [
  {
    tab: 'Expense approvals',
    title: 'Q3 marketing budget',
    approver: 'cfo@acme.com',
    blurb: 'Requesting sign-off on the Q3 marketing spend. Breakdown attached.',
    file: 'budget-q3.pdf',
    deadline: 'Respond by Fri',
  },
  {
    tab: 'Contract sign-off',
    title: 'Vendor MSA renewal',
    approver: 'legal@acme.com',
    blurb: 'Renewing the MSA with Northwind. Redlines included for review.',
    file: 'northwind-msa.pdf',
    deadline: 'Respond by Tue',
  },
  {
    tab: 'Hiring',
    title: 'Offer — Senior Engineer',
    approver: 'head.of.eng@acme.com',
    blurb: 'Approval to extend an offer at the proposed band. Scorecard attached.',
    file: 'offer-packet.pdf',
    deadline: 'Respond by EOD',
  },
  {
    tab: 'Custom',
    title: 'Publish the launch post',
    approver: 'comms@acme.com',
    blurb: 'Final go/no-go on the launch announcement before it ships.',
    file: 'launch-post.pdf',
    deadline: 'Respond in 24h',
  },
]

export function UseCases() {
  const [active, setActive] = useState(0)
  const ex = EXAMPLES[active]

  return (
    <section className="border-t border-border bg-card/40 py-24">
      <div className="mx-auto max-w-5xl px-6">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-heading font-semibold tracking-tight lg:text-4xl">Whatever needs a yes</h2>
          <p className="mx-auto mt-3 max-w-2xl text-lg text-muted-foreground">
            Same flow for any sign-off — pick one to see the request.
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-8 flex flex-wrap justify-center gap-2">
          {EXAMPLES.map((e, i) => (
            <button
              key={e.tab}
              onClick={() => setActive(i)}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-medium transition-colors',
                i === active
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border bg-card text-muted-foreground hover:text-foreground'
              )}
              aria-pressed={i === active}
            >
              {e.tab}
            </button>
          ))}
        </div>

        {/* Example request */}
        <div className="mx-auto max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-start gap-3 p-5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
              {ex.approver[0].toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{ex.title}</p>
              <p className="truncate text-xs text-muted-foreground">{ex.approver}</p>
            </div>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
              {ex.deadline}
            </span>
          </div>
          <div className="px-5 pb-5">
            <p className="mb-2 text-xs leading-relaxed text-muted-foreground">{ex.blurb}</p>
            <div className="mb-4 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Paperclip className="h-3 w-3" /> {ex.file}
            </div>
            <div className="flex gap-2">
              <span className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-500 py-2 text-xs font-semibold text-white">
                <Check className="h-3.5 w-3.5" /> Approve
              </span>
              <span className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-card py-2 text-xs font-semibold text-muted-foreground">
                <X className="h-3.5 w-3.5" /> Reject
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
