// composables/useLeaderboard.ts
export function useLeaderboard() {
  async function getTop(
    gameSlug: string,
    limit = 10,
    opts?: { period?: 'daily' | 'weekly' | 'all' }
  ) {
    return await $fetch('/api/leaderboard/get', {
      method: 'GET',
      query: {
        gameSlug,
        limit,
        period: opts?.period ?? 'daily'
      }
    })
  }

  return { getTop }
}
