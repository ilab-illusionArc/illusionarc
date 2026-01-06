import { PLACEHOLDER_IMG } from '@/utils/media'

export type GameBuildType = 'html' | 'webgl' | 'iframe'

export type ArcadeGame = {
  name: string
  slug: string
  thumbnail: string
  shortPitch: string
  description?: string
  controls: string[]
  buildType: GameBuildType
  sourceUrl: string
  embedAllowed: boolean
  embed: {
    aspectRatio?: string
    minHeight?: number
    orientation?: 'any' | 'portrait' | 'landscape'
  }
  leaderboard: boolean
  rating?: { value: number; count: number }
  genre?: 'Arcade' | 'Puzzle' | 'Runner' | 'Shooter' | 'Casual'
  difficulty?: 'Easy' | 'Medium' | 'Hard'
  featured?: boolean
  estTime?: string
}

export const GAMES: ArcadeGame[] = [
  {
    name: 'Boss Rush',
    slug: 'boss-rush',
    thumbnail: '/img/boss-rush/boss-rush-thumbnail.png',
    shortPitch: 'Neon reflex boss fights. Tap fast, survive longer, post score.',
    description:
      'Face fast-paced neon bosses with simple tap controls. Survive longer to increase score, dodge patterns, and climb the global leaderboard. Best experienced in landscape on mobile.',
    controls: ['Tap / click to dodge', 'Survive as long as possible'],
    buildType: 'iframe',
    sourceUrl: '/games/boss-rush/index.html',
    embedAllowed: true,
    embed: { aspectRatio: '16/9', minHeight: 520, orientation: 'landscape' },
    leaderboard: true,
    rating: { value: 4.6, count: 1280 },
    featured: false,
    genre: 'Shooter',
    difficulty: 'Medium',
    estTime: '60s'
  },
  {
    name: 'Blink Maze',
    slug: 'blink-maze',
    thumbnail: '/img/blink-maze/blink-maze-thumbnail.jpeg',
    shortPitch: 'Neon reflex boss fights. Tap fast, survive longer, post score.',
    description:
      'Face fast-paced neon bosses with simple tap controls. Survive longer to increase score, dodge patterns, and climb the global leaderboard. Best experienced in landscape on mobile.',
    controls: ['Tap / click to dodge', 'Survive as long as possible'],
    buildType: 'iframe',
    sourceUrl: '/games/blink-maze/index.html',
    embedAllowed: true,
    embed: { aspectRatio: '16/9', minHeight: 520, orientation: 'landscape' },
    leaderboard: true,
    rating: { value: 4.6, count: 1280 },
    featured: false,
    genre: 'Shooter',
    difficulty: 'Medium',
    estTime: '60s'
  },
  {
    name: 'Neon Polarity',
    slug: 'neon-polarity',
    thumbnail: '/img/neon-polarity/neon-polarity-thumbnail.png',
    shortPitch: 'Neon reflex boss fights. Tap fast, survive longer, post score.',
    description:
      'Face fast-paced neon bosses with simple tap controls. Survive longer to increase score, dodge patterns, and climb the global leaderboard. Best experienced in landscape on mobile.',
    controls: ['Tap / click to dodge', 'Survive as long as possible'],
    buildType: 'iframe',
    sourceUrl: '/games/neon-polarity/index.html',
    embedAllowed: true,
    embed: { aspectRatio: '16/9', minHeight: 520, orientation: 'landscape' },
    leaderboard: true,
    rating: { value: 4.6, count: 1280 },
    featured: false,
    genre: 'Shooter',
    difficulty: 'Medium',
    estTime: '60s'
  }
]
