'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, Menu, Inbox, ChevronsLeft } from 'lucide-react'
import type { ApprovalRequest } from '@/lib/api'
import { RequestListItem } from './request-list-item'
import { NAV_FOLDERS, type FolderValue } from './status-meta'

interface RequestListProps {
  requests: ApprovalRequest[] | undefined
  isLoading: boolean
  error: unknown
  selectedId: string | null
  onSelect: (id: string) => void
  activeStatus: FolderValue
  onOpenNav: () => void
  onCollapse?: () => void
}

function ListSkeleton() {
  return (
    <div className="space-y-1 p-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 px-2 py-3">
          <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-2.5 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function RequestList({
  requests,
  isLoading,
  error,
  selectedId,
  onSelect,
  activeStatus,
  onOpenNav,
  onCollapse,
}: RequestListProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const folderLabel = NAV_FOLDERS.find((f) => f.value === activeStatus)?.label ?? 'All requests'

  const filtered = (requests ?? []).filter((r) => {
    const s = query.trim().toLowerCase()
    if (!s) return true
    return (
      (r.title ?? '').toLowerCase().includes(s) ||
      (r.approver_email ?? '').toLowerCase().includes(s) ||
      (r.message ?? '').toLowerCase().includes(s)
    )
  })

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-border px-4 py-3">
        <div className="mb-3 flex items-center gap-2">
          <button
            onClick={onOpenNav}
            className="-ml-1 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h2 className="text-sm font-heading font-semibold text-foreground">{folderLabel}</h2>
          {!isLoading && <span className="data-num text-xs text-muted-foreground">{filtered.length}</span>}
          {onCollapse && (
            <button
              onClick={onCollapse}
              aria-label="Collapse list"
              className="ml-auto hidden rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:inline-flex"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="relative" data-tour="search">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search requests"
            className="w-full rounded-lg border border-border bg-muted/50 py-2 pl-9 pr-12 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:bg-card focus:outline-none focus:ring-2 focus:ring-ring/20"
          />
          <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 items-center rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:flex">
            ⌘K
          </kbd>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && <ListSkeleton />}

        {!isLoading && Boolean(error) && (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-foreground">Couldn&apos;t load requests</p>
            <p className="mt-1 text-xs text-muted-foreground">Check your connection and try again.</p>
          </div>
        )}

        {!isLoading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground/40" />
            <p className="mt-3 text-sm font-medium text-foreground">{query ? 'No matches' : 'Nothing here yet'}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {query ? 'Try a different search.' : 'New requests in this folder will show up here.'}
            </p>
          </div>
        )}

        {!isLoading &&
          !error &&
          filtered.map((r) => (
            <RequestListItem key={r.id} request={r} selected={r.id === selectedId} onSelect={onSelect} />
          ))}
      </div>
    </div>
  )
}
