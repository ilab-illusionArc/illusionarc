import { createError } from 'h3'
import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  try {
    const q = getQuery(event)
    const gameSlug = String(q.gameSlug ?? '').trim()
    const limitRaw = Number(q.limit ?? 10)
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 50)) : 10

    const client = await serverSupabaseClient(event)

    // If you want "All Games" leaderboard:
    let query = client
      .from('leaderboard_scores')
      .select(`
        id,
        game_slug,
        score,
        created_at,
        profiles:profiles ( display_name, avatar_url )
      `)
      .order('score', { ascending: false })
      .limit(limit)

    if (gameSlug) query = query.eq('game_slug', gameSlug)

    const { data, error } = await query
    if (error) throw error

    const items = (data || []).map((r: any) => ({
      id: r.id,
      gameSlug: r.game_slug,
      score: r.score,
      createdAt: r.created_at,
      player: r.profiles?.display_name || 'Player',
      avatarUrl: r.profiles?.avatar_url || null
    }))

    return { ok: true, items, gameSlug, limit }
  } catch (e: any) {
    throw createError({ statusCode: 500, statusMessage: e?.message || 'Leaderboard unavailable' })
  }
})
