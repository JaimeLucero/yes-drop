'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'

export default function ActionPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')
  const action = searchParams.get('action')
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token || !action || !['approve', 'reject'].includes(action)) {
      setStatus('error')
      setMessage('Invalid request. Missing or invalid token/action.')
      return
    }

    const processAction = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/action?token=${token}&action=${action}`,
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
      }
    }

    processAction()
  }, [token, action])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-background/80 px-4">
      <div className="max-w-md w-full text-center">
        {status === 'loading' && (
          <div className="space-y-4">
            <Loader2 className="w-16 h-16 mx-auto animate-spin text-primary" />
            <h1 className="text-2xl font-bold">Processing...</h1>
            <p className="text-muted-foreground">Please wait while we process your request.</p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4">
            <CheckCircle className="w-16 h-16 mx-auto text-green-500" />
            <h1 className="text-2xl font-bold text-green-600">Success</h1>
            <p className="text-muted-foreground">{message}</p>
            <button
              onClick={() => router.push('/')}
              className="mt-6 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition"
            >
              Back to Home
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <XCircle className="w-16 h-16 mx-auto text-red-500" />
            <h1 className="text-2xl font-bold text-red-600">Error</h1>
            <p className="text-muted-foreground">{message}</p>
            <button
              onClick={() => router.push('/')}
              className="mt-6 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition"
            >
              Back to Home
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
