'use client'

import { CalendarClock, Paperclip } from 'lucide-react'

/**
 * The request context an approver sees before deciding: title, who asked,
 * the message, the deadline, the attachment.
 *
 * Shared deliberately by two callers that must never share a token:
 *  - /action, rendered for the receiver from the token-scoped public endpoint
 *  - the dashboard's sender-side preview, rendered from data the requester
 *    already owns
 *
 * Keeping one component means the preview stays honest about what the
 * approver will see, without handing the requester the approver's credential.
 */
export interface RequestContext {
  title: string | null
  message: string | null
  file_url: string | null
  requester: string | null
  deadline: string | null
  sent_at: string | null
}

/** Rendered in the viewer's own locale and timezone, not the requester's. */
function fmt(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions) {
  if (!iso) return null
  const d = new Date(iso)
  return isNaN(d.getTime()) ? null : d.toLocaleString(undefined, opts)
}

export function RequestContextCard({ req }: { req: RequestContext }) {
  const deadlineLabel = fmt(req.deadline, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
  const sentLabel = fmt(req.sent_at, { month: 'short', day: 'numeric' })

  return (
    <div className="space-y-4 rounded-xl border border-border bg-secondary/30 p-4">
      <div>
        <h2 className="font-heading text-lg font-semibold leading-snug text-foreground">
          {req.title || 'Approval request'}
        </h2>
        {req.requester && (
          <p className="mt-1 text-sm text-muted-foreground">
            Requested by <span className="font-medium text-foreground">{req.requester}</span>
            {sentLabel && <> &middot; sent {sentLabel}</>}
          </p>
        )}
      </div>

      {req.message && (
        <p className="whitespace-pre-wrap border-t border-border pt-3 text-sm leading-relaxed text-foreground">
          {req.message}
        </p>
      )}

      {(deadlineLabel || req.file_url) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3 text-sm">
          {deadlineLabel && (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <CalendarClock className="h-4 w-4 shrink-0" />
              Respond by <span className="font-medium text-foreground">{deadlineLabel}</span>
            </span>
          )}
          {req.file_url && (
            <a
              href={req.file_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
            >
              <Paperclip className="h-4 w-4 shrink-0" />
              View attachment
            </a>
          )}
        </div>
      )}
    </div>
  )
}
