import { serverSupabaseClient } from '#supabase/server'
import { createError } from 'h3'

type LiveRow = {
  tournamentSlug: string
  gameSlug: string
  startsAt: string
  endsAt: string
}

export default defineEventHandler(async (event) => {
  const client = await serverSupabaseClient(event)

  const nowIso = new Date().toISOString()

  // Pull all that are live by time window OR status=live
  // (so it still works even if status is not updated yet)
  const { data, error } = await client
    .from('tournaments')
    .select('slug, game_slug, starts_at, ends_at, status')
    .lte('starts_at', nowIso)
    .gt('ends_at', nowIso)
    .in('status', ['scheduled', 'live']) // allow scheduled but within window
    .order('ends_at', { ascending: true })

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  const rowsRaw = (data || [])
    .map((t: any) => ({
      tournamentSlug: String(t.slug),
      gameSlug: String(t.game_slug),
      startsAt: String(t.starts_at),
      endsAt: String(t.ends_at)
    }))
    .filter((r) => r.tournamentSlug && r.gameSlug)

  // ✅ Deduplicate per gameSlug: pick the one ending soonest (stable behavior)
  const byGame = new Map<string, LiveRow>()
  for (const r of rowsRaw) {
    if (!byGame.has(r.gameSlug)) byGame.set(r.gameSlug, r)
  }

  const rows = Array.from(byGame.values())
  const gameSlugs = rows.map((r) => r.gameSlug)

  return { now: nowIso, rows, gameSlugs }
})
