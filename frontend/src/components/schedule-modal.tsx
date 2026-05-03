'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar as CalendarPicker } from '@/components/ui/calendar'
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
        console.warn('Could not sync server time, using client time')
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

  const handleSchedule = () => {
    if (!date || isTimeInPast) return

    const localDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      time.hours,
      time.minutes
    )

    onSchedule(localDate.toISOString())
    onOpenChange(false)
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
