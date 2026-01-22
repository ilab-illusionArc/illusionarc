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
  const planCode = String(body?.planCode || '').trim()

  if (!planCode) {
    throw createError({ statusCode: 400, statusMessage: 'Missing planCode' })
  }

  const { data, error } = await client.rpc('activate_dummy_subscription', {
    p_plan_code: planCode
  })

  if (error) {
    throw createError({ statusCode: 400, statusMessage: error.message })
  }

  return data
})
