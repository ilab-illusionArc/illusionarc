import { serverSupabaseClient } from '#supabase/server'
export default defineEventHandler(async (event) => {
  const supabase = await serverSupabaseClient(event)
  const query = getQuery(event)
  const slug = String(query.slug || '').trim()

  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'Missing slug' })
  }

  const { data, error } = await supabase
    .from('tournaments')
    .select('id, slug, title, game_slug, starts_at, ends_at, status, prize, description')
    .eq('slug', slug)
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return { tournament: data || null }
})
