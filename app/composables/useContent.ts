import { WORKS } from '~/data/works'
import { SERVICES } from '~/data/services'
import { GAMES } from '~/data/games'
import type { WorkCategory } from '~/types/content'

export function useContent() {
    const works = WORKS
    const services = SERVICES
    const games = GAMES

    const getWorkBySlug = (slug: string) => works.find(w => w.slug === slug)
    const getGameBySlug = (slug: string) => games.find(g => g.slug === slug)

    const worksByCategory = (cat: WorkCategory) => works.filter(w => w.category === cat)

    return { works, services, games, getWorkBySlug, getGameBySlug, worksByCategory }
}
