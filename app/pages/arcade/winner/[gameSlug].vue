<script setup lang="ts">
import { GAMES } from '@/data/games'

useHead({ title: 'Winners — Illusion Arc' })

const route = useRoute()

const gameSlug = computed(() => String(route.params.gameSlug || '').trim())
const game = computed(() => GAMES.find(g => g.slug === gameSlug.value))

const limit = ref(50)
const loading = ref(true)
const errorMsg = ref<string | null>(null)

type Row = { id: any; player: string; score: number; createdAt: string }
const rows = ref<Row[]>([])

async function load() {
  loading.value = true
  errorMsg.value = null

  try {
    if (!gameSlug.value) {
      rows.value = []
      return
    }

    const res: any = await $fetch('/api/winner/get', {
      method: 'GET',
      query: { gameSlug: gameSlug.value, limit: limit.value }
    })

    rows.value = Array.isArray(res?.items)
      ? res.items.map((r: any) => ({
          id: r.id,
          player: r.player,
          score: r.score,
          createdAt: r.createdAt
        }))
      : []
  } catch (e: any) {
    rows.value = []
    errorMsg.value = e?.data?.message || e?.message || 'Failed to load winners.'
  } finally {
    loading.value = false
  }
}

watch(gameSlug, load, { immediate: true })
</script>

<template>
  <UContainer class="py-12">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-3xl font-semibold">
          Winners — {{ game?.name || gameSlug }}
        </h1>
        <p class="mt-2 opacity-80">All-time best score per player (one entry per user).</p>
      </div>

      <div class="flex items-center gap-2">
        <UButton variant="ghost" :to="`/arcade/${gameSlug}`">Back to game</UButton>
        <UButton variant="soft" icon="i-heroicons-trophy" :to="`/leaderboard?game=${gameSlug}`">
          Leaderboard
        </UButton>
      </div>
    </div>

    <UCard class="mt-6 bg-white/5 border-white/10">
      <template #header>
        <div class="flex items-center justify-between">
          <div class="font-semibold">All-time Winners</div>
          <div class="text-sm opacity-70" v-if="loading">Loading…</div>
        </div>
      </template>

      <div v-if="errorMsg" class="p-4 text-sm">
        <div class="opacity-90">❌ {{ errorMsg }}</div>
        <div class="mt-3">
          <UButton size="sm" variant="soft" @click="load">Retry</UButton>
        </div>
      </div>

      <div v-else class="overflow-auto">
        <table class="w-full text-sm">
          <thead class="opacity-70">
            <tr class="text-left border-b border-white/10">
              <th class="py-3 pr-3">#</th>
              <th class="py-3 pr-3">Player</th>
              <th class="py-3 pr-3">Best Score</th>
              <th class="py-3 pr-3">When</th>
            </tr>
          </thead>

          <tbody>
            <tr
              v-for="(r, i) in rows"
              :key="r.id ?? `${r.player}_${r.score}_${r.createdAt}_${i}`"
              class="border-b border-white/5 hover:bg-white/5"
            >
              <td class="py-3 pr-3 opacity-70">{{ i + 1 }}</td>
              <td class="py-3 pr-3 font-medium">{{ r.player }}</td>
              <td class="py-3 pr-3 font-semibold tabular-nums">{{ r.score }}</td>
              <td class="py-3 pr-3 opacity-70">{{ new Date(r.createdAt).toLocaleString() }}</td>
            </tr>

            <tr v-if="!loading && rows.length === 0">
              <td colspan="4" class="py-10 text-center opacity-70">
                No winners yet for this game.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>
  </UContainer>
</template>
