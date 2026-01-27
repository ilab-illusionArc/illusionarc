import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ phone?: string }>(event)
  const phone = String(body?.phone || '').trim()

  if (!phone.startsWith('+') || phone.length < 4) {
    return { available: false }
  }

  const config = useRuntimeConfig()

  // ✅ Put these in .env:
  // SUPABASE_URL=
  // SUPABASE_SERVICE_ROLE_KEY=
  const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey)

  const { data, error } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('phone', phone)
    .limit(1)

  if (error) {
    // fail open (don’t block), DB unique constraint will still protect
    return { available: true }
  }

  return { available: !(Array.isArray(data) && data.length > 0) }
})
