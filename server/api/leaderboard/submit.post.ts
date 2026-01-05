// server/api/leaderboard/submit.post.ts
import { submitScoreToStore } from '../../../server/utils/leaderboardStore'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)

    const gameSlug = String(body?.gameSlug ?? '').trim()
    const player = String(body?.player ?? 'Player').trim().slice(0, 32)
    const scoreRaw = Number(body?.score ?? 0)
    const score = Number.isFinite(scoreRaw) ? Math.max(0, Math.floor(scoreRaw)) : 0

    if (!gameSlug) {
      return { ok: false, error: 'Missing gameSlug' }
    }

    submitScoreToStore(gameSlug, { player: player || 'Player', score, createdAt: Date.now() })
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: 'Failed to submit score' }
  }
})
