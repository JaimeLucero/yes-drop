'use client'

import { memo } from 'react'
import { formatDistanceToNow } from 'date-fns'
import type { ApprovalRequest } from '@/lib/api'
import { StatusDot, STATUS_META } from './status-meta'
import { cn } from '@/lib/utils'

function initial(email: string | null): string {
  const c = email?.trim()?.[0]
  return c ? c.toUpperCase() : '?'
}

interface RequestListItemProps {
  request: ApprovalRequest
  selected: boolean
  onSelect: (id: string) => void
}

// Memoized: background refetches keep unchanged request refs (react-query
// structural sharing), so rows don't re-render and clicks are never dropped.
function RequestListItemImpl({ request, selected, onSelect }: RequestListItemProps) {
  const ts = request.sent_at || request.scheduled_send_at || request.created_at
  const preview = request.message?.trim() || STATUS_META[request.status].label

  return (
    <button
      onClick={() => onSelect(request.id)}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'flex w-full items-start gap-3 border-l-2 px-4 py-3 text-left transition-colors',
        selected ? 'border-primary bg-accent' : 'border-transparent hover:bg-muted/60'
      )}
    >
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
        {initial(request.approver_email)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-foreground">{request.title || 'Untitled draft'}</span>
          <span className="data-num shrink-0 text-[11px] text-muted-foreground">
            {formatDistanceToNow(new Date(ts))}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {request.approver_email || 'No approver yet'}
        </span>
        <span className="mt-1 flex items-center gap-1.5">
          <StatusDot status={request.status} />
          <span className="truncate text-xs text-muted-foreground/80">{preview}</span>
        </span>
      </span>
    </button>
  )
}

export const RequestListItem = memo(RequestListItemImpl)
