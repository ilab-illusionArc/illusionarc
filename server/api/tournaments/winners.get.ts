// server/api/tournaments/winners.get.ts
import { serverSupabaseServiceRole } from '#supabase/server'
import { createError, getQuery } from 'h3'

type WinnerRow = {
  rank: 1 | 2 | 3
  player_name: string
  score: number
  user_id?: string | null
  created_at?: string
  prize_bdt?: number | null
}

export default defineEventHandler(async (event) => {
  // Service role bypasses RLS and can call finalize safely
  const adminDb = await serverSupabaseServiceRole(event)
  const q = getQuery(event)

  const slug = String(q.slug || '').trim()
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Missing slug' })

  async function readWinners(): Promise<WinnerRow[]> {
    const { data, error } = await adminDb
      .from('tournament_winners')
      .select('rank, player_name, score, user_id, created_at, prize_bdt')
      .eq('tournament_slug', slug)
      .order('rank', { ascending: true })

    if (error) throw createError({ statusCode: 500, statusMessage: error.message })
    return (data || []) as WinnerRow[]
  }

  // 1) Return quickly if already exists
  const existing = await readWinners()
  if (existing.length) return { slug, winners: existing }

  // 2) Load tournament
  const { data: t, error: tErr } = await adminDb
    .from('tournaments')
    .select('id, slug, ends_at, status, finalized')
    .eq('slug', slug)
    .maybeSingle()

  if (tErr) throw createError({ statusCode: 500, statusMessage: tErr.message })
  if (!t?.id) throw createError({ statusCode: 404, statusMessage: 'Tournament not found' })

  const tournamentId = String((t as any).id)
  const endsAtIso = String((t as any).ends_at || '')
  const status = String((t as any).status || '')
  const finalized = Boolean((t as any).finalized)

  const endsMs = endsAtIso ? new Date(endsAtIso).getTime() : 0
  const nowMs = new Date().getTime()
  const endedByTime = endsMs ? nowMs >= endsMs : false
  const endedByStatus = status === 'ended'
  const isEnded = endedByTime || endedByStatus

  // Not ended → don't finalize
  if (!isEnded) return { slug, winners: [] }

  // 3) Auto-finalize on first public visit after end
  // Uses your SQL function: public.finalize_tournament_winners(p_tournament_id, p_force)
  // (If you used different function name/args, tell me and I’ll align it.)
  try {
    await (adminDb as any).rpc('finalize_tournament_winners', {
      p_tournament_id: tournamentId,
      p_force: false
    })
  } catch (e: any) {
    // If RPC fails, we still try to read winners (maybe cron/admin finalized already)
    // But if it’s a real error, bubble it.
    throw createError({
      statusCode: 500,
      statusMessage: e?.message || 'Finalize failed'
    })
  }

  // 4) Return winners after finalize
  const winners = await readWinners()

  // If still empty, it means there were no scores; return empty (not an error)
  if (!winners.length) return { slug, winners: [] }

  return { slug, winners, finalizedWas: finalized }
})
