type LiveRow = { gameSlug: string; tournamentSlug: string }

export function useLiveTournament() {
  async function getLiveRows() {
    const res = await $fetch<{ rows?: LiveRow[] }>('/api/tournaments/live-games')
    return Array.isArray(res?.rows) ? res.rows : []
  }

  async function findLiveTournamentForGame(gameSlug: string) {
    const rows = await getLiveRows()
    return rows.find(r => r.gameSlug === gameSlug) || null
  }

  return { getLiveRows, findLiveTournamentForGame }
}
