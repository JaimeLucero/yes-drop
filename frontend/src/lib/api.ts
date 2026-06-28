import { createClient } from '@/lib/supabase'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL!

export interface ApprovalRequest {
  id: string
  user_id: string
  requester_email: string | null
  approver_email: string | null
  title: string | null
  message: string | null
  file_url: string | null
  feedback: string | null
  viewed_at: string | null
  view_count: number
  token: string
  status: 'draft' | 'scheduled' | 'pending' | 'approved' | 'rejected' | 'ignored'
  scheduled_send_at: string | null
  sent_at: string | null
  deadline: string | null
  deadline_days: number | null
  follow_up_strategy: {
    enabled: boolean
    days_before_deadline?: number
    days_after_sending?: number
  } | null
  reminders?: Reminder[]
  response_file_url?: string | null
  response_signed_at?: string | null
  signer_name?: string | null
  created_at: string
  updated_at: string
}

export interface PublicRequest {
  title: string | null
  message: string | null
  file_url: string | null
  status: string
}

/** Public (token-only) request info for the receiver action page. */
export async function getPublicRequest(token: string): Promise<PublicRequest> {
  const response = await fetch(`${BACKEND_URL}/api/public/requests/${token}`)
  if (!response.ok) throw new Error('Request not found')
  return response.json()
}

/** Receiver uploads a signed/edited copy of the attached document (public, token). */
export async function uploadResponseDocument(
  token: string,
  blob: Blob,
  signerName?: string
): Promise<{ response_file_url: string }> {
  const form = new FormData()
  form.append('file', blob, 'signed.pdf')
  const url = new URL(`${BACKEND_URL}/action/response-document`)
  url.searchParams.set('token', token)
  if (signerName) url.searchParams.set('signer_name', signerName)
  const response = await fetch(url.toString(), { method: 'POST', body: form })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.detail || 'Could not upload the signed document')
  }
  return response.json()
}

export interface Reminder {
  kind: 'before_deadline' | 'after_sending' | 'absolute'
  send_at: string // absolute UTC ISO timestamp
  custom_message?: string
}

export interface DailyLimit {
  used: number
  limit: number
  remaining: number
  resets_at: string
  next_available_date: string | null
}

export interface PublicStats {
  total_sent: number
  total_approved: number
  total_rejected: number
  approval_rate: number | null
  avg_response_hours: number | null
  active_users: number
}

export interface MyStats {
  total: number
  by_status: Record<string, number>
  sent: number
  pending: number
  approved: number
  approval_rate: number | null
  avg_response_hours: number | null
  volume_30d: { date: string; count: number }[]
}

export async function getPublicStats(): Promise<PublicStats> {
  const response = await fetch(`${BACKEND_URL}/api/stats`)
  if (!response.ok) throw new Error('Failed to fetch public stats')
  return response.json()
}

export async function getMyStats(): Promise<MyStats> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) throw new Error('Not authenticated')

  const response = await fetch(`${BACKEND_URL}/api/stats/me`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })

  if (!response.ok) throw new Error('Failed to fetch user stats')
  return response.json()
}

export async function getDailyLimit(): Promise<DailyLimit> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) throw new Error('Not authenticated')

  const response = await fetch(`${BACKEND_URL}/api/requests/limit`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })

  if (!response.ok) throw new Error('Failed to fetch daily limit')
  return response.json()
}

export interface GoogleStatus {
  connected: boolean
  email: string | null
  last_error: string | null
}

export async function getGoogleStatus(): Promise<GoogleStatus> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  const response = await fetch(`${BACKEND_URL}/api/google/status`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  if (!response.ok) throw new Error('Failed to fetch Google status')
  return response.json()
}

export async function connectGoogleToken(refreshToken: string, email?: string | null): Promise<GoogleStatus> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  const response = await fetch(`${BACKEND_URL}/api/google/connect`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken, email }),
  })
  if (!response.ok) throw new Error('Failed to connect Google account')
  return response.json()
}

