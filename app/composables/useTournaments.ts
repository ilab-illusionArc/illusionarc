export type TournamentStatus = 'scheduled' | 'live' | 'ended' | 'canceled'

export type Tournament = {
  id: string
  slug: string
  title: string
  game_slug: string
  starts_at: string
  ends_at: string
  status: TournamentStatus
  prize: string | null
  description: string | null
}

export function useTournaments() {
  async function list() {
    const res = await $fetch<{ tournaments: Tournament[] }>('/api/tournaments/list')
    return res.tournaments || []
  }

  async function bySlug(slug: string) {
    const res = await $fetch<{ tournament: Tournament | null }>('/api/tournaments/by-slug', {
      query: { slug }
    })
    return res.tournament
  }

  return { list, bySlug }
}
