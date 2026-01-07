// server/api/leaderboard/get.get.ts
import { getQuery } from 'h3'

type Row = {
  id: string
  player_name: string
  score: number
  created_at: string
  user_id?: string | null
}

export default defineEventHandler(async (event) => {
  try {
    const q = getQuery(event)
    const gameSlug = String(q.gameSlug ?? '').trim()

    const limitRaw = Number(q.limit ?? 10)
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 50)) : 10

    // Never 500 for missing params — just return empty.
    if (!gameSlug) {
      return { ok: true, items: [], gameSlug: '', limit }
    }

    const config = useRuntimeConfig()
    const url = config.public?.supabaseUrl || process.env.SUPABASE_URL

    // Prefer service role on server (bypasses RLS) for reliability.
    const serviceKey =
      (config as any).supabaseServiceRoleKey ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      ''

    // If Supabase isn't configured, return empty (don’t crash).
    if (!url || !serviceKey) {
      return { ok: true, items: [], gameSlug, limit, note: 'Supabase not configured' }
    }

    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(url, serviceKey, {
      auth: { persistSession: false }
    })

    const { data, error } = await supabase
      .from('leaderboard_scores')
      .select('id, player_name, score, created_at, user_id')
      .eq('game_slug', gameSlug)
      .order('score', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[leaderboard/get] supabase error:', error)
      return { ok: false, items: [], error: 'Leaderboard unavailable right now.' }
    }

    const items = (data as Row[] | null)?.map((r) => ({
      id: r.id,
      player: r.player_name ?? 'Player',
      score: Number(r.score ?? 0),
      createdAt: r.created_at
    })) ?? []

    return { ok: true, items, gameSlug, limit }
  } catch (e: any) {
    console.error('[leaderboard/get] fatal:', e?.message || e)
    // Never crash the app on refresh.
    return { ok: false, items: [], error: 'Leaderboard unavailable right now.' }
  }
})
