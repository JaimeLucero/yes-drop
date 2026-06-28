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
  FileCheck2,
  Mail,
  Clock,
  MessageSquare,
} from 'lucide-react'
import type { ApprovalRequest } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { StatusBadge } from './status-meta'
import { AnalyticsBand } from './analytics-band'
import { DailyLimitIndicator } from '@/components/daily-limit-indicator'
import { cn } from '@/lib/utils'

function initial(email: string | null | undefined): string {
  const c = email?.trim()?.[0]
  return c ? c.toUpperCase() : '?'
}

/** A labelled row inside a grouped info card. */
function InfoRow({
  icon: Icon,
  label,
  children,
  iconClass,
}: {
  icon: typeof Mail
  label: string
  children: React.ReactNode
  iconClass?: string
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0 text-muted-foreground', iconClass)} />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className="mt-0.5 text-sm text-foreground">{children}</div>
      </div>
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
      <div className="flex items-start gap-3 border-b border-border px-6 py-4">
        <button
          onClick={onClose}
          className="mt-1 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted lg:hidden"
          aria-label="Back to list"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span
          className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-sm font-semibold text-primary-foreground sm:flex"
          aria-hidden="true"
        >
          {initial(request.approver_email)}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-lg font-semibold leading-snug text-foreground">
            {request.title || 'Untitled draft'}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
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
      <div className="flex-1 space-y-4 overflow-y-auto bg-muted/20 px-6 py-5">
        {/* Key details */}
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {request.approver_email && (
            <InfoRow icon={Mail} label="Approver">
              <span className="break-all font-medium">{request.approver_email}</span>
            </InfoRow>
          )}

          {isScheduled && request.scheduled_send_at && (
            <InfoRow icon={Calendar} label="Scheduled for">
              <span className="data-num">{format(new Date(request.scheduled_send_at), 'PPP p')}</span>
            </InfoRow>
          )}

          {isSent && request.sent_at && (
            <InfoRow icon={Send} label="Sent">
              <span className="data-num">{format(new Date(request.sent_at), 'PPP p')}</span>
            </InfoRow>
          )}

          {request.deadline && request.status === 'pending' && (
            <InfoRow icon={Clock} label="Response deadline" iconClass="text-amber-500">
              <span className="data-num font-medium text-amber-700 dark:text-amber-400">
                {format(new Date(request.deadline), 'EEE, MMM d, yyyy p')}
              </span>
            </InfoRow>
          )}

          {request.reminders && request.reminders.length > 0 && (
            <InfoRow icon={Bell} label={`Reminders · ${request.reminders.length}`}>
              <ul className="space-y-1">
                {request.reminders.map((r, i) => (
                  <li key={`${r.send_at}-${i}`} className="flex items-center gap-2">
                    <span className="data-num text-foreground/90">{format(new Date(r.send_at), 'EEE, MMM d • p')}</span>
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {r.kind === 'before_deadline' ? 'before deadline' : 'after sending'}
                    </span>
                  </li>
                ))}
              </ul>
            </InfoRow>
          )}

          {isSent && (
            <InfoRow icon={Eye} label="Activity">
              <span className="text-muted-foreground">
                {request.view_count > 0 && request.viewed_at
                  ? `Viewed ${request.view_count}× · last ${formatDistanceToNow(new Date(request.viewed_at), { addSuffix: true })}`
                  : 'Not viewed yet'}
              </span>
            </InfoRow>
          )}
        </div>

        {/* Message */}
        {request.message && (
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <MessageSquare className="h-3.5 w-3.5" /> Message
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{request.message}</p>
          </div>
        )}

        {/* Documents */}
        {(request.file_url || request.response_file_url) && (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <p className="border-b border-border px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Documents
            </p>
            {request.file_url && (
              <a
                href={request.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
              >
                <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 text-sm font-medium text-foreground">Original attachment</span>
                <span className="text-xs font-medium text-primary">View</span>
              </a>
            )}
            {request.response_file_url && (
              <a
                href={request.response_file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 border-t border-border bg-emerald-50/50 px-4 py-3 transition-colors hover:bg-emerald-50 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/30"
              >
                <FileCheck2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span className="flex-1">
                  <span className="block text-sm font-medium text-foreground">Signed copy</span>
                  {request.signer_name && (
                    <span className="block text-xs text-muted-foreground">by {request.signer_name}</span>
                  )}
                </span>
                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Download</span>
              </a>
            )}
          </div>
        )}

        {/* Feedback */}
        {request.feedback && (
          <div className="rounded-xl border border-l-4 border-border border-l-primary bg-card p-4">
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Feedback</p>
            <p className="whitespace-pre-wrap text-sm italic leading-relaxed text-foreground/90">
              &ldquo;{request.feedback}&rdquo;
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="shrink-0 border-t border-border bg-card px-6 py-4">
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
