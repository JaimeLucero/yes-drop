import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify this is a cron trigger
    const cronSecret = Deno.env.get('CRON_SECRET')
    const authHeader = req.headers.get('Authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    }

    // Create Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('[UTC] Starting deadline and follow-up check...')

    // 1. Mark requests past deadline as ignored
    const { data: pastDeadline, error: pastDeadlineError } = await supabase
      .rpc('get_requests_past_deadline')
    
    if (pastDeadlineError) {
      console.error('Error getting past deadline requests:', pastDeadlineError)
      throw pastDeadlineError
    }

    let ignoredCount = 0
    for (const request of pastDeadline || []) {
      const { error } = await supabase
        .from('approval_requests')
        .update({
          status: 'ignored',
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.id)
      
      if (error) {
        console.error(`Error marking request ${request.id} as ignored:`, error)
        continue
      }

      ignoredCount++
      console.log(`[UTC] Marked request ${request.id} as ignored (deadline: ${request.deadline})`)
      
      // Notify requester (via backend)
      const backendUrl = Deno.env.get('BACKEND_URL')
      if (backendUrl && request.requester_email) {
        try {
          await fetch(`${backendUrl}/api/internal/notify-ignored`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${cronSecret}`,
            },
            body: JSON.stringify({
              request_id: request.id,
              requester_email: request.requester_email,
              request_title: request.title,
              deadline: request.deadline,
            }),
          })
        } catch (err) {
          console.error(`Failed to send ignored notification for ${request.id}:`, err)
        }
      }
    }

    // 2. Send before-deadline follow-ups
    const { data: beforeDeadlineFollowups, error: beforeError } = await supabase
      .rpc('get_requests_due_for_followup_before_deadline')
    
    if (beforeError) {
      console.error('Error getting before-deadline followups:', beforeError)
    }

    let beforeCount = 0
    for (const request of beforeDeadlineFollowups || []) {
      const backendUrl = Deno.env.get('BACKEND_URL')
      if (!backendUrl) {
        console.error('BACKEND_URL not configured')
        continue
      }

      const response = await fetch(`${backendUrl}/api/internal/send-followup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cronSecret}`,
        },
        body: JSON.stringify({
          request_id: request.id,
          followup_type: 'before_deadline',
          days_before: request.days_before,
        }),
      })

      if (response.ok) {
        beforeCount++
        console.log(`[UTC] Sent before-deadline follow-up for request ${request.id}`)
      } else {
        console.error(`Failed to send before-deadline follow-up for ${request.id}`)
      }
    }

    // 3. Send after-sending follow-ups
    const { data: afterSendingFollowups, error: afterError } = await supabase
      .rpc('get_requests_due_for_followup_after_sending')
    
    if (afterError) {
      console.error('Error getting after-sending followups:', afterError)
    }

    let afterCount = 0
    for (const request of afterSendingFollowups || []) {
      const backendUrl = Deno.env.get('BACKEND_URL')
      if (!backendUrl) {
        console.error('BACKEND_URL not configured')
        continue
      }

      const response = await fetch(`${backendUrl}/api/internal/send-followup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cronSecret}`,
        },
        body: JSON.stringify({
          request_id: request.id,
          followup_type: 'after_sending',
          days_after: request.days_after,
        }),
      })

      if (response.ok) {
        afterCount++
        console.log(`[UTC] Sent after-sending follow-up for request ${request.id}`)
      } else {
        console.error(`Failed to send after-sending follow-up for ${request.id}`)
      }
    }

    return new Response(JSON.stringify({ 
      ignored: ignoredCount,
      followups_before: beforeCount,
      followups_after: afterCount,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[UTC] Error in deadline/follow-up check:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
