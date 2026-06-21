'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Clock, Plus, Check, Trash2, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { DateTimePickerModal } from './date-time-picker-modal'
import type { Reminder } from '@/lib/api'

interface FollowUpModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (reminders: Reminder[]) => void
  initialReminders?: Reminder[]
  deadlineDateTime?: string
}

export function FollowUpModal({
  open,
  onOpenChange,
  onSave,
  initialReminders,
  deadlineDateTime,
}: FollowUpModalProps) {
  const [reminders, setReminders] = useState<Reminder[]>(initialReminders || [])
  const [pickerIndex, setPickerIndex] = useState<number | null>(null)

  const addReminder = (kind: Reminder['kind']) => {
    setReminders((r) => [...r, { kind, send_at: '', custom_message: '' }])
  }

  const updateReminder = (i: number, patch: Partial<Reminder>) => {
    setReminders((r) => r.map((rem, idx) => (idx === i ? { ...rem, ...patch } : rem)))
  }

  const removeReminder = (i: number) => {
    setReminders((r) => r.filter((_, idx) => idx !== i))
  }

  const handlePicked = (datetime: string) => {
    if (pickerIndex !== null) {
      // Store as absolute UTC so the backend gets exact times (no day rounding).
      updateReminder(pickerIndex, { send_at: new Date(datetime).toISOString() })
    }
    setPickerIndex(null)
  }

  const handleSave = () => {
    // Drop incomplete rows (no time picked yet).
    onSave(reminders.filter((r) => r.send_at))
    onOpenChange(false)
  }

  const pickingKind = pickerIndex !== null ? reminders[pickerIndex]?.kind : undefined

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Reminders</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 max-h-[55vh] overflow-y-auto">
            {reminders.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No reminders yet. Add one or more below.
              </p>
            )}

            {reminders.map((rem, i) => (
              <div key={i} className="p-4 bg-secondary/50 rounded-xl border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <div className="inline-flex rounded-lg border border-border overflow-hidden text-xs font-medium">
                    <button
                      type="button"
                      onClick={() => updateReminder(i, { kind: 'before_deadline' })}
                      className={`px-3 py-1.5 ${rem.kind === 'before_deadline' ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground/70'}`}
                    >
                      Before deadline
                    </button>
                    <button
                      type="button"
                      onClick={() => updateReminder(i, { kind: 'after_sending' })}
                      className={`px-3 py-1.5 ${rem.kind === 'after_sending' ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground/70'}`}
                    >
                      After sending
                    </button>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeReminder(i)} className="h-8 w-8 p-0">
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>

                <button
                  type="button"
                  onClick={() => setPickerIndex(i)}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-background border border-border rounded-lg text-left hover:border-primary/50 transition-colors"
                >
                  <Calendar className="h-4 w-4 text-foreground/50" />
                  <span className={rem.send_at ? 'text-foreground text-sm' : 'text-foreground/40 text-sm'}>
                    {rem.send_at ? format(new Date(rem.send_at), 'EEEE, MMMM d, yyyy p') : 'Set reminder time'}
                  </span>
                </button>

                <input
                  type="text"
                  value={rem.custom_message || ''}
                  onChange={(e) => updateReminder(i, { custom_message: e.target.value })}
                  placeholder="Optional custom message for this reminder"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:border-primary"
                />
              </div>
            ))}

            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => addReminder('before_deadline')} className="flex-1">
                <Plus className="h-4 w-4 mr-1" /> Before deadline
              </Button>
              <Button variant="outline" size="sm" onClick={() => addReminder('after_sending')} className="flex-1">
                <Clock className="h-4 w-4 mr-1" /> After sending
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              <Check className="h-4 w-4 mr-2" />
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DateTimePickerModal
        open={pickerIndex !== null}
        onOpenChange={(o) => !o && setPickerIndex(null)}
        onDateTimeSelect={handlePicked}
        label={pickingKind === 'before_deadline' ? 'Reminder time (before deadline)' : 'Follow-up time (after sending)'}
        maxDate={pickingKind === 'before_deadline' && deadlineDateTime ? new Date(deadlineDateTime) : undefined}
      />
    </>
  )
}
