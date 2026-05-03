'use client'

import { format, formatDistanceToNow } from 'date-fns'
import { Clock, CheckCircle2, XCircle, Edit, Trash2, Calendar, Send, Paperclip, Mail, Eye, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { ApprovalRequest } from '@/lib/api'

interface RequestCardProps {
  request: ApprovalRequest
  onEdit: () => void
  onDelete: () => void
  onSchedule: () => void
  onSendNow: () => void
}

function StatusBadge({ status }: { status: ApprovalRequest['status'] }) {
  const variants = {
    draft: {
      bg: 'bg-gray-100 dark:bg-gray-800',
      text: 'text-gray-700 dark:text-gray-300',
      border: 'border-gray-200 dark:border-gray-700',
      icon: null,
    },
    scheduled: {
      bg: 'bg-blue-50 dark:bg-blue-950/30',
      text: 'text-blue-700 dark:text-blue-300',
      border: 'border-blue-200 dark:border-blue-800',
      icon: Clock,
    },
    pending: {
      bg: 'bg-amber-50 dark:bg-amber-950/30',
      text: 'text-amber-700 dark:text-amber-300',
      border: 'border-amber-200 dark:border-amber-800',
      icon: Clock,
    },
    approved: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/30',
      text: 'text-emerald-700 dark:text-emerald-300',
      border: 'border-emerald-200 dark:border-emerald-800',
      icon: CheckCircle2,
    },
    rejected: {
      bg: 'bg-red-50 dark:bg-red-950/30',
      text: 'text-red-700 dark:text-red-300',
      border: 'border-red-200 dark:border-red-800',
      icon: XCircle,
    },
    ignored: {
      bg: 'bg-gray-50 dark:bg-gray-900/30',
      text: 'text-gray-600 dark:text-gray-400',
      border: 'border-gray-200 dark:border-gray-800',
      icon: AlertTriangle,
    },
  }

  const variant = variants[status]
  const IconComponent = variant.icon

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${variant.bg} ${variant.text} ${variant.border}`}>
      {IconComponent && <IconComponent className="h-3.5 w-3.5" />}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

export function RequestCard({ request, onEdit, onDelete, onSchedule, onSendNow }: RequestCardProps) {
  const isDraft = request.status === 'draft'
  const isScheduled = request.status === 'scheduled'
  const isModifiable = isDraft || isScheduled

  return (
    <>
      <div className="group bg-white dark:bg-card rounded-xl border border-border hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 overflow-hidden">
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <h3 className="text-lg font-heading font-semibold text-foreground flex-1 break-words pr-3 group-hover:text-primary transition-colors">
              {request.title || 'Untitled Draft'}
            </h3>
            <StatusBadge status={request.status} />
          </div>

          <div className="space-y-4 mb-6">
            {request.approver_email && (
              <div className="text-sm">
                <p className="text-foreground/60 font-semibold uppercase text-xs tracking-wide mb-2">
                  Approver
                </p>
                <p className="text-foreground font-medium break-all">{request.approver_email}</p>
              </div>
            )}
            
            {request.message && (
              <div className="text-sm">
                <p className="text-foreground/60 font-semibold uppercase text-xs tracking-wide mb-2">
                  Message
                </p>
                <p className="text-foreground/80 line-clamp-3 leading-relaxed">{request.message}</p>
              </div>
            )}
            
            {request.file_url && (
              <div className="text-sm">
                <p className="text-foreground/60 font-semibold uppercase text-xs tracking-wide mb-2">
                  Attachment
                </p>
                <a
                  href={request.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-accent hover:text-accent/80 font-semibold break-all hover:underline"
                >
                  <Paperclip className="h-4 w-4" /> View file
                </a>
              </div>
            )}

            {isScheduled && request.scheduled_send_at && (
              <div className="text-sm">
                <p className="text-foreground/60 font-semibold uppercase text-xs tracking-wide mb-2">
                  Scheduled For
                </p>
                <p className="text-foreground font-medium">
                  {format(new Date(request.scheduled_send_at), 'PPP p')}
                </p>
              </div>
            )}

            {request.deadline && request.status === 'pending' && (
              <div className="text-sm">
                <p className="text-foreground/60 font-semibold uppercase text-xs tracking-wide mb-2">
                  Response Deadline
                </p>
                <p className="text-amber-700 dark:text-amber-400 font-medium">
                  {format(new Date(request.deadline), 'EEEE, MMMM d, yyyy p')}
                </p>
              </div>
            )}

            {request.feedback && (
              <div className="text-sm">
                <p className="text-foreground/60 font-semibold uppercase text-xs tracking-wide mb-2">
                  Feedback
                </p>
                <p className="text-foreground/80 line-clamp-3 italic leading-relaxed">"{request.feedback}"</p>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-border/50">
            <p className="text-xs text-foreground/50 font-medium">
              Created {format(new Date(request.created_at), 'MMM d, yyyy')}
            </p>
          </div>

          {/* Action Buttons */}
          {isModifiable && (
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border/50">
              <Button variant="outline" size="sm" onClick={onEdit}>
                <Edit className="h-4 w-4 mr-1" /> Edit
              </Button>
              <Button variant="outline" size="sm" onClick={onSchedule}>
                <Calendar className="h-4 w-4 mr-1" /> {isScheduled ? 'Reschedule' : 'Schedule'}
              </Button>
              <Button variant="default" size="sm" onClick={onSendNow}>
                <Send className="h-4 w-4 mr-1" /> Send Now
              </Button>
              <Button variant="destructive" size="sm" onClick={onDelete}>
                <Trash2 className="h-4 w-4 mr-1" /> Delete Draft
              </Button>
            </div>
          )}
          
          {!isModifiable && (
            <div className="mt-4 pt-4 border-t border-border/50 space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {request.status === 'pending' && (
                  <>
                    <Mail className="h-4 w-4" />
                    <span>Sent - Awaiting approval</span>
                  </>
                )}
                {request.status === 'approved' && (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Approved</span>
                  </>
                )}
                {request.status === 'rejected' && (
                  <>
                    <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                    <span>Rejected</span>
                  </>
                )}
                {request.status === 'ignored' && (
                  <>
                    <AlertTriangle className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                    <span>Ignored (deadline passed)</span>
                  </>
                )}
              </div>
              {(request.status === 'pending' || request.status === 'approved' || request.status === 'rejected' || request.status === 'ignored') && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Eye className="h-3.5 w-3.5" />
                  {request.view_count > 0
                    ? `Viewed ${request.view_count}× · ${formatDistanceToNow(new Date(request.viewed_at!), { addSuffix: true })}`
                    : 'Not viewed yet'
                  }
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
