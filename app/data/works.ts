import type { WorkItem } from '~/types/content'
import { PLACEHOLDER_IMG } from '~/constants/media'

export const WORKS: WorkItem[] = [
    {
        title: 'Boss Rush',
        slug: 'boss-rush-webgl',
        category: 'games',
        shortDescription: 'Neon reflex boss fights. Tap fast, survive longer, post score.',
        year: 2025,
        role: 'Game Design + Unity Dev',
        tools: ['Unity', 'C#', 'URP', 'WebGL'],
        tags: ['WebGL', 'Mobile', 'Arcade'],
        hero: { type: 'image', src: '/img/boss-rush/boss-rush-icon.png', alt: 'Work placeholder' },
        gallery: [
            // { type: 'image', src: '/img/boss-rush/boss-rush-thumbnail.png', alt: 'Gallery placeholder 1' },
            { type: 'image', src: 'img/boss-rush/boss-rush-3.png', alt: 'Gallery placeholder 2' },
            { type: 'image', src: 'img/boss-rush/boss-rush-4.png', alt: 'Gallery placeholder 3' },
            { type: 'image', src: 'img/boss-rush/boss-rush-5.png', alt: 'Gallery placeholder 4' },
            { type: 'image', src: 'img/boss-rush/boss-rush-6.png', alt: 'Gallery placeholder 5' },
            { type: 'image', src: 'img/boss-rush/boss-rush-7.png', alt: 'Gallery placeholder 6' },
            { type: 'image', src: 'img/boss-rush/boss-rush-8.png', alt: 'Gallery placeholder 7' },
            { type: 'image', src: 'img/boss-rush/boss-rush-9.png', alt: 'Gallery placeholder 8' },
            { type: 'image', src: 'img/boss-rush/boss-rush-10.png', alt: 'Gallery placeholder 9' },
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
        title: 'Block Smash',
        slug: 'block-smash',
        category: 'games',
        shortDescription: 'Casual block-breaking game with power-ups and combos.',
        year: 2025,
        role: 'Game Design + Unity Dev',
        tools: ['Unity', 'C#', 'URP', 'WebGL'],
        tags: ['WebGL', 'Casual', 'Arcade'],
        hero: { type: 'image', src: '/img/block-smash/block-smash-icon.png', alt: 'Work placeholder' },
        gallery: [
            { type: 'image', src: '/img/block-smash/block-smash-1.jpg', alt: 'Gallery placeholder 1' },
            { type: 'image', src: '/img/block-smash/block-smash-2.jpg', alt: 'Gallery placeholder 2' },
            { type: 'image', src: '/img/block-smash/block-smash-3.jpg', alt: 'Gallery placeholder 3' },
            { type: 'image', src: '/img/block-smash/block-smash-4.jpg', alt: 'Gallery placeholder 4' },
            { type: 'image', src: '/img/block-smash/block-smash-5.jpg', alt: 'Gallery placeholder 5' }
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
        title: 'Cricket Clash: Card Edition',
        slug: 'cricket-clash-card-edition',
        category: 'games',
        shortDescription: 'Fast-paced cricket card game with strategic gameplay.',
        year: 2025,
        role: 'Game Design + Unity Dev',
        tools: ['Unity', 'C#', 'URP', 'WebGL'],
        tags: ['WebGL', 'Casual', 'Arcade'],
        hero: { type: 'image', src: '/img/cricket-clash/cricket-clash-icon.png', alt: 'Work placeholder' },
        gallery: [
            { type: 'image', src: '/img/cricket-clash/cricket-clash-1.jpg', alt: 'Gallery placeholder 1' },
            { type: 'image', src: '/img/cricket-clash/cricket-clash-2.jpg', alt: 'Gallery placeholder 2' },
            { type: 'image', src: '/img/cricket-clash/cricket-clash-3.jpg', alt: 'Gallery placeholder 3' },
            { type: 'image', src: '/img/cricket-clash/cricket-clash-4.jpg', alt: 'Gallery placeholder 4' },
            { type: 'image', src: '/img/cricket-clash/cricket-clash-5.jpg', alt: 'Gallery placeholder 5' },
            { type: 'image', src: '/img/cricket-clash/cricket-clash-6.png', alt: 'Gallery placeholder 6' }
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
        title: 'Virtual Tour',
        slug: 'virtual-tour-xr',
        category: 'ar-vr',
        shortDescription: 'Immersive VR tour experience for real estate showcase.',
        year: 2025,
        role: 'XR Dev + Prototype Design',
        tools: ['Unity XR', 'Quest', 'C#'],
        tags: ['VR', 'Training', 'Prototype'],
        hero: { type: 'image', src: PLACEHOLDER_IMG, alt: 'Work placeholder' },
        gallery: [
            { type: 'image', src: PLACEHOLDER_IMG, alt: 'Gallery placeholder 1' },
            { type: 'image', src: PLACEHOLDER_IMG, alt: 'Gallery placeholder 2' }
        ],
        highlights: ['Optimized for Quest headset', 'Interactive hotspots', 'Smooth locomotion system'],
        cta: 'Need an XR training prototype? Get a quote.'
    }
]
