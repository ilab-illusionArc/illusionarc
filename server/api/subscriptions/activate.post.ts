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

  // ✅ If your UI ever sends different codes, map them here.
  // Your DB uses: 1d / 7d / 30d (from your screenshot)
  const map: Record<string, string> = {
    '1d': '1d',
    '7d': '7d',
    '30d': '30d',
    'day': '1d',
    'week': '7d',
    'month': '30d'
  }
  planCode = map[planCode] || planCode

  // ✅ Run RPC
  const { data: rpcData, error: rpcErr } = await (client as any).rpc('activate_dummy_subscription', {
    p_plan_code: planCode
  })
  if (rpcErr) throw createError({ statusCode: 400, statusMessage: rpcErr.message })

  // ✅ Immediately re-read latest subscription (so UI updates instantly)
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

  return { ok: true, user: { id: user.id }, active, subscription: data || null, rpc: rpcData || null }
})
