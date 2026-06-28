import {
  Inbox,
  PenLine,
  Clock,
  Send,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react'
import type { ApprovalRequest } from '@/lib/api'
import { cn } from '@/lib/utils'

export type RequestStatus = ApprovalRequest['status']

type StatusMeta = {
  label: string
  Icon: LucideIcon
  /** solid dot color for list rows + nav */
  dot: string
  /** pill badge surface/text/border */
  badge: string
}

/**
 * Single source of truth for per-status presentation.
 * Brand/UI accent is slate-blue; these semantic status colors stay fixed
 * (amber = awaiting, emerald = approved, red = rejected) so state reads clearly.
 */
export const STATUS_META: Record<RequestStatus, StatusMeta> = {
  draft: {
    label: 'Draft',
    Icon: PenLine,
    dot: 'bg-slate-400',
    badge: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  },
  scheduled: {
    label: 'Scheduled',
    Icon: Clock,
    dot: 'bg-blue-500',
    badge: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900',
  },
  pending: {
    label: 'Sent',
    Icon: Send,
    dot: 'bg-amber-500',
    badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
  },
  approved: {
    label: 'Approved',
    Icon: CheckCircle2,
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
  },
  rejected: {
    label: 'Rejected',
    Icon: XCircle,
    dot: 'bg-red-500',
    badge: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900',
  },
  ignored: {
    label: 'Ignored',
    Icon: AlertTriangle,
    dot: 'bg-slate-400',
    badge: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900/40 dark:text-slate-400 dark:border-slate-800',
  },
}

export type FolderValue = 'all' | RequestStatus

/** Sidebar nav folders, in display order. */
export const NAV_FOLDERS: { value: FolderValue; label: string; Icon: LucideIcon }[] = [
  { value: 'all', label: 'All requests', Icon: Inbox },
  { value: 'draft', label: 'Drafts', Icon: PenLine },
  { value: 'scheduled', label: 'Scheduled', Icon: Clock },
  { value: 'pending', label: 'Sent', Icon: Send },
  { value: 'approved', label: 'Approved', Icon: CheckCircle2 },
  { value: 'rejected', label: 'Rejected', Icon: XCircle },
  { value: 'ignored', label: 'Ignored', Icon: AlertTriangle },
]

export function StatusDot({ status, className }: { status: RequestStatus; className?: string }) {
  return (
    <span
      className={cn('inline-block h-2 w-2 shrink-0 rounded-full', STATUS_META[status].dot, className)}
      aria-hidden
    />
  )
}

export function StatusBadge({
  status,
  withIcon = true,
  className,
}: {
  status: RequestStatus
  withIcon?: boolean
  className?: string
}) {
  const meta = STATUS_META[status]
  const Icon = meta.Icon
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        meta.badge,
        className
      )}
    >
      {withIcon && <Icon className="h-3.5 w-3.5" />}
      {meta.label}
    </span>
  )
}
