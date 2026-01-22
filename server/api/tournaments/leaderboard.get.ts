import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const supabase = await serverSupabaseClient(event)
  const q = getQuery(event)

  const slug = String(q.slug || '').trim()
  const limit = Math.min(Math.max(Number(q.limit || 50), 1), 200)

  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'Missing slug' })
  }

  // 1) Resolve tournament id by slug
  const { data: t, error: tErr } = await supabase
    .from('tournaments')
    .select('id, slug, status, starts_at, ends_at, game_slug, title')
    .eq('slug', slug)
    .maybeSingle()

  if (tErr) throw createError({ statusCode: 500, statusMessage: tErr.message })
  if (!t) return { tournament: null, rows: [] }

  // 2) Fetch leaderboard rows
  const { data: rows, error: sErr } = await supabase
    .from('tournament_scores')
    .select('player_name, score, created_at')
    .eq('tournament_id', t.id)
    .order('score', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(limit)

  if (sErr) throw createError({ statusCode: 500, statusMessage: sErr.message })

  return { tournament: t, rows: rows ?? [] }
})
