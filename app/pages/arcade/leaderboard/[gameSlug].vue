<script setup lang="ts">
import { GAMES } from '@/data/games'

useHead({ title: 'Leaderboard — Illusion Arc' })

const route = useRoute()
const router = useRouter()

const gameSlug = computed(() => String(route.params.gameSlug || '').trim())

const game = computed(() => GAMES.find(g => g.slug === gameSlug.value))

// period in URL: ?p=daily | weekly
const period = ref<'daily' | 'weekly'>('daily')

watchEffect(() => {
  const p = String(route.query.p || '').toLowerCase()
  if (p === 'weekly') period.value = 'weekly'
  else period.value = 'daily'
})

watch(period, async (p) => {
  await router.replace({ query: { ...route.query, p } })
})

const loading = ref(true)
const rows = ref<Array<{ user_id: string; player: string; score: number; created_at: string }>>([])

async function load() {
  loading.value = true
  try {
    const res: any = await $fetch('/api/leaderboard/get', {
      method: 'GET',
      query: {
        gameSlug: gameSlug.value,
        period: period.value,
        limit: 50
      }
    })
    rows.value = Array.isArray(res?.items) ? res.items : []
  } catch {
    rows.value = []
  } finally {
    loading.value = false
  }
}

watch([gameSlug, period], load, { immediate: true })
</script>

<template>
  <UContainer class="py-10 md:py-14">
    <div class="flex flex-col gap-2">
      <h1 class="text-3xl md:text-5xl font-semibold tracking-tight">
        {{ game?.name || gameSlug }} Leaderboard
      </h1>
      <p class="text-sm opacity-75">
        Only the best score per player is shown.
      </p>

      <!-- Tabs (no USelect) -->
      <div class="mt-4 inline-flex w-fit rounded-full border border-white/10 bg-white/5 p-1">
        <button
          class="px-4 py-2 rounded-full text-sm transition"
          :class="period === 'daily' ? 'bg-white/10 text-white' : 'text-white/70 hover:text-white'"
          @click="period = 'daily'"
          type="button"
        >
          Daily
        </button>
        <button
          class="px-4 py-2 rounded-full text-sm transition"
          :class="period === 'weekly' ? 'bg-white/10 text-white' : 'text-white/70 hover:text-white'"
          @click="period = 'weekly'"
          type="button"
        >
          Weekly
        </button>
      </div>
    </div>

    <UCard class="mt-6 bg-white/5 border-white/10">
      <template #header>
        <div class="flex items-center justify-between">
          <div class="font-semibold">Top Scores</div>
          <div v-if="loading" class="text-sm opacity-70">Loading…</div>
        </div>
      </template>

      <div class="overflow-auto">
        <table class="w-full text-sm">
          <thead class="opacity-70">
            <tr class="text-left border-b border-white/10">
              <th class="py-3 pr-3">#</th>
              <th class="py-3 pr-3">Player</th>
              <th class="py-3 pr-3">Score</th>
              <th class="py-3 pr-3">Time</th>
            </tr>
          </thead>

          <tbody>
            <tr
              v-for="(r, i) in rows"
              :key="`${r.user_id}-${i}`"
              class="border-b border-white/5 hover:bg-white/5"
            >
              <td class="py-3 pr-3 opacity-70">{{ i + 1 }}</td>
              <td class="py-3 pr-3 font-medium">{{ r.player }}</td>
              <td class="py-3 pr-3 font-semibold tabular-nums">{{ r.score }}</td>
              <td class="py-3 pr-3 opacity-70">{{ new Date(r.created_at).toLocaleString() }}</td>
            </tr>

            <tr v-if="!loading && rows.length === 0">
              <td colspan="4" class="py-10 text-center opacity-70">
                No scores yet. Play and submit a score!
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="mt-4 flex justify-end">
        <UButton :to="`/arcade/winner/${gameSlug}`" variant="soft" icon="i-heroicons-trophy">
          View all-time winners →
        </UButton>
      </div>
    </UCard>
  </UContainer>
</template>
