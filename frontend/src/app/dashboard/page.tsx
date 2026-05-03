'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchRequests, type ApprovalRequest } from '@/lib/api'
import { LogOut, Plus, Clock, CheckCircle2, XCircle, Zap, TrendingUp, Moon, Sun } from 'lucide-react'
import Link from 'next/link'
import { signOut } from '@/lib/supabase'
import { useState, useEffect } from 'react'

function StatusBadge({ status }: { status: ApprovalRequest['status'] }) {
  const variants = {
    pending: {
      bg: 'bg-amber-50 dark:bg-amber-950/30',
      text: 'text-amber-700 dark:text-amber-300',
      border: 'border-amber-200 dark:border-amber-800',
      icon: Clock,
    },
    approved: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/30',
      text: 'text-emerald-700 dark:text-emerald-300',
      border: 'border-emerald-200 dark:border-emerald-800',
      icon: CheckCircle2,
    },
    rejected: {
      bg: 'bg-red-50 dark:bg-red-950/30',
      text: 'text-red-700 dark:text-red-300',
      border: 'border-red-200 dark:border-red-800',
      icon: XCircle,
    },
  } as const

  const variant = variants[status]
  const IconComponent = variant.icon

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${variant.bg} ${variant.text} ${variant.border}`}>
      <IconComponent className="h-3.5 w-3.5" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

export default function DashboardPage() {
  const [isDark, setIsDark] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains('dark')
    setIsDark(isDarkMode)
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    const newDarkState = !isDark
    setIsDark(newDarkState)

    if (newDarkState) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  const { data: requests, isLoading, error } = useQuery({
    queryKey: ['requests'],
    queryFn: fetchRequests,
    refetchInterval: 5000,
  })

  const handleSignOut = async () => {
    await signOut()
    window.location.href = '/login'
  }

  const stats = {
    total: requests?.length || 0,
    pending: requests?.filter(r => r.status === 'pending').length || 0,
    approved: requests?.filter(r => r.status === 'approved').length || 0,
    rejected: requests?.filter(r => r.status === 'rejected').length || 0,
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-white dark:bg-card sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
                <span className="text-white font-heading font-bold text-lg">Y</span>
              </div>
              <div>
                <h1 className="text-2xl font-heading font-bold text-foreground">Requests Dashboard</h1>
                <p className="text-sm text-foreground/60">Manage your approval workflow</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={toggleTheme}
                className="p-2 hover:bg-secondary rounded-lg transition-colors text-foreground"
                aria-label="Toggle theme"
              >
                {mounted && isDark ? (
                  <Sun className="h-5 w-5" />
                ) : (
                  <Moon className="h-5 w-5" />
                )}
              </button>
              <Link href="/requests/new">
                <button className="group inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-semibold rounded-xl hover:shadow-lg hover:shadow-primary/30 transition-all">
                  <Plus className="h-5 w-5 group-hover:rotate-90 transition-transform" />
                  New Request
                </button>
              </Link>
              <button
                onClick={handleSignOut}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-secondary text-secondary-foreground font-medium rounded-lg border border-border hover:bg-secondary/80 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Stats */}
        {requests && requests.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {[
              { label: 'Total Requests', value: stats.total, icon: TrendingUp, color: 'from-primary/10 to-primary/5', accent: 'text-primary' },
              { label: 'Pending', value: stats.pending, icon: Clock, color: 'from-amber-50 dark:from-amber-950/30 to-amber-50/50 dark:to-amber-950/10', accent: 'text-amber-600 dark:text-amber-400' },
              { label: 'Approved', value: stats.approved, icon: CheckCircle2, color: 'from-emerald-50 dark:from-emerald-950/30 to-emerald-50/50 dark:to-emerald-950/10', accent: 'text-emerald-600 dark:text-emerald-400' },
              { label: 'Rejected', value: stats.rejected, icon: XCircle, color: 'from-red-50 dark:from-red-950/30 to-red-50/50 dark:to-red-950/10', accent: 'text-red-600 dark:text-red-400' },
            ].map((stat, i) => {
              const Icon = stat.icon
              return (
                <div key={i} className={`bg-gradient-to-br ${stat.color} rounded-xl border border-border/50 p-6 hover:border-primary/30 transition-all group cursor-default`}>
                  <div className="flex items-start justify-between mb-4">
                    <p className="text-foreground/70 text-sm font-semibold">{stat.label}</p>
                    <div className={`p-2 rounded-lg bg-white/50 dark:bg-background/50 group-hover:bg-white dark:group-hover:bg-background transition-colors`}>
                      <Icon className={`h-5 w-5 ${stat.accent}`} />
                    </div>
                  </div>
                  <p className={`text-4xl font-heading font-bold ${stat.accent}`}>{stat.value}</p>
                </div>
              )
            })}
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="inline-block animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mb-4"></div>
            <p className="text-foreground/60 font-medium">Loading your requests...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
            <p className="text-red-700 dark:text-red-300 font-medium">Unable to load requests</p>
            <p className="text-red-600 dark:text-red-400 text-sm mt-1">{String(error)}</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && !requests?.length && (
          <div className="bg-white dark:bg-card rounded-lg border border-border p-12 text-center">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-secondary mb-6">
              <Plus className="h-8 w-8 text-secondary-foreground" />
            </div>
            <h3 className="text-xl font-heading font-semibold text-foreground mb-2">No requests yet</h3>
            <p className="text-foreground/60 mb-6 max-w-sm mx-auto">Create your first approval request to get started. It only takes a few seconds.</p>
            <Link href="/requests/new">
              <button className="inline-flex items-center gap-2 px-6 py-2.5 bg-accent text-accent-foreground font-medium rounded-lg hover:bg-accent/90 transition-colors">
                <Plus className="h-4 w-4" />
                Create Request
              </button>
            </Link>
          </div>
        )}

        {/* Requests Grid */}
        {requests && requests.length > 0 && (
          <div>
            <h2 className="text-xl font-heading font-semibold text-foreground mb-6">Your Requests</h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {requests.map((req) => (
                <div key={req.id} className="group bg-white dark:bg-card rounded-xl border border-border hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 overflow-hidden">
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="text-lg font-heading font-semibold text-foreground flex-1 break-words pr-3 group-hover:text-primary transition-colors">{req.title}</h3>
                      <div className="flex-shrink-0">
                        <StatusBadge status={req.status} />
                      </div>
                    </div>

                    <div className="space-y-4 mb-6">
                      <div className="text-sm">
                        <p className="text-foreground/60 font-semibold uppercase text-xs tracking-wide mb-2">Approver</p>
                        <p className="text-foreground font-medium break-all">{req.approver_email}</p>
                      </div>
                      {req.message && (
                        <div className="text-sm">
                          <p className="text-foreground/60 font-semibold uppercase text-xs tracking-wide mb-2">Message</p>
                          <p className="text-foreground/80 line-clamp-3 leading-relaxed">{req.message}</p>
                        </div>
                      )}
                      {req.file_url && (
                        <div className="text-sm">
                          <p className="text-foreground/60 font-semibold uppercase text-xs tracking-wide mb-2">Attachment</p>
                          <a href={req.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-accent hover:text-accent/80 font-semibold break-all hover:underline">
                            📎 View file
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t border-border/50">
                      <p className="text-xs text-foreground/50 font-medium">
                        {new Date(req.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })} at {new Date(req.created_at).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}