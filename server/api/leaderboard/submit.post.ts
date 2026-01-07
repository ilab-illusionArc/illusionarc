// server/api/leaderboard/submit.post.ts
import { readBody, createError } from 'h3'
import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  try {
    // ✅ require logged-in user
    const user = await serverSupabaseUser(event)
    if (!user) {
      throw createError({ statusCode: 401, statusMessage: 'Login required' })
    }

    const body = await readBody(event)

    const gameSlug = String(body?.gameSlug ?? '').trim()
    const player = String(body?.player ?? 'Player').trim().slice(0, 32)
    const scoreRaw = Number(body?.score ?? 0)
    const score = Number.isFinite(scoreRaw) ? Math.max(0, Math.floor(scoreRaw)) : 0

    if (!gameSlug) {
      throw createError({ statusCode: 400, statusMessage: 'Missing gameSlug' })
    }

    const supabase = await serverSupabaseClient(event)

    const { error } = await supabase.from('leaderboard_scores').insert({
      game_slug: gameSlug,
      user_id: user.id,
      player_name: player,
      score
    } as any)

    if (error) {
      console.error('[leaderboard submit] supabase error:', error)
      throw createError({ statusCode: 500, statusMessage: error.message })
    }

    return { ok: true }
  } catch (e: any) {
    // Keep response shape consistent with your old code
    const msg = e?.statusMessage || e?.message || 'Failed to submit score'
    return { ok: false, error: msg }
  }
})
