type LiveRow = { gameSlug: string; tournamentSlug: string }

export function useLiveTournaments() {
  const rows = useState<LiveRow[]>('liveTournamentRows', () => [])
  const lastFetched = useState<number>('liveTournamentLastFetched', () => 0)
  const pending = useState<boolean>('liveTournamentPending', () => false)

  async function refresh(force = false) {
    // simple throttle: 15s
    const now = Date.now()
    if (!force && pending.value) return
    if (!force && now - lastFetched.value < 15_000 && rows.value.length) return

    pending.value = true
    try {
      const res = await $fetch<{ rows?: LiveRow[] }>('/api/tournaments/live-games', {
        credentials: 'include'
      })
      rows.value = Array.isArray(res?.rows) ? res.rows : []
      lastFetched.value = now
    } catch {
      // keep last known rows; avoid flicker
    } finally {
      pending.value = false
    }
  }

  function findForGame(gameSlug: string) {
    return rows.value.find(r => r.gameSlug === gameSlug) || null
  }

  return { rows, pending, refresh, findForGame }
}
