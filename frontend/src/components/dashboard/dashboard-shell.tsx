'use client'

import type { ReactNode } from 'react'
import { ChevronsRight } from 'lucide-react'
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
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
  listCollapsed: boolean
  onToggleList: () => void
  onStartTour: () => void
}

export function DashboardShell({
  activeStatus,
  onSelectFolder,
  hasSelection,
  list,
  detail,
  navOpen,
  onCloseNav,
  sidebarCollapsed,
  onToggleSidebar,
  listCollapsed,
  onToggleList,
  onStartTour,
}: DashboardShellProps) {
  return (
    <div className="flex h-[100dvh] overflow-hidden bg-muted/30">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden shrink-0 border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:block',
          sidebarCollapsed ? 'lg:w-16' : 'lg:w-64'
        )}
      >
        <DashboardSidebar
          activeStatus={activeStatus}
          onSelectFolder={onSelectFolder}
          collapsed={sidebarCollapsed}
          onToggleCollapse={onToggleSidebar}
          onStartTour={onStartTour}
        />
      </aside>

      {/* Mobile drawer */}
      {navOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-black/40" aria-label="Close menu" onClick={onCloseNav} />
          <aside className="absolute left-0 top-0 h-full w-72 border-r border-sidebar-border bg-sidebar shadow-xl">
            <DashboardSidebar
              activeStatus={activeStatus}
              onSelectFolder={onSelectFolder}
              onNavigate={onCloseNav}
              onStartTour={() => {
                onCloseNav()
                onStartTour()
              }}
            />
          </aside>
        </div>
      )}

      {/* Main: list + detail */}
      <div className="flex min-w-0 flex-1">
        <section
          data-tour="request-list"
          className={cn(
            'flex w-full flex-col border-r border-border bg-card lg:w-96 lg:shrink-0',
            hasSelection && 'hidden lg:flex',
            listCollapsed && 'lg:hidden'
          )}
        >
          {list}
        </section>

        <section
          data-tour="detail"
          className={cn('relative min-w-0 flex-1 bg-background', !hasSelection && 'hidden lg:block')}
        >
          {listCollapsed && (
            <button
              onClick={onToggleList}
              aria-label="Show request list"
              className="absolute left-0 top-1/2 z-10 hidden h-14 w-6 -translate-y-1/2 items-center justify-center rounded-r-lg border border-l-0 border-border bg-card text-muted-foreground transition-colors hover:text-foreground lg:flex"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          )}
          {detail}
        </section>
      </div>
    </div>
  )
}
