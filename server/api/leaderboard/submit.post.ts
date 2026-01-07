// server/api/leaderboard/submit.post.ts
import { readBody, createError } from 'h3'
import { serverSupabaseClient } from '#supabase/server'

function resolveDisplayName(user: any) {
  const md = user?.user_metadata || {}
  const fromMeta =
      md.display_name ||
      md.full_name ||
      md.name ||
      md.user_name ||
      ''

  const fromEmail = user?.email?.split?.('@')?.[0] || ''
  const name = String(fromMeta || fromEmail || 'Player').trim()
  return name.slice(0, 32)
}

export default defineEventHandler(async (event) => {
  const client = await serverSupabaseClient(event)

  // ✅ use cookies session on server
  const { data: auth, error: authErr } = await client.auth.getUser()
  const user = auth?.user

  if (authErr || !user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Login required' })
  }

  const body = await readBody(event)

  const gameSlug = String(body?.gameSlug ?? '').trim()
  const scoreRaw = Number(body?.score ?? 0)
  const score = Number.isFinite(scoreRaw) ? Math.max(0, Math.floor(scoreRaw)) : 0

  if (!gameSlug) throw createError({ statusCode: 400, statusMessage: 'Missing gameSlug' })

  const playerName = resolveDisplayName(user)

  const payload = {
    game_slug: gameSlug,
    user_id: user.id,
    player_name: playerName,
    score
  }

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error (supabase types in Nuxt sometimes infer never)
  const { error } = await client.from('leaderboard_scores').insert(payload)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return { ok: true, playerName }
})
