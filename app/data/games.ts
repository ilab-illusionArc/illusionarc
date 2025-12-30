import { PLACEHOLDER_IMG } from '@/utils/media'

export type GameBuildType = 'html' | 'webgl' | 'iframe'

export type ArcadeGame = {
    name: string
    slug: string
    thumbnail: string
    shortPitch: string
    controls: string[]
    buildType: GameBuildType
    sourceUrl: string // hosted game URL (can be local /games/... or external)
    embedAllowed: boolean
    embed: {
        aspectRatio?: string // e.g. "16/9"
        minHeight?: number
        orientation?: 'any' | 'portrait' | 'landscape'
    }
    leaderboard: boolean
    genre?: 'Arcade' | 'Puzzle' | 'Runner' | 'Shooter' | 'Casual'
    difficulty?: 'Easy' | 'Medium' | 'Hard'
    featured?: boolean
    estTime?: string // "30s", "2m", etc
}

export const GAMES: ArcadeGame[] = [
    {
        name: 'Boss Rush (Demo)',
        slug: 'boss-rush',
        thumbnail: PLACEHOLDER_IMG,
        shortPitch: 'Neon reflex boss fights. Tap fast, survive longer, post score.',
        controls: ['Tap / click to dodge', 'Survive as long as possible'],
        buildType: 'iframe',
        // ✅ for now we point to a local demo file you will add in public/
        sourceUrl: '/games/boss-rush/index.html',
        embedAllowed: true,
        embed: { aspectRatio: '16/9', minHeight: 520, orientation: 'landscape' },
        leaderboard: true,
        featured: false,
        genre: 'Shooter',
        difficulty: 'Medium',
        estTime: '60s',
    }
]
