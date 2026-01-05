<script setup lang="ts">
const props = defineProps<{
  gameSlug: string
  limit?: number
}>()

const { getTop } = useLeaderboard()

const loading = ref(false)
const rows = ref<any[]>([])
const errorMsg = ref<string | null>(null)

async function load() {
  // ✅ Prevent SSR fetch (this is what usually causes the refresh 500 screen)
  if (import.meta.server) return

  loading.value = true
  errorMsg.value = null

  try {
    const res: any = await getTop(props.gameSlug, props.limit ?? 10)
    rows.value = Array.isArray(res?.top) ? res.top : []
  } catch (e: any) {
    rows.value = []
    errorMsg.value = e?.message || 'Leaderboard unavailable.'
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
      <div v-for="(r, i) in rows" :key="r.id || i" class="py-3 flex items-center justify-between">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-6 text-xs opacity-60">{{ i + 1 }}</div>
          <div class="font-medium truncate">{{ r.player || 'Player' }}</div>
        </div>
        <div class="font-semibold tabular-nums">{{ r.score ?? 0 }}</div>
      </div>
    </div>

    <div class="mt-3">
      <UButton :to="`/arcade/leaderboard?game=${gameSlug}`" variant="ghost" size="sm">
        View full leaderboard →
      </UButton>
    </div>
  </UCard>
</template>
