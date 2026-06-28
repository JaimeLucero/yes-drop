'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Plus, Moon, Sun, LogOut } from 'lucide-react'
import { getMyStats, getDailyLimit } from '@/lib/api'
import { NAV_FOLDERS, type FolderValue } from './status-meta'
import { BrandLogo } from '@/components/brand-logo'
import { useTheme } from '@/components/theme-provider'
import { signOut } from '@/lib/supabase'
import { cn } from '@/lib/utils'

interface DashboardSidebarProps {
  activeStatus: FolderValue
  onSelectFolder: (value: FolderValue) => void
  /** called after a nav action — used to close the mobile drawer */
  onNavigate?: () => void
}

export function DashboardSidebar({ activeStatus, onSelectFolder, onNavigate }: DashboardSidebarProps) {
  const { theme, toggleTheme } = useTheme()
  const { data: stats } = useQuery({ queryKey: ['my-stats'], queryFn: getMyStats, refetchInterval: 30000 })
  const { data: limit } = useQuery({ queryKey: ['daily-limit'], queryFn: getDailyLimit, refetchInterval: 60000 })

  const countFor = (value: FolderValue): number | null => {
    if (!stats) return null
    if (value === 'all') return stats.total
    return stats.by_status?.[value] ?? 0
  }

  const handleSignOut = async () => {
    await signOut()
    window.location.href = '/login'
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center px-4">
        <BrandLogo href="/dashboard" />
      </div>

      <div className="px-3 pb-2">
        <Link
          href="/requests/new"
          onClick={onNavigate}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New request
        </Link>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
        {NAV_FOLDERS.map(({ value, label, Icon }) => {
          const active = activeStatus === value
          const count = countFor(value)
          return (
            <button
              key={value}
              onClick={() => {
                onSelectFolder(value)
                onNavigate?.()
              }}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0',
                  active ? 'text-primary' : 'text-sidebar-foreground/45 group-hover:text-sidebar-foreground/80'
                )}
              />
              <span className="flex-1 truncate text-left">{label}</span>
              {count != null && count > 0 && (
                <span className={cn('data-num text-xs', active ? 'text-sidebar-accent-foreground' : 'text-sidebar-foreground/45')}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <div className="space-y-2 border-t border-sidebar-border p-3">
        {limit && (
          <div className="rounded-lg bg-muted/60 px-3 py-2">
            <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
              <span>Daily usage</span>
              <span className="data-num">
                {limit.used}/{limit.limit}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  limit.used >= 5 ? 'bg-red-500' : limit.used >= 4 ? 'bg-amber-500' : 'bg-primary'
                )}
                style={{ width: `${Math.min((limit.used / limit.limit) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}
        <div className="flex items-center gap-1">
          <button
            onClick={toggleTheme}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            Theme
          </button>
          <button
            onClick={handleSignOut}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
