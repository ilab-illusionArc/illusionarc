import { serverSupabaseClient } from '#supabase/server'
import { createError, getQuery } from 'h3'

export default defineEventHandler(async (event) => {
  const client = await serverSupabaseClient(event)
  const q = getQuery(event)

  const slug = String(q.slug || '').trim()
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Missing slug' })

  const { data, error } = await client
    .from('tournament_winners')
    .select('rank, player_name, score, user_id, created_at')
    .eq('tournament_slug', slug)
    .order('rank', { ascending: true })

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  return { slug, winners: data || [] }
})
