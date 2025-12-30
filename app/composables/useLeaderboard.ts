export function useLeaderboard() {
    async function submitScore(payload: {
        gameSlug: string
        player: string
        score: number
        source: 'arcade' | 'embed'
    }) {
        return await $fetch('/api/leaderboard/submit', {
            method: 'POST',
            body: payload
        })
    }

    async function getTop(gameSlug?: string, limit = 50) {
        return await $fetch('/api/leaderboard/get', {
            query: { gameSlug, limit }
        })
    }

    return { submitScore, getTop }
}
