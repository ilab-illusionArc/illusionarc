// server/api/admin/tournaments/list.get.ts
import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, getQuery } from 'h3'

async function requireAdmin(event: any) {
  const client = await serverSupabaseClient(event)
  const { data: auth, error: authErr } = await client.auth.getUser()
  const user = auth?.user
  if (authErr || !user?.id) throw createError({ statusCode: 401, statusMessage: 'Login required' })

  const { data: prof, error: profErr } = await client
    .from('profiles')
    .select('user_id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profErr) throw createError({ statusCode: 500, statusMessage: profErr.message })
  if (String((prof as any)?.role || '').toLowerCase() !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Admin only' })
  }
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  // ✅ use service role so admin list never fails due to RLS
  const adminDb = await serverSupabaseServiceRole(event)

  const query = getQuery(event)

  const q = String(query.q || '').trim()

  // Support both:
  // - old: status=all
  // - new: status='' (means all)
  const statusRaw = String(query.status ?? '').trim()
  const status = statusRaw && statusRaw !== 'all' ? statusRaw : ''

  // Support both:
  // - old: game
  // - new: gameSlug
  const gameRaw = String((query.gameSlug ?? query.game) ?? '').trim()
  const game = gameRaw && gameRaw !== 'all' ? gameRaw : ''

  // ✅ Explicit fields (recommended) instead of *
  let db = adminDb
    .from('tournaments')
    .select(
      [
        'id',
        'slug',
        'title',
        'description',
        'game_slug',
        'starts_at',
        'ends_at',
        'status',
        'finalized',
        'created_at',
        'updated_at',

        // old + new prize fields
        'prize',
        'prize_1',
        'prize_2',
        'prize_3',

        // thumbnail fields
        'thumbnail_url',
        'thumbnail_path'
      ].join(',')
    )
    .order('starts_at', { ascending: false })

  if (q) db = db.or(`title.ilike.%${q}%,slug.ilike.%${q}%`)
  if (status) db = db.eq('status', status)
  if (game) db = db.eq('game_slug', game)

  const { data, error } = await db
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  return { rows: data || [] }
})
