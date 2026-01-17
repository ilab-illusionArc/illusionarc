import { serverSupabaseServiceRole } from '#supabase/server'

type RpcDailyArgs = { run_date: string } // YYYY-MM-DD

export default defineEventHandler(async (event) => {
    const q = getQuery(event)
    const secret = typeof q.secret === 'string' ? q.secret : ''

    if (!secret || secret !== process.env.CRON_SECRET) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    // service role client (server-only)
    const admin = serverSupabaseServiceRole(event)

    // By default compute yesterday (UTC)
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - 1)
    const run_date = d.toISOString().slice(0, 10) // YYYY-MM-DD

    // RPC: TS-safe cast for args
    const { error } = await (admin as any).rpc('compute_daily_winners', { run_date } as RpcDailyArgs)

    if (error) {
        console.error('[cron/daily] rpc error:', error.message)
        throw createError({ statusCode: 500, statusMessage: error.message })
    }

    return { ok: true, run_date }
})
