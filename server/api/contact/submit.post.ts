import { createClient } from '@supabase/supabase-js'
import { readBody, createError, getRequestIP, getHeader } from 'h3'
import { serverSupabaseClient } from '#supabase/server'

function isEmailValid(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim())
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  const url = process.env.SUPABASE_URL
  const serviceKey = config.supabaseServiceRoleKey

  if (!url || !serviceKey) {
    throw createError({ statusCode: 500, statusMessage: 'Server misconfigured (missing Supabase keys).' })
  }

  const body = await readBody(event)

  const website = String(body?.website ?? '').trim()
  if (website) {
    // honeypot hit: pretend ok, but don't store
    return { ok: true }
  }

  const name = String(body?.name ?? '').trim().slice(0, 80)
  const email = String(body?.email ?? '').trim().slice(0, 120)
  const projectType = String(body?.projectType ?? '').trim().slice(0, 40)
  const budget = String(body?.budget ?? '').trim().slice(0, 40)
  const message = String(body?.message ?? '').trim().slice(0, 5000)

  if (!name) throw createError({ statusCode: 400, statusMessage: 'Missing name' })
  if (!email || !isEmailValid(email)) throw createError({ statusCode: 400, statusMessage: 'Invalid email' })
  if (!message || message.length < 10) throw createError({ statusCode: 400, statusMessage: 'Message too short' })
  if (!projectType) throw createError({ statusCode: 400, statusMessage: 'Missing project type' })
  if (!budget) throw createError({ statusCode: 400, statusMessage: 'Missing budget' })

  // If user is logged in, attach user_id (optional)
  let userId: string | null = null
  try {
    const cookieClient = await serverSupabaseClient(event)
    const { data } = await cookieClient.auth.getUser()
    userId = data?.user?.id ?? null
  } catch {
    userId = null
  }

  const ip = getRequestIP(event) || null
  const userAgent = getHeader(event, 'user-agent') || null

  // Service role client (bypasses RLS)
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  })

  const { error } = await admin.from('contact_messages').insert({
    user_id: userId,
    name,
    email,
    project_type: projectType,
    budget,
    message,
    ip,
    user_agent: userAgent
  })

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  return { ok: true }
})
