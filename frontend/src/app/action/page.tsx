'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function ActionPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')
  const action = searchParams.get('action')
  const [status, setStatus] = useState<'form' | 'loading' | 'success' | 'error'>('form')
  const [message, setMessage] = useState('')
  const [feedback, setFeedback] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!token || !action || !['approve', 'reject'].includes(action)) {
      setStatus('error')
      setMessage('Invalid request. Missing or invalid token/action.')
    }
  }, [token, action])

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
        setMessage(action === 'approve' ? 'Request approved successfully!' : 'Request rejected.')
      } else {
        setStatus('error')
        setMessage(action === 'approve' ? 'Failed to approve request.' : 'Failed to reject request.')
      }
    } catch (error) {
      setStatus('error')
      setMessage('An error occurred while processing your request.')
      console.error(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-background/80 px-4">
      <div className="max-w-md w-full">
        {status === 'form' && (
          <div className="bg-white dark:bg-card rounded-xl border border-border p-6 space-y-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {action === 'approve' ? 'Approve Request?' : 'Reject Request?'}
              </h1>
              <p className="text-muted-foreground mt-1">
                {action === 'approve'
                  ? 'You can add comments before approving.'
                  : 'Please provide feedback on why you are rejecting this request.'}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Feedback {action === 'reject' ? '(required)' : '(optional)'}
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder={
                  action === 'reject'
                    ? 'Why are you rejecting this request?'
                    : 'Any comments or notes?'
                }
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary min-h-24 resize-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                onClick={() => router.push('/')}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || (action === 'reject' && !feedback.trim())}
                className="flex-1"
                variant={action === 'approve' ? 'default' : 'destructive'}
              >
                {action === 'approve' ? 'Approve' : 'Reject'}
              </Button>
            </div>
          </div>
        )}

        {status === 'loading' && (
          <div className="bg-white dark:bg-card rounded-xl border border-border p-6 space-y-4 text-center">
            <Loader2 className="w-16 h-16 mx-auto animate-spin text-primary" />
            <h1 className="text-2xl font-bold">Processing...</h1>
            <p className="text-muted-foreground">Please wait while we process your request.</p>
          </div>
        )}

        {status === 'success' && (
          <div className="bg-white dark:bg-card rounded-xl border border-border p-6 space-y-4 text-center">
            <CheckCircle className="w-16 h-16 mx-auto text-green-500" />
            <h1 className="text-2xl font-bold text-green-600">Success</h1>
            <p className="text-muted-foreground">{message}</p>
            <Button onClick={() => router.push('/')} className="w-full">
              Back to Home
            </Button>
          </div>
        )}

        {status === 'error' && (
          <div className="bg-white dark:bg-card rounded-xl border border-border p-6 space-y-4 text-center">
            <XCircle className="w-16 h-16 mx-auto text-red-500" />
            <h1 className="text-2xl font-bold text-red-600">Error</h1>
            <p className="text-muted-foreground">{message}</p>
            <Button onClick={() => router.push('/')} className="w-full">
              Back to Home
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
