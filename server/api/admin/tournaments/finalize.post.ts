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

function cleanName(x: any) {
  const s = String(x || '').trim()
  return s || 'Player'
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const adminDb = await serverSupabaseServiceRole(event)

  const body = await readBody(event)
  const tournamentId = String(body?.tournamentId || '').trim()
  if (!tournamentId) throw createError({ statusCode: 400, statusMessage: 'Missing tournamentId' })

  const force = Boolean(body?.force ?? false)

  // Get tournament slug + ends_at (useful for sanity checks)
  const { data: t, error: tErr } = await adminDb
    .from('tournaments')
    .select('id, slug, ends_at, status')
    .eq('id', tournamentId)
    .maybeSingle()

  if (tErr) throw createError({ statusCode: 400, statusMessage: tErr.message })
  if (!t?.slug) throw createError({ statusCode: 404, statusMessage: 'Tournament not found' })

  const tournamentSlug = String((t as any).slug || '').trim()

  // Optional: prevent finalize before end time (you can comment out if you want)
  const endsAt = String((t as any).ends_at || '')
  const endsMs = endsAt ? new Date(endsAt).getTime() : 0
  if (endsMs && Date.now() < endsMs && !force) {
    throw createError({ statusCode: 400, statusMessage: 'Tournament has not ended yet' })
  }

  // Force clears existing winners
  if (force) {
    const { error: delErr } = await adminDb
      .from('tournament_winners')
      .delete()
      .eq('tournament_slug', tournamentSlug)
    if (delErr) throw createError({ statusCode: 400, statusMessage: delErr.message })
  }

  // If already finalized and not force -> stop
  const { data: existing, error: exErr } = await adminDb
    .from('tournament_winners')
    .select('id')
    .eq('tournament_slug', tournamentSlug)
    .limit(1)

  if (exErr) throw createError({ statusCode: 400, statusMessage: exErr.message })
  if ((existing || []).length && !force) {
    throw createError({ statusCode: 400, statusMessage: 'Already finalized. Use force=true to re-finalize.' })
  }

  // Get top rows from scores for this tournament_id
  const { data: top, error: topErr } = await adminDb
    .from('tournament_scores')
    .select('user_id, player_name, score, created_at')
    .eq('tournament_id', tournamentId)
    .order('score', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(200)

  if (topErr) throw createError({ statusCode: 400, statusMessage: topErr.message })

  // Best score per user (unique users)
  const seen = new Set<string>()
  const unique: any[] = []
  for (const r of top || []) {
    const uid = String((r as any).user_id || '').trim()
    if (!uid) continue
    if (seen.has(uid)) continue
    seen.add(uid)
    unique.push(r)
    if (unique.length >= 3) break
  }

  // Default prizes (change if you want)
  const prizes = [500, 300, 200]

  const rows = unique.map((r, idx) => ({
    tournament_slug: tournamentSlug,
    rank: idx + 1,
    user_id: (r as any).user_id,
    player_name: cleanName((r as any).player_name),
    score: Number((r as any).score || 0),
    prize_bdt: prizes[idx] ?? 0
  }))

  if (!rows.length) {
    // still mark finalized? up to you. I won't.
    return { ok: true, winners: [], message: 'No scores found; nothing to finalize.' }
  }

  const { data: inserted, error: insErr } = await adminDb
    .from('tournament_winners')
    .insert(rows)
    .select('id, tournament_slug, rank, user_id, player_name, score, prize_bdt, created_at')

  if (insErr) throw createError({ statusCode: 400, statusMessage: insErr.message })

  // mark tournament finalized
  const { error: updErr } = await adminDb
    .from('tournaments')
    .update({ finalized: true, updated_at: new Date().toISOString(), status: (t as any).status || 'ended' })
    .eq('id', tournamentId)

  if (updErr) throw createError({ statusCode: 400, statusMessage: updErr.message })

  return { ok: true, winners: inserted || [], tournament: { id: tournamentId, slug: tournamentSlug } }
})
