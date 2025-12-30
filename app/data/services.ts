import type { ServiceItem } from '~/types/content'

export const SERVICES: ServiceItem[] = [
    {
        slug: 'game-development',
        title: 'Game Development',
        valueProp: 'From prototype to launch-ready build (mobile, desktop, WebGL).',
        deliverables: ['Playable prototype', 'Polished UI/UX', 'Build + store-ready packaging'],
        processSteps: ['Discovery', 'Prototype', 'Production', 'Launch'],
        timeline: '2–8 weeks (depending on scope)',
        faq: [
            { q: 'Do you build WebGL games?', a: 'Yes—optimized builds with responsive play areas.' },
            { q: 'Can you add ads/IAP?', a: 'Yes, and we’ll keep performance stable.' }
        ]
    },
    {
        slug: 'ar-vr',
        title: 'AR/VR (Unity XR)',
        valueProp: 'Immersive training, simulations, interactive demos, and VRET prototypes.',
        deliverables: ['XR prototype', 'Device testing', 'Performance pass'],
        processSteps: ['Discovery', 'Prototype', 'Production', 'Launch'],
        timeline: '3–10 weeks',
        faq: [{ q: 'Which headsets?', a: 'Quest, Rift, and PCVR depending on your target.' }]
    }
]
