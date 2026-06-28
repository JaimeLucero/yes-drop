import { ChevronDown } from 'lucide-react'

const FAQS: { q: string; a: string }[] = [
  {
    q: 'Does my approver need a YesDrop account?',
    a: 'No. They get an email with Approve and Reject buttons and decide in one click — no sign-up, no login.',
  },
  {
    q: 'How do I sign in?',
    a: 'With Google, or with an email and password. New email accounts confirm their address once before sending.',
  },
  {
    q: 'What happens if nobody responds?',
    a: 'You set a deadline, and YesDrop sends automatic reminders until then. If the deadline passes with no answer, the request is marked ignored — nothing sits open forever.',
  },
  {
    q: 'Can I attach files?',
    a: 'Yes. Attach a document to any request so your approver has the full context before deciding.',
  },
  {
    q: 'How much does it cost?',
    a: 'You can start for free and send your first requests in minutes — no credit card required.',
  },
]

export function Faq() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-3xl px-6">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-heading font-semibold tracking-tight lg:text-4xl">Questions, answered</h2>
        </div>

        <div className="divide-y divide-border rounded-2xl border border-border bg-card">
          {FAQS.map((item) => (
            <details key={item.q} className="group px-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-left font-heading font-medium text-foreground [&::-webkit-details-marker]:hidden">
                {item.q}
                <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <p className="pb-5 leading-relaxed text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
