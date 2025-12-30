<script setup lang="ts">
const props = defineProps<{
  gameSlug: string
  limit?: number
}>()

const { getTop } = useLeaderboard()

const loading = ref(true)
const rows = ref<any[]>([])

async function load() {
  loading.value = true
  const res: any = await getTop(props.gameSlug, props.limit ?? 10)
  rows.value = res.top || []
  loading.value = false
}

watch(
    () => props.gameSlug,
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

    <div v-if="!loading && rows.length === 0" class="py-6 text-center text-sm opacity-70">
      No scores yet.
    </div>

    <div v-else class="divide-y divide-white/10">
      <div v-for="(r, i) in rows" :key="r.id" class="py-3 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-6 text-xs opacity-60">{{ i + 1 }}</div>
          <div class="font-medium">{{ r.player }}</div>
        </div>
        <div class="font-semibold">{{ r.score }}</div>
      </div>
    </div>

    <div class="mt-3">
      <UButton :to="`/arcade/leaderboard?game=${gameSlug}`" variant="ghost" size="sm">
        View full leaderboard →
      </UButton>
    </div>
  </UCard>
</template>
