<script setup lang="ts">
import { GAMES } from '@/data/games'

const route = useRoute()

onMounted(() => {
  const q = route.query.game
  if (typeof q === 'string') selected.value = q
})

useHead({ title: 'Leaderboard' })

const { getTop } = useLeaderboard()

const selected = ref<string>('') // "" = global
const limit = ref(50)

const loading = ref(true)
const rows = ref<any[]>([])

async function load() {
  loading.value = true
  const res: any = await getTop(selected.value || undefined, limit.value)
  rows.value = res.top || []
  loading.value = false
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
              :key="r.id"
              class="border-b border-white/5 hover:bg-white/5"
          >
            <td class="py-3 pr-3 opacity-70">{{ i + 1 }}</td>
            <td class="py-3 pr-3 font-medium">{{ r.player }}</td>
            <td class="py-3 pr-3">
              <NuxtLink class="underline opacity-90 hover:opacity-100" :to="`/arcade/${r.gameSlug}`">
                {{ r.gameSlug }}
              </NuxtLink>
            </td>
            <td class="py-3 pr-3 font-semibold">{{ r.score }}</td>
            <td class="py-3 pr-3 opacity-70">
              {{ new Date(r.createdAt).toLocaleString() }}
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
