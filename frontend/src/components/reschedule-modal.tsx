'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Calendar, Clock, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar as CalendarPicker } from '@/components/ui/calendar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { DateTimePickerModal } from './date-time-picker-modal'

interface FollowUpConfig {
  beforeDeadline?: string
  afterSending?: string
}

interface RescheduleModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onReschedule: (datetime: string, deadlineDays?: number, followUpStrategy?: { enabled: boolean; days_before_deadline?: number; days_after_sending?: number }) => void
  initialDate?: string | null
  initialDeadline?: string | null
  initialFollowUp?: { enabled: boolean; days_before_deadline?: number; days_after_sending?: number } | null
}

function calculateDaysUntil(datetimeString: string): number {
  const now = new Date()
  const target = new Date(datetimeString)
  const diffMs = target.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  return Math.max(1, diffDays)
}

export function RescheduleModal({ 
  open, 
  onOpenChange, 
  onReschedule,
  initialDate,
  initialDeadline,
  initialFollowUp
}: RescheduleModalProps) {
  const [date, setDate] = useState<Date | undefined>(
    initialDate ? new Date(initialDate) : new Date()
  )
  const [time, setTime] = useState({ hours: 9, minutes: 0 })
  const [deadlineDateTime, setDeadlineDateTime] = useState<string>(
    initialDeadline || ''
  )
  const [followUpConfig, setFollowUpConfig] = useState<FollowUpConfig>({})
  const [showDeadlinePicker, setShowDeadlinePicker] = useState(false)
  const [showFollowUpPicker, setShowFollowUpPicker] = useState(false)
  const [addingFollowUpType, setAddingFollowUpType] = useState<'before' | 'after' | null>(null)
  const [serverTime, setServerTime] = useState<Date | null>(null)

  useEffect(() => {
    const syncServerTime = async () => {
      try {
        const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL!
        const response = await fetch(`${BACKEND_URL}/health`)
        const serverDateStr = response.headers.get('date')
        if (serverDateStr) {
          setServerTime(new Date(serverDateStr))
        } else {
          setServerTime(new Date())
        }
      } catch (error) {
        setServerTime(new Date())
      }
    }

    if (open) {
      syncServerTime()
    }
  }, [open])

  const now = new Date()
  const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const currentLocalHours = now.getHours()
  const currentLocalMinutes = now.getMinutes()

  const isTimeInPast = date &&
    date.getTime() === todayLocal.getTime() &&
    (time.hours < currentLocalHours || (time.hours === currentLocalHours && time.minutes <= currentLocalMinutes))

  const handleReschedule = () => {
    if (!date || isTimeInPast) return

    const localDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      time.hours,
      time.minutes
    )

    const isoString = localDate.toISOString() // Convert to UTC
    const deadlineDays = deadlineDateTime ? calculateDaysUntil(deadlineDateTime) : 3
    
    const followUpStrategy = (followUpConfig.beforeDeadline || followUpConfig.afterSending) ? {
      enabled: true,
      days_before_deadline: followUpConfig.beforeDeadline ? calculateDaysUntil(followUpConfig.beforeDeadline) : undefined,
      days_after_sending: followUpConfig.afterSending ? calculateDaysUntil(followUpConfig.afterSending) : undefined,
    } : { enabled: false }

    onReschedule(isoString, deadlineDays, followUpStrategy)
    onOpenChange(false)
  }

  const handleFollowUpSelect = (datetime: string) => {
    if (addingFollowUpType === 'before') {
      setFollowUpConfig({ ...followUpConfig, beforeDeadline: datetime })
    } else if (addingFollowUpType === 'after') {
      setFollowUpConfig({ ...followUpConfig, afterSending: datetime })
    }
    setShowFollowUpPicker(false)
    setAddingFollowUpType(null)
  }

  const handleRemoveFollowUp = (type: 'before' | 'after') => {
    if (type === 'before') {
      setFollowUpConfig({ ...followUpConfig, beforeDeadline: undefined })
    } else {
      setFollowUpConfig({ ...followUpConfig, afterSending: undefined })
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Reschedule Request</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Send Date Picker */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Send Date</label>
              <div className="flex justify-center">
                <CalendarPicker
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                />
              </div>
            </div>

            {/* Time Picker */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Send Time</label>
              <div className="flex gap-2 justify-center">
                <select
                  value={time.hours}
                  onChange={(e) => {
                    const hours = parseInt(e.target.value)
                    setTime({ ...time, hours })
                  }}
                  className="h-10 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {Array.from({ length: 24 }, (_, i) => {
                    const isDisabled = date && date.getTime() === todayLocal.getTime() && i < currentLocalHours
                    return (
                      <option key={i} value={i} disabled={isDisabled}>
                        {i.toString().padStart(2, '0')}
                      </option>
                    )
                  })}
                </select>
                <span className="flex items-center text-foreground font-medium">:</span>
                <select
                  value={time.minutes}
                  onChange={(e) => setTime({ ...time, minutes: parseInt(e.target.value) })}
                  className="h-10 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => {
                    const isDisabled = date &&
                      date.getTime() === todayLocal.getTime() &&
                      time.hours === currentLocalHours &&
                      m <= currentLocalMinutes
                    return (
                      <option key={m} value={m} disabled={isDisabled}>
                        {m.toString().padStart(2, '0')}
                      </option>
                    )
                  })}
                </select>
              </div>
            </div>

            {/* Deadline Settings */}
            <div className="border-t border-border pt-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Deadline & Reminders</h3>
              
              {/* Deadline */}
              <div className="mb-3">
                <button
                  type="button"
                  onClick={() => setShowDeadlinePicker(true)}
                  className="w-full flex items-center gap-2 px-4 py-3 bg-background border-2 border-border rounded-xl text-foreground hover:border-primary/50 focus:outline-none focus:border-primary transition-all text-left"
                >
                  <Clock className="h-5 w-5 text-foreground/60" />
                  <span className={deadlineDateTime ? 'text-foreground font-medium' : 'text-foreground/40'}>
                    {deadlineDateTime
                      ? `Deadline: ${format(new Date(deadlineDateTime), 'MMM d, p')}`
                      : 'Set response deadline'}
                  </span>
                </button>
              </div>

              {/* Follow-ups */}
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-background rounded-lg border border-border">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-600" />
                    <span className="text-sm text-foreground">Before Deadline</span>
                  </div>
                  {followUpConfig.beforeDeadline ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-foreground/60">
                        {format(new Date(followUpConfig.beforeDeadline), 'MMM d, p')}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveFollowUp('before')}
                        className="h-6 w-6 p-0"
                      >
                        <Trash2 className="h-3 w-3 text-red-500" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setAddingFollowUpType('before')
                        setShowFollowUpPicker(true)
                      }}
                      className="h-6"
                    >
                      <Plus className="h-3 w-3 mr-1" /> Add
                    </Button>
                  )}
                </div>

                <div className="flex items-center justify-between p-3 bg-background rounded-lg border border-border">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-600" />
                    <span className="text-sm text-foreground">After Sending</span>
                  </div>
                  {followUpConfig.afterSending ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-foreground/60">
                        {format(new Date(followUpConfig.afterSending), 'MMM d, p')}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveFollowUp('after')}
                        className="h-6 w-6 p-0"
                      >
                        <Trash2 className="h-3 w-3 text-red-500" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setAddingFollowUpType('after')
                        setShowFollowUpPicker(true)
                      }}
                      className="h-6"
                    >
                      <Plus className="h-3 w-3 mr-1" /> Add
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleReschedule} disabled={!date || isTimeInPast}>
              {isTimeInPast ? 'Select future time' : 'Reschedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deadline Picker */}
      <DateTimePickerModal
        open={showDeadlinePicker}
        onOpenChange={setShowDeadlinePicker}
        onDateTimeSelect={setDeadlineDateTime}
        initialDateTime={deadlineDateTime}
        label="Set Response Deadline"
        minDate={new Date(new Date().getTime() + 60 * 60 * 1000)}
      />

      {/* Follow-up Picker */}
      <DateTimePickerModal
        open={showFollowUpPicker}
        onOpenChange={setShowFollowUpPicker}
        onDateTimeSelect={handleFollowUpSelect}
        label={addingFollowUpType === 'before' ? "Select Reminder Time (Before Deadline)" : "Select Follow-up Time (After Sending)"}
        maxDate={addingFollowUpType === 'before' && deadlineDateTime ? new Date(deadlineDateTime) : undefined}
      />
    </>
  )
}
