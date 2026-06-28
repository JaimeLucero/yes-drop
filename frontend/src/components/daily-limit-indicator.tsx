'use client'

import { useQuery } from '@tanstack/react-query'
import { getDailyLimit } from '@/lib/api'
import { TrendingUp } from 'lucide-react'

interface DailyLimitIndicatorProps {
  onLimitReached?: () => void
}

export function DailyLimitIndicator({ onLimitReached }: DailyLimitIndicatorProps) {
  const { data: limit, isLoading } = useQuery({
    queryKey: ['daily-limit'],
    queryFn: getDailyLimit,
    refetchInterval: 60000, // Refetch every minute
  })

  if (isLoading || !limit) {
    return null
  }

  const percentage = (limit.used / limit.limit) * 100
  const isAtLimit = limit.used >= limit.limit
  const isNearLimit = limit.used >= limit.limit - 1

  if (isAtLimit) {
    onLimitReached?.()
  }

  return (
    <div className="bg-white dark:bg-card rounded-xl border border-border p-4 mb-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <TrendingUp className={`h-5 w-5 ${isAtLimit ? 'text-red-500' : isNearLimit ? 'text-amber-500' : 'text-primary'}`} />
          <div>
            <p className="font-semibold text-foreground">
              {limit.used} / {limit.limit} requests used today
            </p>
            <p className="text-sm text-muted-foreground">
              {limit.remaining > 0 
                ? `${limit.remaining} remaining` 
                : 'Limit reached'}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-foreground">
            Resets at {new Date(limit.resets_at).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
          <p className="text-xs text-muted-foreground">
            {new Date(limit.resets_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </p>
          {limit.next_available_date && isAtLimit && (
            <p className="text-xs text-muted-foreground mt-1">
              Next available: {new Date(limit.next_available_date).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
      
      <div className="w-full bg-secondary rounded-full h-2">
        <div 
          className={`h-2 rounded-full transition-all ${
            isAtLimit ? 'bg-red-500' : isNearLimit ? 'bg-amber-500' : 'bg-primary'
          }`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      
      {isAtLimit && (
        <div className="mt-3 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-700 dark:text-red-300 font-medium">
            Daily limit reached. You can still save drafts or schedule requests for tomorrow.
          </p>
        </div>
      )}
      
      {isNearLimit && !isAtLimit && (
        <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">
            You have {limit.remaining} request{limit.remaining > 1 ? 's' : ''} remaining today.
          </p>
        </div>
      )}
    </div>
  )
}
