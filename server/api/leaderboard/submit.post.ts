import { randomUUID } from 'node:crypto'
import { readDb, writeDb } from '../../utils/leaderboardStore'

function isSafeName(s: unknown) {
    return typeof s === 'string' && s.trim().length >= 2 && s.trim().length <= 24
}

function isSafeSlug(s: unknown) {
    return typeof s === 'string' && /^[a-z0-9-]{2,64}$/.test(s)
}

function isSafeScore(n: unknown) {
    return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1_000_000_000
}

export default defineEventHandler(async (event) => {
    // Simple anti-abuse: require same-origin by default
    const origin = getRequestHeader(event, 'origin') || ''
    const host = getRequestHeader(event, 'host') || ''
    if (origin && !origin.includes(host)) {
        throw createError({ statusCode: 403, statusMessage: 'Invalid origin' })
    }

    const body = await readBody(event)

    const gameSlug = body?.gameSlug
    const player = body?.player
    const score = body?.score
    const source = body?.source

    if (!isSafeSlug(gameSlug)) throw createError({ statusCode: 400, statusMessage: 'Invalid gameSlug' })
    if (!isSafeName(player)) throw createError({ statusCode: 400, statusMessage: 'Invalid player' })
    if (!isSafeScore(score)) throw createError({ statusCode: 400, statusMessage: 'Invalid score' })
    if (source !== 'arcade' && source !== 'embed') throw createError({ statusCode: 400, statusMessage: 'Invalid source' })

    const db = await readDb()

    const row = {
        id: randomUUID(),
        gameSlug,
        player: String(player).trim(),
        score: Math.floor(score),
        createdAt: new Date().toISOString(),
        source
    }

    // keep db bounded
    db.scores.push(row)
    if (db.scores.length > 5000) db.scores.splice(0, db.scores.length - 5000)

    await writeDb(db)

    return { ok: true, row }
})
