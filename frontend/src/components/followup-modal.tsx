'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Clock, Plus, Check, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
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

interface FollowUpModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (config: FollowUpConfig) => void
  initialConfig?: FollowUpConfig
}

export function FollowUpModal({ open, onOpenChange, onSave, initialConfig }: FollowUpModalProps) {
  const [config, setConfig] = useState<FollowUpConfig>(initialConfig || {})
  const [addingType, setAddingType] = useState<'before' | 'after' | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const handleAdd = (type: 'before' | 'after') => {
    setAddingType(type)
    setPickerOpen(true)
  }

  const handleDateTimeSelect = (datetime: string) => {
    if (addingType === 'before') {
      setConfig({ ...config, beforeDeadline: datetime })
    } else if (addingType === 'after') {
      setConfig({ ...config, afterSending: datetime })
    }
    setAddingType(null)
    setPickerOpen(false)
  }

  const handleRemove = (type: 'before' | 'after') => {
    if (type === 'before') {
      setConfig({ ...config, beforeDeadline: undefined })
    } else {
      setConfig({ ...config, afterSending: undefined })
    }
  }

  const handleSave = () => {
    onSave(config)
    onOpenChange(false)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Configure Follow-up Reminders</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Before Deadline */}
            <div className="p-4 bg-secondary/50 rounded-xl border border-border">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-600" />
                  <span className="font-semibold text-foreground">Before Deadline</span>
                </div>
                {config.beforeDeadline ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove('before')}
                    className="h-8 w-8 p-0"
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAdd('before')}
                    className="h-8"
                  >
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                )}
              </div>
              {config.beforeDeadline && (
                <p className="text-sm text-foreground/80 ml-7">
                  {format(new Date(config.beforeDeadline), 'EEEE, MMMM d, yyyy p')}
                </p>
              )}
              {!config.beforeDeadline && (
                <p className="text-sm text-muted-foreground ml-7">
                  Send a reminder before the deadline
                </p>
              )}
            </div>

            {/* After Sending */}
            <div className="p-4 bg-secondary/50 rounded-xl border border-border">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-600" />
                  <span className="font-semibold text-foreground">After Sending</span>
                </div>
                {config.afterSending ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove('after')}
                    className="h-8 w-8 p-0"
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAdd('after')}
                    className="h-8"
                  >
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                )}
              </div>
              {config.afterSending && (
                <p className="text-sm text-foreground/80 ml-7">
                  {format(new Date(config.afterSending), 'EEEE, MMMM d, yyyy p')}
                </p>
              )}
              {!config.afterSending && (
                <p className="text-sm text-muted-foreground ml-7">
                  Send a follow-up after sending if no response
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              <Check className="h-4 w-4 mr-2" />
              Save Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Date Time Picker */}
      <DateTimePickerModal
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onDateTimeSelect={handleDateTimeSelect}
        label={addingType === 'before' ? "Select Reminder Time (Before Deadline)" : "Select Follow-up Time (After Sending)"}
      />
    </>
  )
}
