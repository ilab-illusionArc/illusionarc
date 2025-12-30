import type { WorkItem } from '~/types/content'
import { PLACEHOLDER_IMG } from '~/constants/media'

export const WORKS: WorkItem[] = [
    {
        title: 'Boss Rush (WebGL)',
        slug: 'boss-rush-webgl',
        category: 'games',
        shortDescription: 'Neon reflex boss-rush built for mobile + WebGL.',
        year: 2025,
        role: 'Game Design + Unity Dev',
        tools: ['Unity', 'C#', 'URP', 'WebGL'],
        tags: ['WebGL', 'Mobile', 'Arcade'],
        hero: { type: 'image', src: PLACEHOLDER_IMG, alt: 'Work placeholder' },
        gallery: [
            { type: 'image', src: PLACEHOLDER_IMG, alt: 'Gallery placeholder 1' },
            { type: 'image', src: PLACEHOLDER_IMG, alt: 'Gallery placeholder 2' }
        ],
        highlights: [
            'Optimized for 60 FPS feel',
            'Boss patterns + micro-feedback',
            'Playable on web with responsive canvas'
        ],
        outcome: 'Playable build + showcase-ready portfolio piece.',
        cta: 'Want a WebGL version of your game? Contact us.'
    },
    {
        title: 'VRET Skywalk Prototype',
        slug: 'vret-skywalk',
        category: 'ar-vr',
        shortDescription: 'VR height exposure simulation with progressive floors.',
        year: 2025,
        role: 'XR Dev + Prototype Design',
        tools: ['Unity XR', 'Quest', 'C#'],
        tags: ['VR', 'Training', 'Prototype'],
        hero: { type: 'image', src: PLACEHOLDER_IMG, alt: 'Work placeholder' },
        gallery: [
            { type: 'image', src: PLACEHOLDER_IMG, alt: 'Gallery placeholder 1' },
            { type: 'image', src: PLACEHOLDER_IMG, alt: 'Gallery placeholder 2' }
        ],
        highlights: ['Progressive exposure levels', 'Comfort-first locomotion', 'Session-ready flow'],
        cta: 'Need an XR training prototype? Get a quote.'
    }
]
