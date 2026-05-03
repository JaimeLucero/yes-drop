import { createClient } from '@/lib/supabase'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL!

export interface ApprovalRequest {
  id: string
  user_id: string
  approver_email: string
  title: string
  message: string | null
  file_url: string | null
  token: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  updated_at: string
}

export async function fetchRequests(): Promise<ApprovalRequest[]> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    throw new Error('Not authenticated')
  }

  const response = await fetch(`${BACKEND_URL}/api/requests`, {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  })

  if (!response.ok) {
    throw new Error('Failed to fetch requests')
  }

  return response.json()
}

export async function createRequest(data: {
  approver_email: string
  title: string
  message?: string
  file_url?: string
}): Promise<ApprovalRequest> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    throw new Error('Not authenticated')
  }

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
    throw new Error(error.detail || 'Failed to create request')
  }

  return response.json()
}

export async function uploadFile(file: File): Promise<string> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    throw new Error('Not authenticated')
  }

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