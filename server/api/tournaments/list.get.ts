import { serverSupabaseClient } from '#supabase/server'
export default defineEventHandler(async (event) => {
  const supabase = await serverSupabaseClient(event)

  const { data, error } = await supabase
    .from('tournaments')
    .select('id, slug, title, game_slug, starts_at, ends_at, status, prize, description')
    .order('starts_at', { ascending: true })

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return { tournaments: data ?? [] }
})
