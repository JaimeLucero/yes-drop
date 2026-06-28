'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { CheckCircle, XCircle, Loader2, PenLine, FileCheck2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BrandLogo } from '@/components/brand-logo'
import { getPublicRequest, type PublicRequest } from '@/lib/api'

const DocumentEditor = dynamic(() => import('@/components/document-editor/document-editor'), { ssr: false })

export default function ActionContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')
  const action = searchParams.get('action')
  const invalidLink = !token || !action || !['approve', 'reject'].includes(action)
  const [status, setStatus] = useState<'form' | 'loading' | 'success' | 'error'>(
    invalidLink ? 'error' : 'form'
  )
  const [message, setMessage] = useState(
    invalidLink ? 'This link is invalid or has expired. Ask the requester to resend it.' : ''
  )
  const [feedback, setFeedback] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [req, setReq] = useState<PublicRequest | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [signedUrl, setSignedUrl] = useState<string | null>(null)

  const isApprove = action === 'approve'
  const isPdf = !!req?.file_url && /\.pdf($|\?)/i.test(req.file_url)

  useEffect(() => {
    if (token) getPublicRequest(token).then(setReq).catch(() => {})
  }, [token])

  const handleSubmit = async () => {
    if (!token) return
    setIsSubmitting(true)
    setStatus('loading')

    try {
      const params = new URLSearchParams({
        token,
        action: action || '',
        ...(feedback && { feedback }),
      })
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/action?${params}`,
        { method: 'GET' }
      )

      if (response.ok) {
        setStatus('success')
        setMessage(isApprove ? 'You approved this request. The requester has been notified.' : 'You rejected this request. The requester has been notified.')
      } else {
        setStatus('error')
        setMessage("We couldn't record your decision. Try again in a moment.")
      }
    } catch (error) {
      setStatus('error')
      setMessage('A network error stopped us from saving your decision. Try again.')
      console.error(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4">
      <div className="mb-8">
        <BrandLogo href="/" />
      </div>

      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm">
        {status === 'form' && (
          <div className="space-y-5">
            <div>
              <h1 className="text-xl font-heading font-semibold text-foreground">
                {isApprove ? 'Approve this request?' : 'Reject this request?'}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {isApprove
                  ? 'Add a note if you want, then confirm your approval.'
                  : 'Let the requester know why so they can follow up.'}
              </p>
            </div>

            {isApprove && isPdf && (
              <div className="rounded-lg border border-border bg-secondary/40 p-3">
                <div className="flex items-center gap-2">
                  <PenLine className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">Sign or edit the document</span>
                  <span className="text-xs text-muted-foreground">(optional)</span>
                </div>
                {signedUrl ? (
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
                    <FileCheck2 className="h-4 w-4" /> Signed copy attached
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditorOpen(true)}
                    className="mt-2 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Open editor
                  </button>
                )}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Feedback {isApprove ? '(optional)' : '(required)'}
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder={isApprove ? 'Any comments or notes?' : 'Why are you rejecting this request?'}
                className="min-h-24 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
            </div>

            <div className="flex gap-3 pt-1">
              <Button onClick={() => router.push('/')} variant="outline" className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || (!isApprove && !feedback.trim())}
                className="flex-1"
                variant={isApprove ? 'default' : 'destructive'}
              >
                {isApprove ? 'Approve' : 'Reject'}
              </Button>
            </div>
          </div>
        )}

        {status === 'loading' && (
          <div className="space-y-4 py-6 text-center">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
            <h1 className="text-lg font-heading font-semibold text-foreground">Saving your decision…</h1>
            <p className="text-sm text-muted-foreground">This only takes a second.</p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4 py-6 text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-emerald-500" />
            <h1 className="text-lg font-heading font-semibold text-foreground">All set</h1>
            <p className="text-sm text-muted-foreground">{message}</p>
            <Button onClick={() => router.push('/')} className="w-full">
              Done
            </Button>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4 py-6 text-center">
            <XCircle className="mx-auto h-12 w-12 text-red-500" />
            <h1 className="text-lg font-heading font-semibold text-foreground">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">{message}</p>
            <Button onClick={() => router.push('/')} className="w-full">
              Back to home
            </Button>
          </div>
        )}
      </div>

      {editorOpen && token && req?.file_url && (
        <DocumentEditor
          fileUrl={req.file_url}
          token={token}
          onAttached={(url) => {
            setSignedUrl(url)
            setEditorOpen(false)
          }}
          onClose={() => setEditorOpen(false)}
        />
      )}
    </div>
  )
}
