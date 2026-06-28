'use client'

import { Suspense } from 'react'
import ActionContent from './action-content'

export default function ActionPage() {
  return (
    <Suspense fallback={<ActionPageSkeleton />}>
      <ActionContent />
    </Suspense>
  )
}

function ActionPageSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="max-w-md w-full bg-card rounded-2xl border border-border p-6 shadow-sm">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-secondary rounded-lg w-3/4"></div>
          <div className="h-4 bg-secondary rounded-lg w-full"></div>
          <div className="h-24 bg-secondary rounded-lg w-full"></div>
          <div className="flex gap-3">
            <div className="h-10 bg-secondary rounded-lg flex-1"></div>
            <div className="h-10 bg-secondary rounded-lg flex-1"></div>
          </div>
        </div>
      </div>
    </div>
  )
}
