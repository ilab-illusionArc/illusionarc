export type WorkCategory = 'games' | 'ar-vr' | 'vfx' | 'animation'

export type MediaType = 'image' | 'video'

export type GameBuildType = 'html' | 'webgl' | 'external-iframe'

export interface MediaItem {
    type: MediaType
    src: string
    alt?: string
}

export interface WorkItem {
    title: string
    slug: string
    category: WorkCategory
    shortDescription: string
    year: number
    role: string
    tools: string[]
    tags: string[]
    hero: MediaItem
    gallery: MediaItem[]
    highlights: string[]
    outcome?: string
    cta?: string
    client?: string
}

export interface ServiceItem {
    slug: string
    title: string
    valueProp: string
    deliverables: string[]
    processSteps: string[] // Discovery → Prototype → Production → Launch
    timeline: string
    faq: { q: string; a: string }[]
}

export interface GameEmbedSettings {
    aspectRatio?: string // e.g. "16/9"
    minWidth?: number
    minHeight?: number
    orientation?: 'any' | 'landscape' | 'portrait'
}

export interface GameItem {
    name: string
    slug: string
    category: 'Puzzle' | 'Arcade' | 'Reflex' | 'Casual'
    thumbnail: string
    shortPitch: string
    howToPlay: string[]
    buildType: GameBuildType
    sourceUrl: string
    embedAllowed: boolean
    embedSettings?: GameEmbedSettings
    leaderboardSupported: boolean
    coinsSupported?: boolean
}
