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

    // 2. Send any reminders that are now due. One backend call per reminder;
    //    the backend marks each reminder 'sent' (dedup) and renders the correct
    //    subject/banner from the live time window.
    const { data: dueReminders, error: remindersError } = await supabase
      .rpc('get_due_reminders')

    if (remindersError) {
      console.error('Error getting due reminders:', remindersError)
    }

    const backendUrl = Deno.env.get('BACKEND_URL')
    let reminderCount = 0
    for (const reminder of dueReminders || []) {
      if (!backendUrl) {
        console.error('BACKEND_URL not configured')
        break
      }

      const response = await fetch(`${backendUrl}/api/internal/send-followup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cronSecret}`,
        },
        body: JSON.stringify({ reminder_id: reminder.reminder_id }),
      })

      if (response.ok) {
        reminderCount++
        console.log(`[UTC] Sent ${reminder.kind} reminder ${reminder.reminder_id}`)
      } else {
        console.error(`Failed to send reminder ${reminder.reminder_id}`)
      }
    }

    return new Response(JSON.stringify({
      ignored: ignoredCount,
      reminders_sent: reminderCount,
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
