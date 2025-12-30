import { readDb, topScores } from '../../utils/leaderboardStore'

export default defineEventHandler(async (event) => {
    const q = getQuery(event)
    const gameSlug = typeof q.gameSlug === 'string' ? q.gameSlug : null
    const limit = typeof q.limit === 'string' ? Math.min(200, Math.max(1, parseInt(q.limit))) : 50

    const db = await readDb()
    const rows = gameSlug
        ? db.scores.filter(s => s.gameSlug === gameSlug)
        : db.scores

    return {
        ok: true,
        gameSlug,
        top: topScores(rows, limit)
    }
})
