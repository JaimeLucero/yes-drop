'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Calendar as CalendarIcon, Clock, Plus, Trash2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
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

interface ScheduleModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSchedule: (datetime: string, followUpStrategy?: { enabled: boolean; days_before_deadline?: number; days_after_sending?: number }, deadlineDays?: number) => void
  initialDate?: string | null
}

function calculateDaysUntil(datetimeString: string): number {
  const now = new Date()
  const target = new Date(datetimeString)
  const diffMs = target.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  return Math.max(1, diffDays)
}

export function ScheduleModal({ open, onOpenChange, onSchedule, initialDate }: ScheduleModalProps) {
  const [date, setDate] = useState<Date | undefined>(
    initialDate ? new Date(initialDate) : new Date()
  )
  const [time, setTime] = useState({ hours: 9, minutes: 0 })
  const [deadlineDays, setDeadlineDays] = useState(3)
  const [followUpEnabled, setFollowUpEnabled] = useState(true)
  const [followUpConfig, setFollowUpConfig] = useState<FollowUpConfig>({})
  const [showFollowUpPicker, setShowFollowUpPicker] = useState(false)
  const [addingType, setAddingType] = useState<'before' | 'after' | null>(null)
  const [serverTime, setServerTime] = useState<Date | null>(null)

  // Sync with server time on mount to prevent clock skew issues
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
        console.warn('Could not sync server time, using client time')
        setServerTime(new Date())
      }
    }

    if (open) {
      syncServerTime()
    }
  }, [open])

  // Get current local time to prevent scheduling in the past
  // Use client time since it's in the browser's local timezone (user's timezone)
  const now = new Date()
  const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const currentLocalHours = now.getHours()
  const currentLocalMinutes = now.getMinutes()

  console.log('[ScheduleModal] Browser timezone detected:', Intl.DateTimeFormat().resolvedOptions().timeZone)
  console.log('[ScheduleModal] Current local time:', currentLocalHours.toString().padStart(2, '0') + ':' + currentLocalMinutes.toString().padStart(2, '0'))

  // Check if selected time is in the past
  const isTimeInPast = date &&
    date.getTime() === todayLocal.getTime() &&
    (time.hours < currentLocalHours || (time.hours === currentLocalHours && time.minutes <= currentLocalMinutes))

  const handleSchedule = () => {
    if (!date || isTimeInPast) return

    // Create local datetime - Date constructor automatically handles timezone
    const localDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      time.hours,
      time.minutes
    )

    const isoString = localDate.toISOString()
    console.log('[ScheduleModal] Selected time:', `${time.hours.toString().padStart(2, '0')}:${time.minutes.toString().padStart(2, '0')}`)
    console.log('[ScheduleModal] ISO string being sent:', isoString)
    console.log('[ScheduleModal] Server sync time was:', serverTime)
    console.log('[ScheduleModal] Current calc time was:', currentLocalHours, ':', currentLocalMinutes)

    const followUpStrategy = followUpEnabled && (followUpConfig.beforeDeadline || followUpConfig.afterSending) ? {
      enabled: true,
      days_before_deadline: followUpConfig.beforeDeadline ? calculateDaysUntil(followUpConfig.beforeDeadline) : undefined,
      days_after_sending: followUpConfig.afterSending ? calculateDaysUntil(followUpConfig.afterSending) : undefined,
    } : { enabled: false }

    onSchedule(isoString, followUpStrategy, deadlineDays)
    onOpenChange(false)
  }

  const handleFollowUpSelect = (datetime: string) => {
    if (addingType === 'before') {
      setFollowUpConfig({ ...followUpConfig, beforeDeadline: datetime })
    } else if (addingType === 'after') {
      setFollowUpConfig({ ...followUpConfig, afterSending: datetime })
    }
    setShowFollowUpPicker(false)
    setAddingType(null)
  }

  const handleRemoveFollowUp = (type: 'before' | 'after') => {
    if (type === 'before') {
      setFollowUpConfig({ ...followUpConfig, beforeDeadline: undefined })
    } else {
      setFollowUpConfig({ ...followUpConfig, afterSending: undefined })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Schedule Request</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Date Picker */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Select Date</label>
            <div className="flex justify-center">
              <Calendar
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
            <label className="text-sm font-medium text-foreground">Select Time</label>
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

            {/* Info Text */}
            <div className="space-y-2 text-xs text-muted-foreground pt-2">
              <p>
                Current time: {currentLocalHours.toString().padStart(2, '0')}:{currentLocalMinutes.toString().padStart(2, '0')} (your timezone)
              </p>
              {date && (
                <p className={isTimeInPast ? 'text-red-500 font-medium' : ''}>
                  Selected: {format(date, 'EEEE, MMMM d, yyyy')} at {time.hours.toString().padStart(2, '0')}:{time.minutes.toString().padStart(2, '0')}
                  {isTimeInPast && ' (⚠️ in the past)'}
                </p>
              )}
              <p className="italic">
                Times are synced with server to ensure accuracy
              </p>
            </div>
          </div>

          {/* Follow-up Strategy */}
          <div className="space-y-4 border-t border-border pt-6">
            <h3 className="text-sm font-semibold text-foreground">Follow-up Settings</h3>
            
            {/* Enable/Disable Toggle */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={followUpEnabled}
                onChange={(e) => setFollowUpEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-sm font-medium text-foreground">Enable follow-up reminders</span>
            </label>

            {followUpEnabled && (
              <div className="space-y-4 p-4 bg-secondary/50 rounded-xl border border-border">
                {/* Deadline Duration */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Response Deadline
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={deadlineDays}
                      onChange={(e) => setDeadlineDays(parseInt(e.target.value) || 3)}
                      className="w-20 px-3 py-2 bg-background border-2 border-border rounded-lg text-foreground focus:outline-none focus:border-primary"
                    />
                    <span className="text-sm text-foreground/60">days until deadline</span>
                  </div>
                </div>

                {/* Follow-up Configuration */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Reminder Times
                  </label>
                  <div className="space-y-2">
                    {/* Before Deadline */}
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
                            setAddingType('before')
                            setShowFollowUpPicker(true)
                          }}
                          className="h-6"
                        >
                          <Plus className="h-3 w-3 mr-1" /> Add
                        </Button>
                      )}
                    </div>

                    {/* After Sending */}
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
                            setAddingType('after')
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
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSchedule} disabled={!date || isTimeInPast}>
            {isTimeInPast ? 'Select future time' : 'Schedule'}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Follow-up DateTime Picker */}
      <DateTimePickerModal
        open={showFollowUpPicker}
        onOpenChange={setShowFollowUpPicker}
        onDateTimeSelect={handleFollowUpSelect}
        label={addingType === 'before' ? "Select Reminder Time (Before Deadline)" : "Select Follow-up Time (After Sending)"}
      />
    </Dialog>
  )
}
