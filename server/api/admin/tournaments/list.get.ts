// server/api/admin/tournaments/list.get.ts
import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const supabase = await serverSupabaseClient(event)

  const query = getQuery(event)
  const q = String(query.q || '').trim()
  const status = String(query.status || 'all')
  const game = String(query.game || 'all')

  let db = supabase
    .from('tournaments')
    .select('*')
    .order('starts_at', { ascending: false })

  if (q) {
    db = db.or(`title.ilike.%${q}%,slug.ilike.%${q}%`)
  }

  if (status !== 'all') {
    db = db.eq('status', status)
  }

  if (game !== 'all') {
    db = db.eq('game_slug', game)
  }

  const { data, error } = await db
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  return { rows: data || [] }
})
