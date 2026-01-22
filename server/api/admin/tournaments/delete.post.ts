// server/api/admin/tournaments/delete.post.ts
import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, readBody } from 'h3'

async function requireAdmin(event: any) {
  const client = await serverSupabaseClient(event)

  const { data: auth, error: authErr } = await client.auth.getUser()
  const user = auth?.user
  if (authErr || !user?.id) throw createError({ statusCode: 401, statusMessage: 'Login required' })

  // ✅ profiles uses user_id (not id)
  const { data: prof, error: profErr } = await client
    .from('profiles')
    .select('user_id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profErr) throw createError({ statusCode: 500, statusMessage: profErr.message })
  if (String((prof as any)?.role || '') !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Admin only' })
  }
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const adminDb = await serverSupabaseServiceRole(event)
  const body = await readBody(event)

  const id = String(body?.id || '').trim()
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  // Optional safety: block delete if winners exist
  const { data: w, error: wErr } = await adminDb
    .from('tournament_winners')
    .select('id')
    .eq('tournament_id', id)
    .limit(1)

  if (wErr) throw createError({ statusCode: 400, statusMessage: wErr.message })
  if ((w || []).length) {
    throw createError({ statusCode: 400, statusMessage: 'Cannot delete: winners exist (finalized)' })
  }

  const { error } = await adminDb.from('tournaments').delete().eq('id', id)
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })

  return { ok: true }
})
