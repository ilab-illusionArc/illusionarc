import { createError, getQuery } from 'h3'
import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const gameSlug = String(q.gameSlug ?? '').trim()
  const limitRaw = Number(q.limit ?? 50)
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(Math.floor(limitRaw), 200)) : 50

  if (!gameSlug) {
    throw createError({ statusCode: 400, statusMessage: 'Missing gameSlug' })
  }

  const client = await serverSupabaseClient(event)

  // Supabase Nuxt types can be "never" sometimes → use any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyClient: any = client

  const { data, error } = await anyClient.rpc('get_game_winners', {
    p_game_slug: gameSlug,
    p_limit: limit
  })

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const items = (data || []).map((r: any) => ({
    userId: r.user_id,
    player: r.player_name || 'Player',
    bestScore: Number(r.best_score ?? 0),
    achievedAt: r.achieved_at
  }))

  return { ok: true, items, gameSlug, limit }
})
