import { Send, MousePointerClick, BellRing, type LucideIcon } from 'lucide-react'

const STEPS: { n: string; Icon: LucideIcon; title: string; desc: string }[] = [
  {
    n: '1',
    Icon: Send,
    title: 'Send by email',
    desc: 'Add an approver, a title, and a deadline, then hit send. Schedule it for later if you like.',
  },
  {
    n: '2',
    Icon: MousePointerClick,
    title: 'They decide in one click',
    desc: 'Your approver approves or rejects straight from the email — no account, no login.',
  },
  {
    n: '3',
    Icon: BellRing,
    title: 'Track + auto-reminders',
    desc: 'Status updates live, and reminders chase non-responders until your deadline.',
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-14 text-center">
          <span className="mb-3 inline-block text-sm font-medium uppercase tracking-wide text-primary">
            How it works
          </span>
          <h2 className="text-3xl font-heading font-semibold tracking-tight lg:text-4xl">
            Three steps, then it runs itself
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="group rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                  <s.Icon className="h-5 w-5" />
                </div>
                <span className="data-num text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Step {s.n}
                </span>
              </div>
              <h3 className="mb-1.5 font-heading text-lg font-semibold text-foreground">{s.title}</h3>
              <p className="leading-relaxed text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
