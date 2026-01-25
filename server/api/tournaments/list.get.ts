// server/api/tournaments/list.get.ts
import { serverSupabaseClient } from '#supabase/server'
import { createError } from 'h3'

function computeStatus(t: any, nowMs = Date.now()) {
  const dbStatus = String(t?.status || 'scheduled').toLowerCase()
  if (dbStatus === 'canceled') return 'canceled'

  const s = Date.parse(String(t?.starts_at || ''))
  const e = Date.parse(String(t?.ends_at || ''))

  const hasS = Number.isFinite(s)
  const hasE = Number.isFinite(e)

  if (hasE && nowMs >= e) return 'ended'
  if (hasS && nowMs >= s && (!hasE || nowMs < e)) return 'live'
  return 'scheduled'
}

export default defineEventHandler(async (event) => {
  const supabase = await serverSupabaseClient(event)

  const { data, error } = await supabase
    .from('tournaments')
    .select('id, slug, title, game_slug, starts_at, ends_at, status, prize, description, thumbnail_url')
    .order('starts_at', { ascending: true })

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  const nowMs = Date.now()
  const rows = (data ?? []).map((t: any) => ({
    ...t,
    effective_status: computeStatus(t, nowMs)
  }))

  return { tournaments: rows }
})
