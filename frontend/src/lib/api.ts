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
  status: 'draft' | 'scheduled' | 'pending' | 'approved' | 'rejected'
  scheduled_send_at: string | null
  sent_at: string | null
  created_at: string
  updated_at: string
}

export interface DailyLimit {
  used: number
  limit: number
  remaining: number
  resets_at: string
  next_available_date: string | null
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
  scheduledSendAt: string
): Promise<ApprovalRequest> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) throw new Error('Not authenticated')

  const response = await fetch(`${BACKEND_URL}/api/requests/${requestId}/schedule`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ scheduled_send_at: scheduledSendAt }),
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

  const { data, error } = await supabase.storage
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