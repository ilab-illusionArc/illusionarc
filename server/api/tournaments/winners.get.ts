// server/api/tournaments/winners.get.ts
import { serverSupabaseServiceRole } from '#supabase/server'
import { createError, getQuery } from 'h3'

type WinnerRow = {
  rank: 1 | 2 | 3
  player_name: string
  score: number
  user_id?: string | null
  created_at?: string

  // ✅ new system
  prize?: string | null

  // (optional legacy)
  prize_bdt?: number | null
}

export default defineEventHandler(async (event) => {
  const adminDb = await serverSupabaseServiceRole(event)
  const q = getQuery(event)

  const slug = String(q.slug || '').trim()
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Missing slug' })

  async function readWinners(): Promise<WinnerRow[]> {
    const { data, error } = await adminDb
      .from('tournament_winners')
      .select('rank, player_name, score, user_id, created_at, prize, prize_bdt')
      .eq('tournament_slug', slug)
      .order('rank', { ascending: true })

    if (error) throw createError({ statusCode: 500, statusMessage: error.message })

    // small compatibility: if prize empty but prize_bdt exists, show it as text
    return (data || []).map((r: any) => ({
      ...r,
      prize: (String(r?.prize || '').trim() || null) ?? null,
      ...(r?.prize_bdt != null && (!r?.prize || !String(r.prize).trim())
        ? { prize: `${r.prize_bdt} BDT` }
        : {})
    })) as WinnerRow[]
  }

  // 1) quick return
  const existing = await readWinners()
  if (existing.length) return { slug, winners: existing }

  // 2) load tournament
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
  const nowMs = Date.now()
  const endedByTime = endsMs ? nowMs >= endsMs : false
  const endedByStatus = status === 'ended'
  const isEnded = endedByTime || endedByStatus

  if (!isEnded) return { slug, winners: [] }

  // 3) auto-finalize (RPC)
  try {
    await (adminDb as any).rpc('finalize_tournament_winners', {
      p_tournament_id: tournamentId,
      p_force: false
    })
  } catch (e: any) {
    throw createError({
      statusCode: 500,
      statusMessage: e?.message || 'Finalize failed'
    })
  }

  // 4) return winners after finalize
  const winners = await readWinners()
  return { slug, winners, finalizedWas: finalized }
})
