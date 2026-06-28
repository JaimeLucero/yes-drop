'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchRequests,
  deleteRequest,
  sendRequestNow,
  scheduleRequest,
  updateRequest,
  type Reminder,
} from '@/lib/api'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { RequestList } from '@/components/dashboard/request-list'
import { RequestDetail, RequestDetailEmpty } from '@/components/dashboard/request-detail'
import type { FolderValue } from '@/components/dashboard/status-meta'
import { RescheduleModal } from '@/components/reschedule-modal'
import { EditRequestModal } from '@/components/edit-request-modal'
import { toast } from 'sonner'

function DashboardView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()

  const status = (searchParams.get('status') as FolderValue) || 'all'
  const selectedId = searchParams.get('id')

  const [navOpen, setNavOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false)

  const { data: requests, isLoading, error } = useQuery({
    queryKey: ['requests', status],
    queryFn: () => fetchRequests(status === 'all' ? undefined : status),
    refetchInterval: 5000,
  })

  const selected = requests?.find((r) => r.id === selectedId) ?? null

  const setParams = (next: { status?: FolderValue; id?: string | null }) => {
    const params = new URLSearchParams(searchParams.toString())
    if (next.status !== undefined) {
      if (next.status === 'all') params.delete('status')
      else params.set('status', next.status)
    }
    if (next.id !== undefined) {
      if (next.id === null) params.delete('id')
      else params.set('id', next.id)
    }
    const qs = params.toString()
    router.replace(qs ? `/dashboard?${qs}` : '/dashboard', { scroll: false })
  }

  const selectFolder = (value: FolderValue) => setParams({ status: value, id: null })
  const selectRequest = (id: string) => setParams({ id })
  const clearSelection = () => setParams({ id: null })

  const deleteMutation = useMutation({
    mutationFn: deleteRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      queryClient.invalidateQueries({ queryKey: ['daily-limit'] })
      queryClient.invalidateQueries({ queryKey: ['my-stats'] })
      clearSelection()
      toast.success('Request deleted')
    },
    onError: (err) => toast.error(`Couldn't delete: ${err.message}`),
  })

  const sendNowMutation = useMutation({
    mutationFn: sendRequestNow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      queryClient.invalidateQueries({ queryKey: ['daily-limit'] })
      queryClient.invalidateQueries({ queryKey: ['my-stats'] })
      toast.success('Request sent')
    },
    onError: (err) => toast.error(`Couldn't send: ${err.message}`),
  })

  const scheduleMutation = useMutation({
    mutationFn: ({
      id,
      datetime,
      deadlineDays,
      reminders,
    }: {
      id: string
      datetime: string
      deadlineDays?: number
      reminders?: Reminder[]
    }) => scheduleRequest(id, datetime, reminders, deadlineDays),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      queryClient.invalidateQueries({ queryKey: ['my-stats'] })
      setScheduleModalOpen(false)
      toast.success('Request scheduled')
    },
    onError: (err) => toast.error(`Couldn't schedule: ${err.message}`),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateRequest>[1] }) => updateRequest(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      setEditModalOpen(false)
      toast.success('Request updated')
    },
    onError: (err) => toast.error(`Couldn't update: ${err.message}`),
  })

  const handleDelete = () => {
    if (!selected) return
    if (confirm(`Delete "${selected.title || 'Untitled'}"? This can't be undone.`)) {
      deleteMutation.mutate(selected.id)
    }
  }

  const handleSendNow = () => {
    if (selected) sendNowMutation.mutate(selected.id)
  }

  const handleEditSubmit = (data: Parameters<typeof updateRequest>[1]) => {
    if (selected) updateMutation.mutate({ id: selected.id, data })
  }

  const handleScheduleSubmit = (datetime: string, deadlineDays?: number, reminders?: Reminder[]) => {
    if (selected) scheduleMutation.mutate({ id: selected.id, datetime, deadlineDays, reminders })
  }

  const list = (
    <RequestList
      requests={requests}
      isLoading={isLoading}
      error={error}
      selectedId={selectedId}
      onSelect={selectRequest}
      activeStatus={status}
      onOpenNav={() => setNavOpen(true)}
    />
  )

  const detail = selected ? (
    <RequestDetail
      request={selected}
      onClose={clearSelection}
      onEdit={() => setEditModalOpen(true)}
      onSchedule={() => setScheduleModalOpen(true)}
      onSendNow={handleSendNow}
      onDelete={handleDelete}
    />
  ) : (
    <RequestDetailEmpty />
  )

  return (
    <>
      <DashboardShell
        activeStatus={status}
        onSelectFolder={selectFolder}
        hasSelection={!!selected}
        list={list}
        detail={detail}
        navOpen={navOpen}
        onCloseNav={() => setNavOpen(false)}
      />

      <RescheduleModal
        open={scheduleModalOpen}
        onOpenChange={setScheduleModalOpen}
        onReschedule={handleScheduleSubmit}
        initialDate={selected?.scheduled_send_at || undefined}
        initialDeadline={selected?.deadline || undefined}
        initialReminders={null}
      />

      <EditRequestModal
        request={selected}
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        onSave={handleEditSubmit}
        isLoading={updateMutation.isPending}
      />
    </>
  )
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[100dvh] items-center justify-center bg-background">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      }
    >
      <DashboardView />
    </Suspense>
  )
}
