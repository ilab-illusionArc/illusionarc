// server/api/leaderboard/submit.post.ts
import { readBody, createError } from 'h3'
import { serverSupabaseClient } from '#supabase/server'

type ProfileRow = { display_name: string | null }

export default defineEventHandler(async (event) => {
  const client = await serverSupabaseClient(event)

  // ✅ cookie session on server
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

  // ✅ Get display_name from profiles (source of truth)
  const { data, error: pErr } = await client
    .from('profiles')
    .select('display_name')
    .eq('user_id', user.id)
    .single()

  if (pErr) {
    throw createError({ statusCode: 500, statusMessage: pErr.message })
  }

  // ✅ Fix "never": cast the row
  const profile = data as unknown as ProfileRow | null

  const displayName = String(profile?.display_name ?? '').trim()
  if (!displayName) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Profile missing display_name. Ensure profile row is created for this user.'
    })
  }

  const payload = {
    game_slug: gameSlug,
    user_id: user.id,
    player_name: displayName,
    score
  }

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error Nuxt/Supabase types may infer never
  const { error } = await client.from('leaderboard_scores').insert(payload)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return { ok: true, playerName: displayName }
})
