import { serverSupabaseClient } from '#supabase/server'

type Role = 'admin' | 'user'
type RoleResponse = { role: Role | null; found: boolean }

// ✅ Explicit profile shape
type ProfileRoleRow = { role: Role | null }

export default defineEventHandler(async (event): Promise<RoleResponse> => {
  const supabase = await serverSupabaseClient(event)

  const { data: auth, error: userErr } = await supabase.auth.getUser()
  if (userErr) console.warn('[role] getUser error:', userErr.message)

  const uid = auth?.user?.id
  if (!uid) return { role: null, found: false }

  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', uid)
    .maybeSingle()

  if (error) {
    console.warn('[role] profiles query error:', error.message)
    return { role: 'user', found: false }
  }

  // ✅ Force a safe, explicit type here (avoids "never")
  const profile = data as unknown as ProfileRoleRow | null

  if (!profile) return { role: 'user', found: false }

  return { role: profile.role === 'admin' ? 'admin' : 'user', found: true }
})
