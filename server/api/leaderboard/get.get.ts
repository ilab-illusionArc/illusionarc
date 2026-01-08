import { createError, getQuery } from 'h3'
import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  try {
    const q = getQuery(event)

    const gameSlug = String(q.gameSlug ?? '').trim()
    const period = String(q.period ?? 'daily').toLowerCase() === 'weekly' ? 'weekly' : 'daily'

    const limitRaw = Number(q.limit ?? 50)
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(Math.floor(limitRaw), 200)) : 50

    if (!gameSlug) throw createError({ statusCode: 400, statusMessage: 'Missing gameSlug' })

    const client = await serverSupabaseClient(event)

    // ✅ RPC (best-per-user within period)
    // Nuxt/Supabase types often infer rpc args as undefined/never, so cast to any.
    const { data, error } = await (client as any).rpc('leaderboard_best_period', {
      p_game_slug: gameSlug,
      p_period: period,
      p_limit: limit
    })

    if (error) throw error

    const items = (Array.isArray(data) ? data : []).map((r: any) => ({
      id: r.id,
      gameSlug: r.game_slug,
      score: r.score,
      createdAt: r.created_at,
      player: r.player_name || 'Player'
    }))

    return { ok: true, items, gameSlug, period, limit }
  } catch (e: any) {
    throw createError({ statusCode: 500, statusMessage: e?.message || 'Leaderboard unavailable' })
  }
})
