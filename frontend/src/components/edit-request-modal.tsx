'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ApprovalRequest } from '@/lib/api'

interface EditRequestModalProps {
  request: ApprovalRequest | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: {
    approver_email?: string
    title?: string
    message?: string
  }) => void
  isLoading?: boolean
}

export function EditRequestModal({
  request,
  open,
  onOpenChange,
  onSave,
  isLoading = false,
}: EditRequestModalProps) {
  const [approverEmail, setApproverEmail] = useState('')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (request) {
      setApproverEmail(request.approver_email || '')
      setTitle(request.title || '')
      setMessage(request.message || '')
    }
  }, [request, open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!request) return

    onSave({
      approver_email: approverEmail || undefined,
      title: title || undefined,
      message: message || undefined,
    })
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-card rounded-xl border border-border max-w-md w-full shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-heading font-semibold text-foreground">
            Edit Request
          </h2>
          <button
            onClick={() => onOpenChange(false)}
            className="text-foreground/60 hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Approver Email */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Approver Email
            </label>
            <input
              type="email"
              value={approverEmail}
              onChange={(e) => setApproverEmail(e.target.value)}
              placeholder="approver@example.com"
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Request title"
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Additional details..."
              rows={4}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="flex-1 px-4 py-2 border border-border rounded-lg text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !title}
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 font-medium"
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
