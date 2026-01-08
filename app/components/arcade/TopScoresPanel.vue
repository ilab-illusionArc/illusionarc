<script setup lang="ts">
type Row = {
  id?: string | number
  player?: string
  player_name?: string
  score?: number
  createdAt?: number | string
  created_at?: string
}

const props = defineProps<{
  gameSlug: string
  limit?: number
}>()

const { getTop } = useLeaderboard()

const loading = ref(false)
const rows = ref<Row[]>([])
const errorMsg = ref<string | null>(null)

function normalizeRows(res: any): Row[] {
  const raw = (Array.isArray(res?.top) && res.top)
      || (Array.isArray(res?.items) && res.items)
      || []

  return raw.map((r: any) => ({
    id: r?.id,
    player: r?.player ?? r?.player_name,
    score: typeof r?.score === 'number' ? r.score : Number(r?.score ?? 0),
    createdAt: r?.createdAt ?? r?.created_at
  }))
}

async function load() {
  // ✅ Prevent SSR fetch (avoids refresh “500” screens in dev/prod)
  if (import.meta.server) return

  if (!props.gameSlug) {
    rows.value = []
    errorMsg.value = null
    return
  }

  loading.value = true
  errorMsg.value = null

  try {
    const res: any = await getTop(props.gameSlug, props.limit ?? 10)
    rows.value = normalizeRows(res)
  } catch (e: any) {
    rows.value = []
    errorMsg.value = e?.data?.message || e?.message || 'Leaderboard unavailable.'
  } finally {
    loading.value = false
  }
}

watch(
    () => [props.gameSlug, props.limit],
    () => load(),
    { immediate: true }
)
</script>

<template>
  <UCard class="bg-white/5 border-white/10">
    <template #header>
      <div class="flex items-center justify-between">
        <div class="font-semibold">Top Scores</div>
        <div class="text-xs opacity-70" v-if="loading">Loading…</div>
      </div>
    </template>

    <div v-if="errorMsg" class="py-4 text-sm">
      <div class="opacity-80">{{ errorMsg }}</div>
      <div class="mt-3">
        <UButton size="sm" variant="soft" @click="load">Retry</UButton>
      </div>
    </div>

    <div v-else-if="!loading && rows.length === 0" class="py-6 text-center text-sm opacity-70">
      No scores yet.
    </div>

    <div v-else class="divide-y divide-white/10">
      <div
          v-for="(r, i) in rows"
          :key="r.id ?? i"
          class="py-3 flex items-center justify-between"
      >
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-6 text-xs opacity-60">{{ i + 1 }}</div>
          <div class="font-medium truncate">{{ r.player || 'Player' }}</div>
        </div>
        <div class="font-semibold tabular-nums">{{ r.score ?? 0 }}</div>
      </div>
    </div>

    <div class="mt-3">
      <UButton :to="`/arcade/leaderboard/${gameSlug}`" variant="ghost" size="sm">
        View full leaderboard →
      </UButton>
    </div>
  </UCard>
</template>
