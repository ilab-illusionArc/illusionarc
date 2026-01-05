// server/api/leaderboard/get.get.ts
import { getTopFromStore } from '../../../server/utils/leaderboardStore'

export default defineEventHandler((event) => {
  try {
    const q = getQuery(event)
    const gameSlug = String(q.gameSlug ?? '').trim()
    const limitRaw = Number(q.limit ?? 10)
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 50)) : 10

    // Never 500 for missing params — just return empty.
    if (!gameSlug) {
      return { ok: true, items: [], gameSlug: '', limit }
    }

    const items = getTopFromStore(gameSlug, limit)
    return { ok: true, items, gameSlug, limit }
  } catch (e: any) {
    // Never crash the app on refresh.
    return { ok: false, items: [], error: 'Leaderboard unavailable right now.' }
  }
})
