// server/api/subscriptions/activate.post.ts
import { serverSupabaseClient } from '#supabase/server'
import { createError, readBody } from 'h3'

export default defineEventHandler(async (event) => {
  const client = await serverSupabaseClient(event)

  const { data: auth, error: authErr } = await client.auth.getUser()
  const user = auth?.user
  if (authErr || !user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Login required' })
  }

  const body = await readBody(event)
  let planCode = String(body?.planCode || '').trim()
  if (!planCode) throw createError({ statusCode: 400, statusMessage: 'Missing planCode' })

  // ✅ Optional: map UI codes -> DB codes (keep if your DB uses day/week/month)
  const map: Record<string, string> = {
    '1d': 'day',
    '7d': 'week',
    '30d': 'month'
  }
  planCode = map[planCode] || planCode

  const { error: rpcErr } = await (client as any).rpc('activate_dummy_subscription', {
    p_plan_code: planCode
  })
  if (rpcErr) throw createError({ statusCode: 400, statusMessage: rpcErr.message })

  // ✅ Immediately re-read latest subscription (same logic as me.get.ts)
  const { data, error } = await client
      .from('subscriptions')
      .select(
          `
      id, status, starts_at, ends_at, amount_bdt, currency, provider,
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
      data.status === 'active' &&
      new Date(data.starts_at).getTime() <= now &&
      new Date(data.ends_at).getTime() > now

  return { ok: true, user: { id: user.id }, active, subscription: data || null }
})
