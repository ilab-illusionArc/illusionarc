// server/api/admin/tournaments/finalize.post.ts
import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, readBody } from 'h3'

async function requireAdmin(event: any) {
  const client = await serverSupabaseClient(event)

  const { data: auth, error: authErr } = await client.auth.getUser()
  const user = auth?.user
  if (authErr || !user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Login required' })
  }

  // ✅ profiles table uses user_id, not id
  const { data: prof, error: profErr } = await client
    .from('profiles')
    .select('user_id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profErr) {
    throw createError({ statusCode: 500, statusMessage: profErr.message })
  }

  if (String((prof as any)?.role || '') !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Admin only' })
  }
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  // service role for write operations (bypass RLS)
  const adminDb = await serverSupabaseServiceRole(event)

  const body = await readBody(event)
  const tournamentId = String(body?.tournamentId || '').trim()
  if (!tournamentId) throw createError({ statusCode: 400, statusMessage: 'Missing tournamentId' })

  // Optional: clear existing winners if force=true
  const force = Boolean(body?.force ?? false)
  if (force) {
    const { error: delErr } = await adminDb.from('tournament_winners').delete().eq('tournament_id', tournamentId)
    if (delErr) throw createError({ statusCode: 400, statusMessage: delErr.message })
  }

  // If already has winners and not force -> stop
  const { data: existing, error: exErr } = await adminDb
    .from('tournament_winners')
    .select('id')
    .eq('tournament_id', tournamentId)
    .limit(1)

  if (exErr) throw createError({ statusCode: 400, statusMessage: exErr.message })
  if ((existing || []).length && !force) {
    throw createError({ statusCode: 400, statusMessage: 'Already finalized. Use force=true to re-finalize.' })
  }

  // get top scores rows; then keep best per user (top 3 unique)
  const { data: top, error: topErr } = await adminDb
    .from('tournament_scores')
    .select('user_id, player_name, score, created_at')
    .eq('tournament_id', tournamentId)
    .order('score', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(50)

  if (topErr) throw createError({ statusCode: 400, statusMessage: topErr.message })

  const seen = new Set<string>()
  const unique: any[] = []
  for (const r of top || []) {
    const uid = String((r as any).user_id || '')
    if (!uid) continue
    if (seen.has(uid)) continue
    seen.add(uid)
    unique.push(r)
    if (unique.length >= 3) break
  }

  const prizes = [500, 300, 200] // default BDT prizes

  const rows = unique.map((r, idx) => ({
    tournament_id: tournamentId,
    rank: idx + 1,
    user_id: (r as any).user_id,
    player_name: (r as any).player_name,
    score: (r as any).score,
    prize_bdt: prizes[idx] ?? 0
  }))

  if (!rows.length) {
    return { ok: true, winners: [], message: 'No scores found; nothing to finalize.' }
  }

  const { data: inserted, error: insErr } = await adminDb
    .from('tournament_winners')
    .insert(rows)
    .select('*')

  if (insErr) throw createError({ statusCode: 400, statusMessage: insErr.message })

  // mark finalized
  const { error: updErr } = await adminDb
    .from('tournaments')
    .update({ finalized: true, updated_at: new Date().toISOString() })
    .eq('id', tournamentId)

  if (updErr) throw createError({ statusCode: 400, statusMessage: updErr.message })

  return { ok: true, winners: inserted || [] }
})
