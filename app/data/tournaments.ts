// app/data/tournaments.ts
export type TournamentStatus = 'scheduled' | 'live' | 'ended'

export type Tournament = {
  slug: string
  title: string
  gameSlug: string
  startsAt: string // ISO
  endsAt: string   // ISO
  status: TournamentStatus
  prize?: string
  description?: string
}

export const TOURNAMENTS: Tournament[] = [
  {
    slug: 'boss-rush-january-cup',
    title: 'Boss Rush — January Cup',
    gameSlug: 'boss-rush',
    startsAt: '2026-01-25T12:00:00+06:00',
    endsAt: '2026-01-25T14:00:00+06:00',
    status: 'scheduled',
    prize: 'Top 3 get special badge',
    description: 'Score as high as possible within the tournament window.'
  }
]
