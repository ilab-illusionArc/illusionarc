// server/api/leaderboard/submit.post.ts
import { readBody, createError } from 'h3'
import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const client = await serverSupabaseClient(event)

  // ✅ Use getUser() (reliable in your setup)
  const { data, error: userErr } = await client.auth.getUser()
  const user = data?.user

  if (userErr) {
    // optional: log for debugging
    console.error('[leaderboard/submit] getUser error:', userErr)
  }

  if (!user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Login required' })
  }

  const body = await readBody(event)

  const gameSlug = String(body?.gameSlug ?? '').trim()
  const player = String(body?.player ?? 'Player').trim().slice(0, 32)
  const scoreRaw = Number(body?.score ?? 0)
  const score = Number.isFinite(scoreRaw) ? Math.max(0, Math.floor(scoreRaw)) : 0

  if (!gameSlug) throw createError({ statusCode: 400, statusMessage: 'Missing gameSlug' })

  const payload = {
    game_slug: gameSlug,
    user_id: user.id,
    player_name: player || 'Player',
    score
  }

  // ✅ Cast to any if your Supabase types aren't generated yet
  const { error } = await (client.from('leaderboard_scores') as any).insert(payload)

  if (error) {
    console.error('[leaderboard/submit] insert error:', error)
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return { ok: true }
})