export async function disconnectGoogle(): Promise<{ success: boolean }> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  const response = await fetch(`${BACKEND_URL}/api/google/disconnect`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  if (!response.ok) throw new Error('Failed to disconnect')
  return response.json()
}

export interface ReminderPlan {
  deadline: string | null
  reminders: Reminder[]
}

export async function generateReminderPlan(
  intent: string,
  sentAt?: string | null,
  deadline?: string | null
): Promise<ReminderPlan> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  const response = await fetch(`${BACKEND_URL}/api/reminders/generate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ intent, sent_at: sentAt, deadline }),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.detail || 'Could not generate a schedule')
  }
  return response.json()
}

export async function fetchRequests(status?: string): Promise<ApprovalRequest[]> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) throw new Error('Not authenticated')

  const url = new URL(`${BACKEND_URL}/api/requests`)
  if (status) url.searchParams.set('status', status)
  
  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })

  if (!response.ok) throw new Error('Failed to fetch requests')
  return response.json()
}

export async function createRequest(data: {
  approver_email: string
  title: string
  message?: string
  file_url?: string
  scheduled_send_at?: string
  deadline_days?: number
  reminders?: Reminder[]
}): Promise<ApprovalRequest> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) throw new Error('Not authenticated')

  const response = await fetch(`${BACKEND_URL}/api/requests`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.detail?.message || 'Failed to create request')
  }

  return response.json()
}

export async function createDraft(data: {
  approver_email?: string
  title?: string
  message?: string
  file_url?: string
}): Promise<ApprovalRequest> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) throw new Error('Not authenticated')

  const response = await fetch(`${BACKEND_URL}/api/requests/draft`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.detail || 'Failed to create draft')
  }

  return response.json()
}

export async function scheduleRequest(
  requestId: string,
  scheduledSendAt: string,
  reminders?: Reminder[],
  deadlineDays?: number
): Promise<ApprovalRequest> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) throw new Error('Not authenticated')

  const body: Record<string, unknown> = { scheduled_send_at: scheduledSendAt }
  if (reminders !== undefined) body.reminders = reminders
  if (deadlineDays !== undefined) body.deadline_days = deadlineDays

  const response = await fetch(`${BACKEND_URL}/api/requests/${requestId}/schedule`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.detail?.message || 'Failed to schedule request')
  }

  return response.json()
}

export async function sendRequestNow(requestId: string): Promise<ApprovalRequest> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) throw new Error('Not authenticated')

  const response = await fetch(`${BACKEND_URL}/api/requests/${requestId}/send-now`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.detail?.message || 'Failed to send request')
  }

  return response.json()
}

export async function updateRequest(
  requestId: string,
  data: {
    approver_email?: string
    title?: string
    message?: string
    file_url?: string
    scheduled_send_at?: string
  }
): Promise<ApprovalRequest> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) throw new Error('Not authenticated')

  const response = await fetch(`${BACKEND_URL}/api/requests/${requestId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.detail?.message || 'Failed to update request')
  }

  return response.json()
}

export async function deleteRequest(requestId: string): Promise<void> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) throw new Error('Not authenticated')

  const response = await fetch(`${BACKEND_URL}/api/requests/${requestId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${session.access_token}` },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.detail?.message || 'Failed to delete request')
  }
}

export async function uploadFile(file: File): Promise<string> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) throw new Error('Not authenticated')

  const fileExt = file.name.split('.').pop()
  const fileName = `${crypto.randomUUID()}.${fileExt}`

  const { error } = await supabase.storage
    .from('approval-files')
    .upload(fileName, file, {
      upsert: false,
    })

  if (error) {
    throw new Error(error.message)
  }

  const { data: { publicUrl } } = supabase.storage
    .from('approval-files')
    .getPublicUrl(fileName)

  return publicUrl
}