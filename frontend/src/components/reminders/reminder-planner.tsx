'use client'

import { useState } from 'react'
import { Calendar, Sparkles, Plus, X, Bell } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { DateTimePickerModal } from '@/components/date-time-picker-modal'
import { generateReminderPlan, type Reminder } from '@/lib/api'

const DAY = 86_400_000

interface ReminderPlannerProps {
  deadlineDateTime: string
  onDeadlineChange: (iso: string) => void
  reminders: Reminder[]
  onRemindersChange: (reminders: Reminder[]) => void
  /** When the request will be sent (ISO); empty/undefined means "now". */
  baseTime?: string | null
}

const TEMPLATES = [
  { id: 'gentle', label: 'Gentle', hint: '1 nudge before the deadline' },
  { id: 'standard', label: 'Standard', hint: 'A follow-up + a deadline nudge' },
  { id: 'persistent', label: 'Persistent', hint: 'Chase until the deadline' },
] as const

function sortByTime(rs: Reminder[]): Reminder[] {
  return [...rs].sort((a, b) => a.send_at.localeCompare(b.send_at))
}

export function ReminderPlanner({
  deadlineDateTime,
  onDeadlineChange,
  reminders,
  onRemindersChange,
  baseTime,
}: ReminderPlannerProps) {
  const [deadlineOpen, setDeadlineOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [intent, setIntent] = useState('')
  const [generating, setGenerating] = useState(false)

  const base = baseTime && baseTime.length ? baseTime : null
  const baseDate = base ? new Date(base) : new Date()

  function ensureDeadline(): number {
    if (deadlineDateTime) return new Date(deadlineDateTime).getTime()
    const iso = new Date(baseDate.getTime() + 5 * DAY).toISOString()
    onDeadlineChange(iso)
    return new Date(iso).getTime()
  }

  function applyTemplate(id: string) {
    const dl = ensureDeadline()
    const b = baseDate.getTime()
    let rs: Reminder[] = []
    if (id === 'gentle') {
      rs = [{ kind: 'before_deadline', send_at: new Date(dl - DAY).toISOString() }]
    } else if (id === 'standard') {
      rs = [
        { kind: 'after_sending', send_at: new Date(b + DAY).toISOString() },
        { kind: 'before_deadline', send_at: new Date(dl - DAY).toISOString() },
      ]
    } else {
      rs = [
        { kind: 'after_sending', send_at: new Date(b + DAY).toISOString() },
        { kind: 'after_sending', send_at: new Date(b + 3 * DAY).toISOString() },
        { kind: 'before_deadline', send_at: new Date(dl - DAY / 2).toISOString() },
      ]
    }
    // Keep only reminders that fall before the deadline (offsets are already
    // future-relative to the send time / deadline).
    rs = rs.filter((r) => new Date(r.send_at).getTime() < dl)
    onRemindersChange(sortByTime(rs))
  }

  async function generate() {
    if (!intent.trim()) return
    setGenerating(true)
    try {
      const plan = await generateReminderPlan(intent, base, deadlineDateTime || null)
      if (plan.deadline) onDeadlineChange(plan.deadline)
      onRemindersChange(sortByTime(plan.reminders || []))
      toast.success(`Added ${plan.reminders?.length || 0} reminder${plan.reminders?.length === 1 ? '' : 's'}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not generate a schedule')
    } finally {
      setGenerating(false)
    }
  }

  function addManual(iso: string) {
    const kind: Reminder['kind'] =
      deadlineDateTime && new Date(iso) < new Date(deadlineDateTime) ? 'before_deadline' : 'after_sending'
    onRemindersChange(sortByTime([...reminders, { kind, send_at: iso }]))
  }

  return (
    <div className="space-y-4">
      {/* Deadline */}
      <div>
        <label className="mb-2 block text-sm font-medium text-foreground">Response deadline</label>
        <button
          type="button"
          onClick={() => setDeadlineOpen(true)}
          className="flex w-full items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-left text-foreground transition-all hover:border-primary/50"
        >
          <Calendar className="h-5 w-5 text-foreground/60" />
          <span className={deadlineDateTime ? 'font-medium text-foreground' : 'text-foreground/40'}>
            {deadlineDateTime ? format(new Date(deadlineDateTime), 'EEEE, MMMM d, yyyy p') : 'Set a deadline (optional)'}
          </span>
          {deadlineDateTime && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                onDeadlineChange('')
              }}
              className="ml-auto rounded p-1 text-foreground/40 hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </span>
          )}
        </button>
        <p className="mt-1 text-xs text-foreground/50">Requests are marked ignored if no response arrives by this time.</p>
      </div>

      {/* Templates */}
      <div>
        <label className="mb-2 block text-sm font-medium text-foreground">Quick follow-up plan</label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => applyTemplate(t.id)}
              className="rounded-lg border border-border bg-card px-3 py-2.5 text-left transition-all hover:border-primary/50"
            >
              <span className="block text-sm font-medium text-foreground">{t.label}</span>
              <span className="block text-xs text-foreground/50">{t.hint}</span>
            </button>
          ))}
        </div>
      </div>

      {/* AI */}
      <div className="rounded-lg border border-border bg-secondary/40 p-3">
        <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-foreground">
          <Sparkles className="h-4 w-4 text-primary" />
          Describe your follow-up plan
        </label>
        <textarea
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          rows={2}
          placeholder="e.g. nudge them a day after sending, then again 12 hours before the deadline"
          className="w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 focus:border-primary focus:outline-none"
        />
        <button
          type="button"
          onClick={generate}
          disabled={generating || !intent.trim()}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {generating ? 'Generating…' : 'Generate reminders'}
        </button>
      </div>

      {/* Reminder list */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">
            Reminders {reminders.length > 0 && <span className="text-foreground/40">({reminders.length})</span>}
          </label>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
        {reminders.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-foreground/40">
            No reminders. Pick a plan above, describe one, or add your own.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {reminders.map((r, i) => (
              <li
                key={`${r.send_at}-${i}`}
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
              >
                <Bell className="h-4 w-4 shrink-0 text-foreground/40" />
                <div className="flex-1">
                  <span className="block text-sm font-medium text-foreground">
                    {format(new Date(r.send_at), 'EEE, MMM d • p')}
                  </span>
                  <span className="block text-xs text-foreground/50">
                    {r.kind === 'before_deadline' ? 'Before deadline' : 'After sending'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onRemindersChange(reminders.filter((_, idx) => idx !== i))}
                  className="rounded p-1 text-foreground/40 transition-colors hover:text-red-500"
                  aria-label="Remove reminder"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <DateTimePickerModal
        open={deadlineOpen}
        onOpenChange={setDeadlineOpen}
        onDateTimeSelect={(iso) => onDeadlineChange(iso)}
        initialDateTime={deadlineDateTime || null}
        label="Set response deadline"
        minDate={baseDate}
      />
      <DateTimePickerModal
        open={addOpen}
        onOpenChange={setAddOpen}
        onDateTimeSelect={addManual}
        label="Add a reminder"
        minDate={baseDate}
        maxDate={deadlineDateTime ? new Date(deadlineDateTime) : undefined}
      />
    </div>
  )
}
