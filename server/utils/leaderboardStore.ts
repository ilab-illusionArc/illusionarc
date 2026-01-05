// server/utils/leaderboardStore.ts
export type LeaderboardEntry = {
  player: string
  score: number
  createdAt: number // epoch ms
}

type StoreShape = {
  data: Map<string, LeaderboardEntry[]>
}

const KEY = '__illusion_arc_leaderboard_store__'

function getStore(): StoreShape {
  const g = globalThis as any
  if (!g[KEY]) {
    g[KEY] = { data: new Map<string, LeaderboardEntry[]>() } as StoreShape
  }
  return g[KEY] as StoreShape
}

export function submitScoreToStore(gameSlug: string, entry: LeaderboardEntry, maxKeep = 200) {
  const store = getStore()
  const list = store.data.get(gameSlug) ?? []
  list.push(entry)

  // Keep best scores first (desc)
  list.sort((a, b) => b.score - a.score || b.createdAt - a.createdAt)

  // Trim
  if (list.length > maxKeep) list.length = maxKeep

  store.data.set(gameSlug, list)
}

export function getTopFromStore(gameSlug: string, limit = 10): LeaderboardEntry[] {
  const store = getStore()
  const list = store.data.get(gameSlug) ?? []
  return list.slice(0, Math.max(1, Math.min(limit, 50)))
}
