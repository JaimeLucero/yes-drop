'use client'

import type { ReactNode } from 'react'
import { DashboardSidebar } from './dashboard-sidebar'
import type { FolderValue } from './status-meta'
import { cn } from '@/lib/utils'

interface DashboardShellProps {
  activeStatus: FolderValue
  onSelectFolder: (value: FolderValue) => void
  /** true when a request is open in the detail pane (drives mobile single-pane) */
  hasSelection: boolean
  list: ReactNode
  detail: ReactNode
  navOpen: boolean
  onCloseNav: () => void
}

export function DashboardShell({
  activeStatus,
  onSelectFolder,
  hasSelection,
  list,
  detail,
  navOpen,
  onCloseNav,
}: DashboardShellProps) {
  return (
    <div className="flex h-[100dvh] overflow-hidden bg-muted/30">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar lg:block">
        <DashboardSidebar activeStatus={activeStatus} onSelectFolder={onSelectFolder} />
      </aside>

      {/* Mobile drawer */}
      {navOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-black/40" aria-label="Close menu" onClick={onCloseNav} />
          <aside className="absolute left-0 top-0 h-full w-72 border-r border-sidebar-border bg-sidebar shadow-xl">
            <DashboardSidebar activeStatus={activeStatus} onSelectFolder={onSelectFolder} onNavigate={onCloseNav} />
          </aside>
        </div>
      )}

      {/* Main: list + detail */}
      <div className="flex min-w-0 flex-1">
        <section
          className={cn(
            'flex w-full flex-col border-r border-border bg-card lg:w-96 lg:shrink-0',
            hasSelection && 'hidden lg:flex'
          )}
        >
          {list}
        </section>
        <section className={cn('min-w-0 flex-1 bg-background', !hasSelection && 'hidden lg:block')}>{detail}</section>
      </div>
    </div>
  )
}
