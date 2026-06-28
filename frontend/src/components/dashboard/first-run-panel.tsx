import Link from 'next/link'
import { Send, MousePointerClick, BellRing, Plus } from 'lucide-react'

const STEPS = [
  { Icon: Send, text: 'Send a request by email' },
  { Icon: MousePointerClick, text: 'They approve or reject in one click' },
  { Icon: BellRing, text: 'Reminders + tracking run themselves' },
]

/** Shown in the dashboard detail pane when the user has no requests yet. */
export function FirstRunPanel() {
  return (
    <div className="flex h-full items-center justify-center overflow-y-auto p-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <Send className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-xl font-heading font-semibold tracking-tight text-foreground">
          Send your first approval request
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          It takes about a minute. Add an approver and a title, and YesDrop handles the rest.
        </p>

        <div className="mx-auto mt-6 space-y-2 text-left">
          {STEPS.map(({ Icon, text }, i) => (
            <div key={text} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
              <span className="data-num text-sm font-semibold text-muted-foreground">{i + 1}</span>
              <Icon className="h-4 w-4 shrink-0 text-primary" />
              <span className="text-sm text-foreground">{text}</span>
            </div>
          ))}
        </div>

        <Link
          href="/requests/new?welcome=1"
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> New request
        </Link>
      </div>
    </div>
  )
}
