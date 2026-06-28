'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Plus, Moon, Sun, LogOut, ChevronsLeft, ChevronsRight, Compass, Settings } from 'lucide-react'
import { getMyStats, getDailyLimit } from '@/lib/api'
import { NAV_FOLDERS, type FolderValue } from './status-meta'
import { BrandLogo } from '@/components/brand-logo'
import { useTheme } from '@/components/theme-provider'
import { signOut } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface DashboardSidebarProps {
  activeStatus: FolderValue
  onSelectFolder: (value: FolderValue) => void
  /** called after a nav action — used to close the mobile drawer */
  onNavigate?: () => void
  /** desktop icon-rail mode */
  collapsed?: boolean
  onToggleCollapse?: () => void
  /** start the product tour */
  onStartTour?: () => void
}

export function DashboardSidebar({
  activeStatus,
  onSelectFolder,
  onNavigate,
  collapsed = false,
  onToggleCollapse,
  onStartTour,
}: DashboardSidebarProps) {
  const { theme, toggleTheme } = useTheme()
  const [signOutOpen, setSignOutOpen] = useState(false)
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
      {/* Brand + collapse toggle */}
      <div className={cn('flex h-16 shrink-0 items-center', collapsed ? 'justify-center px-2' : 'justify-between px-4')}>
        <BrandLogo href="/dashboard" withText={!collapsed} />
        {!collapsed && onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            aria-label="Collapse sidebar"
            className="hidden rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:inline-flex"
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Expand control (icon-rail mode) */}
      {collapsed && onToggleCollapse && (
        <div className="px-2 pb-1">
          <button
            onClick={onToggleCollapse}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className="flex h-8 w-full items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronsRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* New request */}
      <div className={cn('pb-2', collapsed ? 'px-2 pt-6' : 'px-3')}>
        <Link
          href="/requests/new"
          onClick={onNavigate}
          data-tour="new-request"
          title={collapsed ? 'New request' : undefined}
          className={cn(
            'flex items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90',
            collapsed ? 'h-10 w-10' : 'w-full px-4 py-2.5'
          )}
        >
          <Plus className="h-4 w-4" />
          {!collapsed && 'New request'}
        </Link>
      </div>

      {/* Folder nav */}
      <nav data-tour="folders" className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
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
              title={collapsed ? label : undefined}
              className={cn(
                'group flex w-full items-center rounded-lg text-sm transition-colors',
                collapsed ? 'h-10 justify-center' : 'gap-3 px-3 py-2',
                active
                  ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
              )}
            >
              <span className="relative">
                <Icon
                  className={cn(
                    'h-4 w-4 shrink-0',
                    active ? 'text-primary' : 'text-sidebar-foreground/45 group-hover:text-sidebar-foreground/80'
                  )}
                />
                {collapsed && count != null && count > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                )}
              </span>
              {!collapsed && <span className="flex-1 truncate text-left">{label}</span>}
              {!collapsed && count != null && count > 0 && (
                <span className={cn('data-num text-xs', active ? 'text-sidebar-accent-foreground' : 'text-sidebar-foreground/45')}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Account block */}
      <div className={cn('space-y-2 border-t border-sidebar-border', collapsed ? 'px-2 py-3' : 'p-3')}>
        {!collapsed && limit && (
          <div data-tour="daily-limit" className="rounded-lg bg-muted/60 px-3 py-2">
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
                  limit.used >= limit.limit ? 'bg-red-500' : limit.used >= limit.limit - 1 ? 'bg-amber-500' : 'bg-primary'
                )}
                style={{ width: `${Math.min((limit.used / limit.limit) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}

        {onStartTour && (
          <button
            onClick={onStartTour}
            title={collapsed ? 'Take a tour' : undefined}
            className={cn(
              'flex items-center rounded-lg text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
              collapsed ? 'h-10 w-full justify-center' : 'w-full gap-2 px-3 py-2'
            )}
          >
            <Compass className="h-4 w-4" />
            {!collapsed && 'Take a tour'}
          </button>
        )}

        <Link
          href="/settings"
          onClick={onNavigate}
          title={collapsed ? 'Settings' : undefined}
          className={cn(
            'flex items-center rounded-lg text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
            collapsed ? 'h-10 w-full justify-center' : 'w-full gap-2 px-3 py-2'
          )}
        >
          <Settings className="h-4 w-4" />
          {!collapsed && 'Settings'}
        </Link>

        <div className={cn('flex items-center gap-1', collapsed && 'flex-col')}>
          <button
            onClick={toggleTheme}
            title={collapsed ? 'Theme' : undefined}
            className={cn(
              'flex items-center justify-center gap-2 rounded-lg text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
              collapsed ? 'h-10 w-10' : 'flex-1 px-3 py-2'
            )}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {!collapsed && 'Theme'}
          </button>
          <button
            onClick={() => setSignOutOpen(true)}
            title={collapsed ? 'Sign out' : undefined}
            className={cn(
              'flex items-center justify-center gap-2 rounded-lg text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
              collapsed ? 'h-10 w-10' : 'flex-1 px-3 py-2'
            )}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && 'Sign out'}
          </button>
        </div>
      </div>

      <AlertDialog open={signOutOpen} onOpenChange={setSignOutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out?</AlertDialogTitle>
            <AlertDialogDescription>You&apos;ll need to sign in again to manage your requests.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSignOut}>Sign out</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
