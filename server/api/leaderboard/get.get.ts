// server/api/leaderboard/get.get.ts
import { getQuery, createError } from 'h3'
import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const gameSlug = String(q.gameSlug ?? '').trim()
  const limitRaw = Number(q.limit ?? 10)
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(Math.floor(limitRaw), 200)) : 10

  const client = await serverSupabaseClient(event)

  let query = (client.from('leaderboard_scores') as any)
      .select('id, game_slug, player_name, score, created_at')
      .order('score', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(limit)

  // ✅ Optional filter: when selected game is chosen
  if (gameSlug) query = query.eq('game_slug', gameSlug)

  const { data, error } = await query
  if (error) {
    console.error('[leaderboard/get] select error:', error)
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const items = (data ?? []).map((r: any) => ({
    id: r.id,
    gameSlug: r.game_slug,
    player: r.player_name,
    score: r.score,
    createdAt: r.created_at
  }))

  return { ok: true, items, gameSlug, limit }
})
