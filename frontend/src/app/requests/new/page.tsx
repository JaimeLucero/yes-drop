'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createRequest, uploadFile, createDraft, scheduleRequest, type Reminder } from '@/lib/api'
import { Upload, AlertCircle, File, CheckCircle, Calendar, Clock, X } from 'lucide-react'
import { ScheduleModal } from '@/components/schedule-modal'
import { DateTimePickerModal } from '@/components/date-time-picker-modal'
import { FollowUpModal } from '@/components/followup-modal'
import { format } from 'date-fns'

export default function NewRequestPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [approverEmail, setApproverEmail] = useState('')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [action, setAction] = useState<'send' | 'draft' | 'schedule'>('send')
  const [scheduledTime, setScheduledTime] = useState('')
  const [deadlineDateTime, setDeadlineDateTime] = useState<string>('')
  const [followUpEnabled, setFollowUpEnabled] = useState(true)
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false)
  const [deadlineModalOpen, setDeadlineModalOpen] = useState(false)
  const [followUpModalOpen, setFollowUpModalOpen] = useState(false)

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      // Reminders carry absolute times (no day rounding); empty when disabled.
      const activeReminders = followUpEnabled ? reminders : []
      const deadlineDays = deadlineDateTime ? calculateDaysUntil(deadlineDateTime) : 3

      if (action === 'draft') {
        return createDraft(data)
      } else if (action === 'schedule') {
        return createRequest({
          ...data,
          scheduled_send_at: scheduledTime,
          deadline_days: deadlineDays,
          reminders: activeReminders,
        })
      } else {
        return createRequest({
          ...data,
          deadline_days: deadlineDays,
          reminders: activeReminders,
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      router.push('/dashboard')
    },
  })

  function calculateDaysUntil(datetimeString: string): number {
    const now = new Date()
    const target = new Date(datetimeString)
    const diffMs = target.getTime() - now.getTime()
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
    return Math.max(1, diffDays)
  }

  function toUTCISOString(date: Date): string {
    // Convert local date to UTC ISO string
    return date.toISOString()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return
    await uploadFileHandler(selectedFile)
  }

  const uploadFileHandler = async (selectedFile: File) => {
    setUploading(true)
    try {
      const url = await uploadFile(selectedFile)
      setFileUrl(url)
      setFile(selectedFile)
    } catch (err) {
      console.error('Upload failed:', err)
    } finally {
      setUploading(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => {
    setDragOver(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const droppedFile = e.dataTransfer.files?.[0]
    if (droppedFile) {
      await uploadFileHandler(droppedFile)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (action === 'schedule' && !scheduledTime) {
      return
    }
    mutation.mutate({
      approver_email: approverEmail,
      title,
      message: message || undefined,
      file_url: fileUrl || undefined,
    })
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Form */}
      <main className="max-w-3xl mx-auto px-6 py-8">
        <form onSubmit={handleSubmit} className="space-y-10">
          {/* Approver Email */}
          <div className="group">
            <label htmlFor="approver_email" className="block text-sm font-heading font-semibold text-foreground mb-3 uppercase tracking-wide">
              Approver Email <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="approver_email"
                type="email"
                value={approverEmail}
                onChange={(e) => setApproverEmail(e.target.value)}
                placeholder="approver@example.com"
                required
                className="w-full px-5 py-3 bg-background border-2 border-border rounded-xl text-foreground placeholder:text-foreground/40 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            <p className="text-xs text-foreground/50 mt-2">The email address of the person who needs to approve this request</p>
          </div>

          {/* Title */}
          <div className="group">
            <label htmlFor="title" className="block text-sm font-heading font-semibold text-foreground mb-3 uppercase tracking-wide">
              Request Title <span className="text-red-500">*</span>
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Q3 2024 Budget Approval"
              required
              className="w-full px-5 py-3 bg-background border-2 border-border rounded-xl text-foreground placeholder:text-foreground/40 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            />
            <p className="text-xs text-foreground/50 mt-2">A clear, concise title for this approval request</p>
          </div>

          {/* Message */}
          <div className="group">
            <label htmlFor="message" className="block text-sm font-heading font-semibold text-foreground mb-3 uppercase tracking-wide">
              Message <span className="text-foreground/50 font-normal text-xs">(optional)</span>
            </label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add any context or details that will help the approver make a decision..."
              rows={5}
              className="w-full px-5 py-3 bg-background border-2 border-border rounded-xl text-foreground placeholder:text-foreground/40 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
            />
            <p className="text-xs text-foreground/50 mt-2">Provide context to help your approver make a decision</p>
          </div>

          {/* File Upload */}
          <div className="group">
            <label className="block text-sm font-heading font-semibold text-foreground mb-3 uppercase tracking-wide">
              Attachments <span className="text-foreground/50 font-normal text-xs">(optional)</span>
            </label>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all ${
                dragOver
                  ? 'border-primary bg-primary/10 scale-105'
                  : 'border-border bg-background hover:border-primary/50 hover:bg-primary/5'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                disabled={uploading}
                className="hidden"
              />

              {!file && (
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <div className="p-4 bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl">
                      <Upload className="h-8 w-8 text-primary" />
                    </div>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="text-accent font-semibold hover:text-accent/80 transition-colors"
                    >
                      Click to upload
                    </button>
                    <span className="text-foreground/60 mx-2">or drag and drop</span>
                  </div>
                  <p className="text-xs text-foreground/50 font-medium">PNG, JPG, PDF, Excel, Word, or any file up to 10MB</p>
                </div>
              )}

              {uploading && (
                <div className="space-y-3">
                  <div className="flex justify-center">
                    <div className="inline-block animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
                  </div>
                  <p className="text-sm text-foreground/60 font-medium">Uploading...</p>
                </div>
              )}

              {file && fileUrl && (
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <div className="p-4 bg-gradient-to-br from-emerald-100/50 to-emerald-50/50 dark:from-emerald-950/40 dark:to-emerald-950/20 rounded-xl">
                      <CheckCircle className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{file.name}</p>
                    <p className="text-xs text-foreground/50 mt-2">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null)
                      setFileUrl(null)
                      if (fileInputRef.current) fileInputRef.current.value = ''
                    }}
                    className="text-sm text-primary hover:text-primary/80 transition-colors font-semibold"
                  >
                    Replace file
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Action Selection */}
          <div className="group">
            <label className="block text-sm font-heading font-semibold text-foreground mb-3 uppercase tracking-wide">
              What do you want to do?
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className={`relative flex items-center p-4 border-2 rounded-xl cursor-pointer transition-all ${
                action === 'send'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}>
                <input
                  type="radio"
                  name="action"
                  value="send"
                  checked={action === 'send'}
                  onChange={(e) => setAction(e.target.value as 'send' | 'draft' | 'schedule')}
                  className="mr-3"
                />
                <div>
                  <p className="font-semibold text-foreground">Send Now</p>
                  <p className="text-xs text-foreground/60">Send immediately to approver</p>
                </div>
              </label>

              <label className={`relative flex items-center p-4 border-2 rounded-xl cursor-pointer transition-all ${
                action === 'draft'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}>
                <input
                  type="radio"
                  name="action"
                  value="draft"
                  checked={action === 'draft'}
                  onChange={(e) => setAction(e.target.value as 'send' | 'draft' | 'schedule')}
                  className="mr-3"
                />
                <div>
                  <p className="font-semibold text-foreground">Save Draft</p>
                  <p className="text-xs text-foreground/60">Save for later</p>
                </div>
              </label>

              <label className={`relative flex items-center p-4 border-2 rounded-xl cursor-pointer transition-all ${
                action === 'schedule'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}>
                <input
                  type="radio"
                  name="action"
                  value="schedule"
                  checked={action === 'schedule'}
                  onChange={(e) => setAction(e.target.value as 'send' | 'draft' | 'schedule')}
                  className="mr-3"
                />
                <div>
                  <p className="font-semibold text-foreground">Schedule</p>
                  <p className="text-xs text-foreground/60">Send at a specific time</p>
                </div>
              </label>
            </div>
          </div>

          {/* Schedule Time Picker */}
          {action === 'schedule' && (
            <div className="group">
              <label className="block text-sm font-heading font-semibold text-foreground mb-3 uppercase tracking-wide">
                When should this be sent? <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setScheduleModalOpen(true)}
                className="w-full flex items-center gap-2 px-5 py-3 bg-background border-2 border-border rounded-xl text-foreground hover:border-primary/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-left"
              >
                <Calendar className="h-5 w-5 text-foreground/60" />
                <span className={scheduledTime ? 'text-foreground' : 'text-foreground/40'}>
                  {scheduledTime
                    ? format(new Date(scheduledTime), 'PPP p')
                    : 'Select date and time'}
                </span>
              </button>
              <p className="text-xs text-foreground/50 mt-2">The request will be sent at this date and time</p>
            </div>
          )}

          {/* Follow-up Strategy */}
          {(action === 'schedule' || action === 'send') && (
            <div className="group">
              <label className="block text-sm font-heading font-semibold text-foreground mb-3 uppercase tracking-wide">
                Deadline & Follow-up Reminders
              </label>
              
              <div className="space-y-4">
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
                    {/* Deadline DateTime */}
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Response Deadline
                      </label>
                      <button
                        type="button"
                        onClick={() => setDeadlineModalOpen(true)}
                        className="w-full flex items-center gap-2 px-4 py-3 bg-background border-2 border-border rounded-xl text-foreground hover:border-primary/50 focus:outline-none focus:border-primary transition-all text-left"
                      >
                        <Calendar className="h-5 w-5 text-foreground/60" />
                        <span className={deadlineDateTime ? 'text-foreground font-medium' : 'text-foreground/40'}>
                          {deadlineDateTime
                            ? format(new Date(deadlineDateTime), 'EEEE, MMMM d, yyyy p')
                            : 'Select deadline date and time'}
                        </span>
                      </button>
                      <p className="text-xs text-foreground/50 mt-1">
                        Requests will be marked as "ignored" if not responded to by this time
                      </p>
                    </div>

                    {/* Follow-up Configuration */}
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Reminder Times
                      </label>
                      <button
                        type="button"
                        onClick={() => setFollowUpModalOpen(true)}
                        className="w-full flex items-center gap-2 px-4 py-3 bg-background border-2 border-border rounded-xl text-foreground hover:border-primary/50 focus:outline-none focus:border-primary transition-all text-left"
                      >
                        <Clock className="h-5 w-5 text-foreground/60" />
                        <span className={reminders.length ? 'text-foreground font-medium' : 'text-foreground/40'}>
                          {reminders.length
                            ? `${reminders.length} reminder${reminders.length > 1 ? 's' : ''} configured`
                            : 'Configure reminder times'}
                        </span>
                      </button>
                      <p className="text-xs text-foreground/50 mt-1">
                        Set specific times for reminder emails
                      </p>
                    </div>
                  </div>
                )}

                {!followUpEnabled && (
                  <p className="text-xs text-foreground/50 italic">
                    No reminder emails will be sent. The request will still expire at the deadline if not responded to.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Error Message */}
          {mutation.isError && (
            <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600 dark:text-red-400">{String(mutation.error)}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-8 border-t-2 border-border">
            <button
              type="submit"
              disabled={mutation.isPending || !approverEmail || !title || (action === 'schedule' && !scheduledTime)}
              className="group inline-flex items-center justify-center px-8 py-3 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-semibold rounded-xl hover:shadow-lg hover:shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {mutation.isPending ? (
                <>
                  <div className="inline-block animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                  {action === 'send' ? 'Sending...' : action === 'draft' ? 'Saving...' : 'Scheduling...'}
                </>
              ) : (
                <>
                  {action === 'send' && 'Send Request'}
                  {action === 'draft' && 'Save Draft'}
                  {action === 'schedule' && 'Schedule Request'}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="inline-flex items-center justify-center px-8 py-3 bg-secondary text-secondary-foreground font-semibold rounded-xl border border-border hover:bg-secondary/80 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>

        {/* Schedule Modal */}
        <ScheduleModal
          open={scheduleModalOpen}
          onOpenChange={setScheduleModalOpen}
          onSchedule={setScheduledTime}
          initialDate={scheduledTime || undefined}
        />

        {/* Deadline Modal */}
        <DateTimePickerModal
          open={deadlineModalOpen}
          onOpenChange={setDeadlineModalOpen}
          onDateTimeSelect={setDeadlineDateTime}
          initialDateTime={deadlineDateTime}
          label="Set Response Deadline"
          minDate={new Date(new Date().getTime() + 60 * 60 * 1000)} // At least 1 hour from now
        />

        {/* Follow-up Modal */}
        <FollowUpModal
          open={followUpModalOpen}
          onOpenChange={setFollowUpModalOpen}
          onSave={setReminders}
          initialReminders={reminders}
          deadlineDateTime={deadlineDateTime}
        />
      </main>
    </div>
  )
}