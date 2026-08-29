'use client'

import { Eye, X } from 'lucide-react'
import type { ApprovalRequest } from '@/lib/api'
import { RequestContextCard } from '@/components/request-context-card'
import { BrandLogo } from '@/components/brand-logo'

/**
 * Sender-side preview of the approver page.
 *
 * Rendered entirely from the request the dashboard already holds. It carries
 * no token and posts nothing, so a requester cannot decide their own request
 * from here. The live approver page at /action stays reachable only by the
 * token in the approval email, which is the approver's credential alone.
 */
export function ApprovalPreview({
  request,
  onClose,
}: {
  request: ApprovalRequest
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Preview of the approval page"
      onClick={onClose}
    >
      <div
        className="max-h-full w-full max-w-lg overflow-y-auto rounded-2xl bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <span className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Eye className="h-4 w-4" /> Preview, this is what your approver sees
          </span>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted"
            aria-label="Close preview"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="bg-muted/30 p-6">
          <div className="mb-6 flex justify-center">
            <BrandLogo />
          </div>

          <div className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm">
            <RequestContextCard
              req={{
                title: request.title,
                message: request.message,
                file_url: request.file_url,
                requester:
                  request.sender_name || request.sender_email || request.requester_email,
                deadline: request.deadline,
                sent_at: request.sent_at,
              }}
            />

            <div>
              <h1 className="font-heading text-xl font-semibold text-foreground">
                Approve this request?
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Add a note if you want, then confirm your approval.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Feedback (optional)</label>
              <div className="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
                Any comments or notes?
              </div>
            </div>

            {/* Inert on purpose: only the approver, holding the emailed token,
                can record a decision. */}
            <div className="flex gap-3 pt-1" aria-hidden="true">
              <div className="flex-1 rounded-lg border border-border px-4 py-2 text-center text-sm font-medium text-muted-foreground">
                Cancel
              </div>
              <div className="flex-1 rounded-lg bg-primary/40 px-4 py-2 text-center text-sm font-medium text-primary-foreground">
                Approve
              </div>
            </div>
          </div>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Buttons are disabled in preview. Only your approver can decide.
          </p>
        </div>
      </div>
    </div>
  )
}
