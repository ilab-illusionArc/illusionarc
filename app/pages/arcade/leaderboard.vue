<script setup lang="ts">
import { GAMES } from '@/data/games'

const route = useRoute()

useHead({ title: 'Leaderboard' })

const selected = ref<string>('') // "" = All Games
const limit = ref<number>(50)

onMounted(() => {
  const q = route.query.game
  if (typeof q === 'string') selected.value = q
})

const loading = ref(true)
const rows = ref<Array<{ id: any; player: string; gameSlug: string; score: number; createdAt: string }>>([])

const gameNameBySlug = computed(() => {
  const map: Record<string, string> = {}
  for (const g of GAMES) map[g.slug] = g.name
  return map
})

function clampLimit(n: number) {
  if (!Number.isFinite(n)) return 50
  return Math.max(1, Math.min(Math.floor(n), 200))
}

async function load() {
  loading.value = true
  try {
    const res: any = await $fetch('/api/leaderboard/get', {
      method: 'GET',
      query: {
        // ✅ if empty => All Games (API must support it)
        ...(selected.value ? { gameSlug: selected.value } : {}),
        limit: clampLimit(limit.value)
      }
    })

    rows.value = Array.isArray(res?.items) ? res.items : []
  } catch (e) {
    rows.value = []
  } finally {
    loading.value = false
  }
}

watch([selected, limit], load, { immediate: true })
</script>

<template>
  <UContainer class="py-12">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-3xl font-semibold">Leaderboard</h1>
        <p class="mt-2 opacity-80">Central ranking across arcade games.</p>
      </div>

      <div class="flex gap-2 items-center">
        <USelect
            v-model="selected"
            :options="[
            { label: 'All Games', value: '' },
            ...GAMES.map(g => ({ label: g.name, value: g.slug }))
          ]"
        />
        <UInput v-model.number="limit" type="number" class="w-28" />
      </div>
    </div>

    <UCard class="mt-6 bg-white/5 border-white/10">
      <template #header>
        <div class="flex items-center justify-between">
          <div class="font-semibold">Top Scores</div>
          <div class="text-sm opacity-70" v-if="loading">Loading…</div>
        </div>
      </template>

      <div class="overflow-auto">
        <table class="w-full text-sm">
          <thead class="opacity-70">
          <tr class="text-left border-b border-white/10">
            <th class="py-3 pr-3">#</th>
            <th class="py-3 pr-3">Player</th>
            <th class="py-3 pr-3">Game</th>
            <th class="py-3 pr-3">Score</th>
            <th class="py-3 pr-3">Time</th>
          </tr>
          </thead>

          <tbody>
          <tr
              v-for="(r, i) in rows"
              :key="r.id ?? `${r.gameSlug}_${r.player}_${r.score}_${r.createdAt}_${i}`"
              class="border-b border-white/5 hover:bg-white/5"
          >
            <td class="py-3 pr-3 opacity-70">{{ i + 1 }}</td>
            <td class="py-3 pr-3 font-medium">{{ r.player }}</td>

            <td class="py-3 pr-3">
              <NuxtLink class="underline opacity-90 hover:opacity-100" :to="`/arcade/${r.gameSlug}`">
                {{ gameNameBySlug[r.gameSlug] || r.gameSlug }}
              </NuxtLink>
            </td>

            <td class="py-3 pr-3 font-semibold">{{ r.score }}</td>

            <td class="py-3 pr-3 opacity-70">
              {{ r.createdAt ? new Date(r.createdAt).toLocaleString() : '' }}
            </td>
          </tr>

          <tr v-if="!loading && rows.length === 0">
            <td colspan="5" class="py-10 text-center opacity-70">
              No scores yet. Play a game and submit a score!
            </td>
          </tr>
          </tbody>
        </table>
      </div>
    </UCard>
  </UContainer>
</template>
