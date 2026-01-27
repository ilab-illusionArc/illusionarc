// server/api/auth/me.get.ts
import { serverSupabaseClient, serverSupabaseUser, serverSupabaseSession } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const client = await serverSupabaseClient(event)

  // ✅ user from SSR cookies (typed)
  const sessionUser = await serverSupabaseUser(event)

  // (optional) session info if you need it, but it won't have `.user`
  const session = await serverSupabaseSession(event)

  // also try via auth.getUser (direct)
  const { data, error } = await client.auth.getUser()

  return {
    session: session ? { expires_at: session.expires_at } : null,
    sessionUser: sessionUser ? { id: sessionUser.id, email: sessionUser.email } : null,
    getUser: data?.user ? { id: data.user.id, email: data.user.email } : null,
    getUserError: error?.message ?? null
  }
})
