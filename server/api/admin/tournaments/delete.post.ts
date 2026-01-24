// server/api/admin/tournaments/delete.post.ts
import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, readBody } from 'h3'

async function requireAdmin(event: any) {
  const client = await serverSupabaseClient(event)

  const { data: auth, error: authErr } = await client.auth.getUser()
  const user = auth?.user
  if (authErr || !user?.id) throw createError({ statusCode: 401, statusMessage: 'Login required' })

  const { data: prof, error: profErr } = await client
      .from('profiles')
      .select('user_id, role')
      .eq('user_id', user.id)
      .maybeSingle()

  if (profErr) throw createError({ statusCode: 500, statusMessage: profErr.message })
  if (String((prof as any)?.role || '').toLowerCase() !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Admin only' })
  }
}

async function hasColumn(adminDb: any, table: string, column: string) {
  const { data, error } = await adminDb
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_schema', 'public')
      .eq('table_name', table)
      .eq('column_name', column)
      .limit(1)

  if (error) return false
  return (data || []).length > 0
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const adminDb = await serverSupabaseServiceRole(event)
  const body = await readBody(event)

  const id = String(body?.id || '').trim()
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  // fetch tournament row to get slug for fallback deletes
  const { data: t, error: tErr } = await adminDb
      .from('tournaments')
      .select('id, slug')
      .eq('id', id)
      .maybeSingle()

  if (tErr) throw createError({ statusCode: 400, statusMessage: tErr.message })
  if (!t) throw createError({ statusCode: 404, statusMessage: 'Tournament not found' })

  const tournamentSlug = String((t as any).slug || '').trim()

  // Determine how winners link to tournament
  const winnersHasTid = await hasColumn(adminDb, 'tournament_winners', 'tournament_id')
  const winnersHasSlug = await hasColumn(adminDb, 'tournament_winners', 'tournament_slug')

  // Optional safety: block delete if winners exist
  if (winnersHasTid) {
    const { data: w, error: wErr } = await adminDb
        .from('tournament_winners')
        .select('id')
        .eq('tournament_id', id)
        .limit(1)
    if (wErr) throw createError({ statusCode: 400, statusMessage: wErr.message })
    if ((w || []).length) throw createError({ statusCode: 400, statusMessage: 'Cannot delete: winners exist (finalized)' })
  } else if (winnersHasSlug) {
    const { data: w, error: wErr } = await adminDb
        .from('tournament_winners')
        .select('id')
        .eq('tournament_slug', tournamentSlug)
        .limit(1)
    if (wErr) throw createError({ statusCode: 400, statusMessage: wErr.message })
    if ((w || []).length) throw createError({ statusCode: 400, statusMessage: 'Cannot delete: winners exist (finalized)' })
  }

  // Delete tournament (and rely on FK cascade if you have it)
  const { error } = await adminDb.from('tournaments').delete().eq('id', id)
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })

  return { ok: true }
})
