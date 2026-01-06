import { readBody, createError } from 'h3'
import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const name = String(body?.name || '').trim()
  const email = String(body?.email || '').trim()
  const projectType = String(body?.projectType || '').trim()
  const budget = String(body?.budget || '').trim()
  const message = String(body?.message || '').trim()
  const website = String(body?.website || '').trim() // honeypot

  // Honeypot: treat as spam (do NOT store)
  if (website) {
    throw createError({ statusCode: 400, statusMessage: 'Spam detected' })
  }

  if (!name) throw createError({ statusCode: 400, statusMessage: 'Name is required' })
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw createError({ statusCode: 400, statusMessage: 'Valid email is required' })
  if (!message || message.length < 10)
    throw createError({ statusCode: 400, statusMessage: 'Message must be at least 10 characters' })

  const config = useRuntimeConfig()
  const url = config.public.supabaseUrl
  const serviceKey = config.supabaseServiceRoleKey

  // ✅ NO fake success: must be configured
  if (!url || !serviceKey) {
    throw createError({ statusCode: 500, statusMessage: 'Supabase server keys are not configured' })
  }

  // Service role (server only)
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false }
  })

  const { data, error } = await supabase
    .from('contact_requests')
    .insert([
      {
        name,
        email,
        project_type: projectType || null,
        budget: budget || null,
        message
      }
    ])
    .select('id')
    .single()

  if (error) {
    // ✅ Fail loudly
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return { ok: true, id: data.id }
})
