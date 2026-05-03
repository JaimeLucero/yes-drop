'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchRequests, deleteRequest, sendRequestNow, scheduleRequest, updateRequest, type ApprovalRequest } from '@/lib/api'
import { DailyLimitIndicator } from '@/components/daily-limit-indicator'
import { RequestFilters, type RequestStatusFilter } from '@/components/request-filters'
import { RequestCard } from '@/components/request-card'
import { ScheduleModal } from '@/components/schedule-modal'
import { EditRequestModal } from '@/components/edit-request-modal'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

export default function DashboardPage() {
  const [statusFilter, setStatusFilter] = useState<RequestStatusFilter>('all')
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null)
  const queryClient = useQueryClient()

  const { data: requests, isLoading, error, refetch } = useQuery({
    queryKey: ['requests', statusFilter],
    queryFn: () => fetchRequests(statusFilter === 'all' ? undefined : statusFilter),
    refetchInterval: 5000,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      queryClient.invalidateQueries({ queryKey: ['daily-limit'] })
      toast.success('Draft deleted successfully')
    },
    onError: (error) => {
      toast.error(`Failed to delete: ${error.message}`)
    },
  })

  const sendNowMutation = useMutation({
    mutationFn: sendRequestNow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      queryClient.invalidateQueries({ queryKey: ['daily-limit'] })
      toast.success('Request sent successfully')
    },
    onError: (error) => {
      toast.error(`Failed to send: ${error.message}`)
    },
  })

  const scheduleMutation = useMutation({
    mutationFn: ({ id, datetime, followUpStrategy, deadlineDays }: { 
      id: string; 
      datetime: string; 
      followUpStrategy?: { enabled: boolean; days_before_deadline?: number; days_after_sending?: number };
      deadlineDays?: number;
    }) =>
      scheduleRequest(id, datetime),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      setScheduleModalOpen(false)
      setSelectedRequest(null)
      toast.success('Request scheduled successfully')
    },
    onError: (error) => {
      toast.error(`Failed to schedule: ${error.message}`)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      updateRequest(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      setEditModalOpen(false)
      setSelectedRequest(null)
      toast.success('Request updated successfully')
    },
    onError: (error) => {
      toast.error(`Failed to update: ${error.message}`)
    },
  })

  const handleDelete = (request: ApprovalRequest) => {
    if (confirm(`Delete draft "${request.title || 'Untitled'}"? This cannot be undone.`)) {
      deleteMutation.mutate(request.id)
    }
  }

  const handleSendNow = (request: ApprovalRequest) => {
    sendNowMutation.mutate(request.id)
  }

  const handleEdit = (request: ApprovalRequest) => {
    setSelectedRequest(request)
    setEditModalOpen(true)
  }

  const handleEditSubmit = (data: any) => {
    if (selectedRequest) {
      updateMutation.mutate({
        id: selectedRequest.id,
        data,
      })
    }
  }

  const handleSchedule = (request: ApprovalRequest) => {
    setSelectedRequest(request)
    setScheduleModalOpen(true)
  }

  const handleScheduleSubmit = (datetime: string, followUpStrategy?: { enabled: boolean; days_before_deadline?: number; days_after_sending?: number }, deadlineDays?: number) => {
    if (selectedRequest) {
      scheduleMutation.mutate({
        id: selectedRequest.id,
        datetime,
      })
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Daily Limit Indicator */}
        <DailyLimitIndicator />

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-heading font-semibold text-foreground">Dashboard</h1>
          <Link href="/requests/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Request
            </Button>
          </Link>
        </div>

        {/* Status Filters */}
        <RequestFilters onFilterChange={setStatusFilter} />

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
        {!isLoading && !error && (!requests || requests.length === 0) && (
          <div className="bg-white dark:bg-card rounded-lg border border-border p-12 text-center">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-secondary mb-6">
              <Plus className="h-8 w-8 text-secondary-foreground" />
            </div>
            <h3 className="text-xl font-heading font-semibold text-foreground mb-2">
              {statusFilter === 'all' ? 'No requests yet' : `No ${statusFilter} requests`}
            </h3>
            <p className="text-foreground/60 mb-6 max-w-sm mx-auto">
              {statusFilter === 'all' 
                ? "Create your first approval request to get started. It only takes a few seconds."
                : `You don't have any ${statusFilter} requests at the moment.`
              }
            </p>
            {statusFilter === 'all' && (
              <Link href="/requests/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Request
                </Button>
              </Link>
            )}
          </div>
        )}

        {/* Requests Grid */}
        {requests && requests.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {requests.map((req) => (
              <RequestCard
                key={req.id}
                request={req}
                onEdit={() => handleEdit(req)}
                onDelete={() => handleDelete(req)}
                onSchedule={() => handleSchedule(req)}
                onSendNow={() => handleSendNow(req)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Schedule Modal */}
      <ScheduleModal
        open={scheduleModalOpen}
        onOpenChange={setScheduleModalOpen}
        onSchedule={handleScheduleSubmit}
        initialDate={selectedRequest?.scheduled_send_at || undefined}
      />

      {/* Edit Modal */}
      <EditRequestModal
        request={selectedRequest}
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        onSave={handleEditSubmit}
        isLoading={updateMutation.isPending}
      />
    </div>
  )
}
