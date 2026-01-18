import { readBody, createError } from 'h3'
import { createClient } from '@supabase/supabase-js'
import { serverSupabaseClient } from '#supabase/server'

type Body = { ids: string[] }

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  // 1) Use cookie-based session to identify user (works even when client user is null)
  const userClient = await serverSupabaseClient(event)
  const { data: userRes, error: userErr } = await userClient.auth.getUser()

  if (userErr || !userRes?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })
  }

  const user = userRes.user

  // 2) Check admin role (using normal auth client)
  const { data: profile, error: profErr } = await userClient
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (profErr) {
    throw createError({ statusCode: 500, statusMessage: profErr.message })
  }
  if (!profile || profile.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  // 3) Parse ids
  const body = await readBody<Body>(event)
  const ids = Array.isArray(body?.ids) ? body.ids.filter(Boolean) : []
  if (ids.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No ids provided' })
  }

  // 4) Service Role client bypasses RLS (guaranteed DB update)
  if (!config.public.supabaseUrl || !config.supabaseServiceRoleKey) {
    throw createError({ statusCode: 500, statusMessage: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' })
  }

  const adminDb = createClient(config.public.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { persistSession: false }
  })

  // 5) Update order (sequential, reliable)
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]
    const sort_order = (i + 1) * 10

    const { error } = await adminDb
      .from('services')
      .update({ sort_order, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      throw createError({ statusCode: 500, statusMessage: error.message })
    }
  }

  return { ok: true }
})
