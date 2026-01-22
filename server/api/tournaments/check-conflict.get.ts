import { serverSupabaseClient } from '#supabase/server'
import { createError, getQuery } from 'h3'

export default defineEventHandler(async (event) => {
  const client = await serverSupabaseClient(event)
  const q = getQuery(event)

  const gameSlug = String(q.gameSlug || '').trim()
  const startsAt = String(q.startsAt || '').trim()
  const endsAt = String(q.endsAt || '').trim()

  if (!gameSlug || !startsAt || !endsAt) {
    throw createError({ statusCode: 400, statusMessage: 'Missing gameSlug, startsAt, endsAt' })
  }

  const { data, error } = await client
    .from('tournaments')
    .select('slug, title, starts_at, ends_at, status')
    .eq('game_slug', gameSlug)
    .lt('starts_at', endsAt)  // overlap rule
    .gt('ends_at', startsAt)  // overlap rule

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  return {
    conflict: (data || []).length > 0,
    matches: data || []
  }
})
