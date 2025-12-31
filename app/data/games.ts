import { PLACEHOLDER_IMG } from '@/utils/media'

export type GameBuildType = 'html' | 'webgl' | 'iframe'

export type ArcadeGame = {
    name: string
    slug: string
    thumbnail: string
    shortPitch: string
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

    genre?: 'Arcade' | 'Puzzle' | 'Runner' | 'Shooter' | 'Casual'
    difficulty?: 'Easy' | 'Medium' | 'Hard'
    featured?: boolean
    estTime?: string

    // ✅ for lobby UI
    rating?: { value: number; count: number }
}

export const GAMES: ArcadeGame[] = [
    {
        name: 'Boss Rush (Demo)',
        slug: 'boss-rush',
        thumbnail: PLACEHOLDER_IMG,
        shortPitch: 'Neon reflex boss fights. Tap fast, survive longer, post score.',
        controls: ['Tap / click to dodge', 'Survive as long as possible'],
        buildType: 'iframe',
        sourceUrl: '/games/boss-rush/index.html',
        embedAllowed: true,
        embed: { aspectRatio: '16/9', minHeight: 520, orientation: 'landscape' },
        leaderboard: true,
        featured: false,
        genre: 'Shooter',
        difficulty: 'Medium',
        estTime: '60s',
        rating: { value: 4.6, count: 1280 }
    }
]
