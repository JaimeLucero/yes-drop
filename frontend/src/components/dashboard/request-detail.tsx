'use client'

import { format, formatDistanceToNow } from 'date-fns'
import {
  X,
  ChevronLeft,
  Edit,
  Calendar,
  Send,
  Trash2,
  Paperclip,
  Eye,
  ExternalLink,
  Bell,
} from 'lucide-react'
import type { ApprovalRequest } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { StatusBadge } from './status-meta'
import { AnalyticsBand } from './analytics-band'
import { DailyLimitIndicator } from '@/components/daily-limit-indicator'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  )
}

export function RequestDetailEmpty() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-heading font-semibold text-foreground">Overview</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Select a request to see its details, or start a new one.
          </p>
        </div>
        <DailyLimitIndicator />
        <AnalyticsBand />
      </div>
    </div>
  )
}

interface RequestDetailProps {
  request: ApprovalRequest
  onClose: () => void
  onEdit: () => void
  onSchedule: () => void
  onSendNow: () => void
  onDelete: () => void
}

export function RequestDetail({ request, onClose, onEdit, onSchedule, onSendNow, onDelete }: RequestDetailProps) {
  const isScheduled = request.status === 'scheduled'
  const isModifiable = request.status === 'draft' || isScheduled
  const isSent = ['pending', 'approved', 'rejected', 'ignored'].includes(request.status)
  const actionUrl = `/action/${request.token}`

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-start gap-2 border-b border-border px-6 py-4">
        <button
          onClick={onClose}
          className="mt-0.5 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted lg:hidden"
          aria-label="Back to list"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-heading font-semibold text-foreground">
            {request.title || 'Untitled draft'}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={request.status} />
            <span className="data-num text-xs text-muted-foreground">
              Created {format(new Date(request.created_at), 'MMM d, yyyy')}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="hidden rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted lg:block"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
        {request.approver_email && (
          <Field label="Approver">
            <span className="break-all font-medium">{request.approver_email}</span>
          </Field>
        )}

        {request.message && (
          <Field label="Message">
            <p className="whitespace-pre-wrap leading-relaxed text-foreground/80">{request.message}</p>
          </Field>
        )}

        {request.file_url && (
          <Field label="Attachment">
            <a
              href={request.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 font-medium text-primary hover:underline"
            >
              <Paperclip className="h-4 w-4" /> View file
            </a>
          </Field>
        )}

        {isScheduled && request.scheduled_send_at && (
          <Field label="Scheduled for">
            <span className="data-num">{format(new Date(request.scheduled_send_at), 'PPP p')}</span>
          </Field>
        )}

        {request.deadline && request.status === 'pending' && (
          <Field label="Response deadline">
            <span className="data-num text-amber-700 dark:text-amber-400">
              {format(new Date(request.deadline), 'EEE, MMM d, yyyy p')}
            </span>
          </Field>
        )}

        {request.reminders && request.reminders.length > 0 && (
          <Field label={`Reminders (${request.reminders.length})`}>
            <ul className="space-y-1">
              {request.reminders.map((r, i) => (
                <li key={`${r.send_at}-${i}`} className="flex items-center gap-2 text-foreground/80">
                  <Bell className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="data-num">{format(new Date(r.send_at), 'EEE, MMM d • p')}</span>
                  <span className="text-xs text-muted-foreground">
                    {r.kind === 'before_deadline' ? 'before deadline' : 'after sending'}
                  </span>
                </li>
              ))}
            </ul>
          </Field>
        )}

        {request.feedback && (
          <Field label="Feedback">
            <p className="whitespace-pre-wrap italic leading-relaxed text-foreground/80">&ldquo;{request.feedback}&rdquo;</p>
          </Field>
        )}

        {isSent && (
          <Field label="Activity">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Eye className="h-4 w-4" />
              {request.view_count > 0 && request.viewed_at
                ? `Viewed ${request.view_count}× · last ${formatDistanceToNow(new Date(request.viewed_at), { addSuffix: true })}`
                : 'Not viewed yet'}
            </div>
          </Field>
        )}
      </div>

      {/* Actions */}
      <div className="shrink-0 border-t border-border px-6 py-4">
        {isModifiable ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={onSendNow}>
              <Send className="mr-1 h-4 w-4" /> Send now
            </Button>
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Edit className="mr-1 h-4 w-4" /> Edit
            </Button>
            <Button variant="outline" size="sm" onClick={onSchedule}>
              <Calendar className="mr-1 h-4 w-4" /> {isScheduled ? 'Reschedule' : 'Schedule'}
            </Button>
            <Button variant="destructive" size="sm" onClick={onDelete}>
              <Trash2 className="mr-1 h-4 w-4" /> Delete
            </Button>
          </div>
        ) : (
          <a
            href={actionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-muted"
          >
            <ExternalLink className="h-4 w-4" /> Preview approval page
          </a>
        )}
      </div>
    </div>
  )
}
