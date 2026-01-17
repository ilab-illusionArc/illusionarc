import { serverSupabaseServiceRole } from '#supabase/server'

type RpcWeeklyArgs = { week_start: string } // YYYY-MM-DD

function toUtcDateStr(d: Date) {
    return d.toISOString().slice(0, 10)
}

/**
 * Get previous Saturday 00:00 UTC for "week_start".
 * Works for any day, but intended for running on Saturday 00:00 UTC.
 */
function getPreviousSaturdayUtcStart() {
    const now = new Date()

    // normalize to 00:00 UTC today
    const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0))

    const dow = base.getUTCDay() // 0=Sun..6=Sat
    const daysSinceSat = (dow - 6 + 7) % 7

    // If today is Saturday, daysSinceSat = 0, we want previous week start => subtract 7
    const subtract = daysSinceSat === 0 ? 7 : daysSinceSat

    base.setUTCDate(base.getUTCDate() - subtract)
    return base // Date at Saturday 00:00 UTC
}

export default defineEventHandler(async (event) => {
    const q = getQuery(event)
    const secret = typeof q.secret === 'string' ? q.secret : ''

    if (!secret || secret !== process.env.CRON_SECRET) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    const admin = serverSupabaseServiceRole(event)

    // compute last week's start (previous Saturday 00:00 UTC)
    const weekStart = getPreviousSaturdayUtcStart()
    const week_start = toUtcDateStr(weekStart)

    const { error } = await (admin as any).rpc('compute_weekly_winners', { week_start } as RpcWeeklyArgs)

    if (error) {
        console.error('[cron/weekly] rpc error:', error.message)
        throw createError({ statusCode: 500, statusMessage: error.message })
    }

    return { ok: true, week_start }
})
