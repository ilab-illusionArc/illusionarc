// server/api/tournaments/leaderboard.get.ts
import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, getQuery } from 'h3'

function computeEffectiveStatus(t: any, nowMs = Date.now()) {
  const db = String(t?.status || 'scheduled').toLowerCase()
  if (db === 'canceled') return 'canceled'

  const s = Date.parse(String(t?.starts_at || ''))
  const e = Date.parse(String(t?.ends_at || ''))

  const hasS = Number.isFinite(s)
  const hasE = Number.isFinite(e)

  if (hasE && nowMs >= e) return 'ended'
  if (hasS && nowMs >= s && (!hasE || nowMs < e)) return 'live'
  return 'scheduled'
}

export default defineEventHandler(async (event) => {
  // Use anon/session client for public reads (but will still work for logged-in users)
  const supabase = await serverSupabaseClient(event)
  // Use service role to avoid any RLS surprises when reading tournaments/scores
  const adminDb = await serverSupabaseServiceRole(event)

  const q = getQuery(event)
  const slug = String(q.slug || '').trim()
  const limit = Math.min(Math.max(Number(q.limit || 50), 1), 200)

  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'Missing slug' })
  }

  // 1) Resolve tournament by slug
  // Prefer service role for stability (RLS-safe), but fall back to session client if needed.
  let t: any = null
  {
    const { data, error } = await adminDb
      .from('tournaments')
      .select('id, slug, status, starts_at, ends_at, game_slug, title, finalized')
      .eq('slug', slug)
      .maybeSingle()

    if (error) {
      // fallback to regular client (in case service role env missing)
      const fb = await supabase
        .from('tournaments')
        .select('id, slug, status, starts_at, ends_at, game_slug, title, finalized')
        .eq('slug', slug)
        .maybeSingle()

      if (fb.error) throw createError({ statusCode: 500, statusMessage: fb.error.message })
      t = fb.data
    } else {
      t = data
    }
  }

  if (!t?.id) return { tournament: null, rows: [] }

  const effective_status = computeEffectiveStatus(t)

  // 2) Fetch leaderboard rows (tournament-only scores)
  // Again: service role first (RLS-safe), fallback to session client.
  let rows: any[] = []
  {
    const { data, error } = await adminDb
      .from('tournament_scores')
      .select('player_name, score, created_at')
      .eq('tournament_id', t.id)
      .order('score', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(limit)

    if (error) {
      const fb = await supabase
        .from('tournament_scores')
        .select('player_name, score, created_at')
        .eq('tournament_id', t.id)
        .order('score', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(limit)

      if (fb.error) throw createError({ statusCode: 500, statusMessage: fb.error.message })
      rows = fb.data || []
    } else {
      rows = data || []
    }
  }

  return {
    tournament: {
      id: t.id,
      slug: t.slug,
      title: t.title,
      game_slug: t.game_slug,
      starts_at: t.starts_at,
      ends_at: t.ends_at,
      status: t.status, // DB status (may be stale)
      effective_status, // ✅ always correct based on time window
      finalized: Boolean(t.finalized)
    },
    rows
  }
})
