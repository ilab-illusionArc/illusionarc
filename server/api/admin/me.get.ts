import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const supabase = await serverSupabaseClient(event)
  const user = await serverSupabaseUser(event)

  if (!user) return { isAdmin: false }

  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error || !data) return { isAdmin: false }

  // ✅ cast for TS (until you generate full Database types)
  const role = (data as { role?: string }).role
  return { isAdmin: role === 'admin' }
})
