'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Calendar as CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

interface ScheduleModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSchedule: (datetime: string) => void
  initialDate?: string | null
}

export function ScheduleModal({ open, onOpenChange, onSchedule, initialDate }: ScheduleModalProps) {
  const [date, setDate] = useState<Date | undefined>(
    initialDate ? new Date(initialDate) : new Date()
  )
  const [time, setTime] = useState({ hours: 9, minutes: 0 })

  // Get current local time to prevent scheduling in the past
  const now = new Date()
  const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const currentLocalHours = now.getHours()
  const currentLocalMinutes = now.getMinutes()

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

    // toISOString() correctly converts the local time to UTC
    onSchedule(localDate.toISOString())
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule Request</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Date</label>
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
              initialFocus
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Time</label>
            <div className="flex gap-2">
              <select
                value={time.hours}
                onChange={(e) => {
                  const hours = parseInt(e.target.value)
                  setTime({ ...time, hours })
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {Array.from({ length: 24 }, (_, i) => {
                  const isDisabled = date && date.getTime() === todayLocal.getTime() && i <= currentLocalHours
                  return (
                    <option key={i} value={i} disabled={isDisabled}>
                      {i.toString().padStart(2, '0')}
                    </option>
                  )
                })}
              </select>
              <span className="flex items-center text-2xl">:</span>
              <select
                value={time.minutes}
                onChange={(e) => setTime({ ...time, minutes: parseInt(e.target.value) })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {[0, 15, 30, 45].map((m) => {
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
            <div className="space-y-2 text-xs">
              <p className="text-muted-foreground">
                Current time: {currentLocalHours.toString().padStart(2, '0')}:{currentLocalMinutes.toString().padStart(2, '0')}
              </p>
              {date && (
                <p className={isTimeInPast ? 'text-red-500 font-medium' : 'text-muted-foreground'}>
                  Selected: {format(date, 'EEEE, MMMM d, yyyy')} at {time.hours.toString().padStart(2, '0')}:{time.minutes.toString().padStart(2, '0')}
                  {isTimeInPast && ' (⚠️ in the past)'}
                </p>
              )}
            </div>
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
    </Dialog>
  )
}
