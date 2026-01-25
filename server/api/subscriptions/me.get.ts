// server/api/subscriptions/me.get.ts
import { serverSupabaseClient } from '#supabase/server'
import { createError } from 'h3'

export default defineEventHandler(async (event) => {
  // ✅ Prevent any caching (fixes "needs refresh" in many cases)
  event.node.res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  event.node.res.setHeader('Pragma', 'no-cache')
  event.node.res.setHeader('Expires', '0')

  const client = await serverSupabaseClient(event)

  const { data: auth, error: authErr } = await client.auth.getUser()
  const user = auth?.user
  if (authErr || !user?.id) {
    return { user: null, active: false, subscription: null }
  }

  const { data, error } = await client
    .from('subscriptions')
    .select(
      `
      id, status, starts_at, ends_at, amount_bdt, currency, provider, provider_ref,
      subscription_plans:plan_id ( code, title, duration_days, price_bdt )
      `
    )
    .eq('user_id', user.id)
    .order('ends_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  const now = Date.now()
  const active =
    !!data &&
    String(data.status) === 'active' &&
    new Date(String(data.starts_at)).getTime() <= now &&
    new Date(String(data.ends_at)).getTime() > now

  return { user: { id: user.id }, active, subscription: data || null }
})
