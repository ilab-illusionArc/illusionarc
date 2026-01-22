// server/api/admin/tournaments/winners.update.post.ts
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
  if (String((prof as any)?.role || '').toLowerCase() !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Admin only' })
  }
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const adminDb = await serverSupabaseServiceRole(event)
  const body = await readBody(event)

  const id = String(body?.id || '').trim()
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing winner row id' })

  // these columns MUST exist in tournament_winners:
  // player_name, score, prize_bdt, rank (rank optional to update)
  const patch: any = {}

  if (body.player_name != null) patch.player_name = String(body.player_name || '').trim() || null

  if (body.score != null) {
    const n = Number(body.score)
    patch.score = Number.isFinite(n) ? n : 0
  }

  if (body.prize_bdt != null) {
    const n = Number(body.prize_bdt)
    patch.prize_bdt = Number.isFinite(n) ? n : 0
  }

  // optional rank update if you want it editable
  if (body.rank != null) {
    const n = Number(body.rank)
    patch.rank = Number.isFinite(n) ? Math.max(1, Math.floor(n)) : 1
  }

  const { data, error } = await adminDb
    .from('tournament_winners')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  return { ok: true, row: data }
})
