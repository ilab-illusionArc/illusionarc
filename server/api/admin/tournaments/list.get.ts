// server/api/admin/tournaments/list.get.ts
import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const supabase = await serverSupabaseClient(event)

  const query = getQuery(event)

  const q = String(query.q || '').trim()

  // Support both styles:
  // - old: status=all
  // - new: status='' (means all)
  const statusRaw = String(query.status ?? '').trim()
  const status = statusRaw && statusRaw !== 'all' ? statusRaw : ''

  // Support both styles:
  // - old: game
  // - new: gameSlug
  const gameRaw = String((query.gameSlug ?? query.game) ?? '').trim()
  const game = gameRaw && gameRaw !== 'all' ? gameRaw : ''

  let db = supabase
    .from('tournaments')
    .select('*')
    .order('starts_at', { ascending: false })

  if (q) {
    // title/slug search
    db = db.or(`title.ilike.%${q}%,slug.ilike.%${q}%`)
  }

  if (status) {
    db = db.eq('status', status)
  }

  if (game) {
    db = db.eq('game_slug', game)
  }

  const { data, error } = await db
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  return { rows: data || [] }
})
