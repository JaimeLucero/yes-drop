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
    // Verify this is a cron trigger (check for cron secret header)
    const cronSecret = Deno.env.get('CRON_SECRET')
    const authHeader = req.headers.get('Authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    }

    // Create Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Find scheduled requests that should be sent now
    const now = new Date().toISOString()
    const { data: requests, error } = await supabase
      .from('approval_requests')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_send_at', now)
      .order('scheduled_send_at', { ascending: true })

    if (error) {
      console.error('Error fetching scheduled requests:', error)
      throw error
    }

    if (!requests || requests.length === 0) {
      return new Response(JSON.stringify({ sent: 0, rescheduled: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Process each request
    let sentCount = 0
    let rescheduleCount = 0
    const errors: any[] = []

    for (const request of requests) {
      try {
        // Check daily limit for this user
        const { data: dailyCount, error: countError } = await supabase
          .rpc('get_daily_sent_count', { user_uuid: request.user_id })
        
        if (countError) {
          console.error('Error getting daily count:', countError)
          errors.push({ id: request.id, error: countError.message })
          continue
        }

        if (dailyCount >= 5) {
          // User has reached daily limit - auto-reschedule
          const { data: nextDate, error: nextDateError } = await supabase
            .rpc('get_next_available_day', { 
              user_uuid: request.user_id,
              start_date: new Date().toISOString().split('T')[0]
            })
          
          if (nextDateError) {
            console.error('Error getting next available day:', nextDateError)
            errors.push({ id: request.id, error: nextDateError.message })
            continue
          }

          if (nextDate) {
            // Parse original scheduled time to keep same time of day
            const originalScheduled = new Date(request.scheduled_send_at)
            const newScheduled = new Date(nextDate)
            newScheduled.setHours(
              originalScheduled.getUTCHours(),
              originalScheduled.getUTCMinutes(),
              originalScheduled.getUTCSeconds()
            )

            // Update the scheduled time
            const { error: updateError } = await supabase
              .from('approval_requests')
              .update({
                scheduled_send_at: newScheduled.toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', request.id)

            if (updateError) {
              console.error('Error rescheduling:', updateError)
              errors.push({ id: request.id, error: updateError.message })
              continue
            }

            rescheduleCount++
            console.log(`Rescheduled request ${request.id} to ${newScheduled.toISOString()}`)
            
            // Note: Email notification for reschedule will be sent by backend
          }
          continue
        }

        // Send email via backend API
        const backendUrl = Deno.env.get('BACKEND_URL')
        if (!backendUrl) {
          errors.push({ id: request.id, error: 'BACKEND_URL not configured' })
          continue
        }

        const response = await fetch(`${backendUrl}/api/internal/send-scheduled`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${cronSecret}`,
          },
          body: JSON.stringify({ request_id: request.id }),
        })

        if (response.ok) {
          sentCount++
          console.log(`Sent request ${request.id}`)
        } else {
          const errorText = await response.text()
          console.error(`Failed to send request ${request.id}:`, errorText)
          errors.push({ id: request.id, error: errorText })
        }
      } catch (err) {
        console.error(`Error processing request ${request.id}:`, err)
        errors.push({ id: request.id, error: err.message })
      }
    }

    return new Response(JSON.stringify({ 
      sent: sentCount, 
      rescheduled: rescheduleCount,
      errors 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in scheduled send:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
