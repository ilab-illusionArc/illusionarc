<script setup lang="ts">
import { GAMES } from '@/data/games'

useHead({ title: 'Winners — illusion Arc' })

const route = useRoute()
const router = useRouter()

const limit = ref(50)
const loading = ref(true)
const errorMsg = ref<string | null>(null)

const selected = ref<string>(GAMES[0]?.slug || '')

onMounted(() => {
  const q = route.query.game
  if (typeof q === 'string' && q.trim()) selected.value = q.trim()
  else selected.value = GAMES[0]?.slug || ''
})

watch(
  selected,
  async (v) => {
    const q: Record<string, any> = { ...route.query, game: v }
    await router.replace({ query: q })
  },
  { flush: 'post' }
)

type WinnerRow = {
  userId: string
  player: string
  bestScore: number
  achievedAt: string
}

const rows = ref<WinnerRow[]>([])

function clampLimit(n: number) {
  if (!Number.isFinite(n)) return 50
  return Math.max(1, Math.min(Math.floor(n), 200))
}

// ✅ Fix Postgres timestamp parsing in Safari:
// "2026-01-07 08:17:53.462376+00" -> "2026-01-07T08:17:53.462376+00"
function parsePgTs(ts?: string) {
  if (!ts) return null
  const iso = ts.includes('T') ? ts : ts.replace(' ', 'T')
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

async function load() {
  loading.value = true
  errorMsg.value = null

  try {
    if (!selected.value) {
      rows.value = []
      return
    }

    const res: any = await $fetch('/api/winner/get', {
      method: 'GET',
      query: {
        gameSlug: selected.value,
        limit: clampLimit(limit.value)
      }
    })

    rows.value = Array.isArray(res?.items) ? res.items : []
  } catch (e: any) {
    rows.value = []
    errorMsg.value = e?.data?.message || e?.message || 'Failed to load winners.'
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
        <h1 class="text-3xl font-semibold">All-time Winners</h1>
        <p class="mt-2 opacity-80">
          Best score per player (per game).
        </p>
      </div>

      <div class="flex flex-wrap gap-2 items-center justify-end">
        <UButton
          variant="soft"
          icon="i-heroicons-trophy"
          :to="`/arcade/leaderboard?game=${selected}`"
        >
          Leaderboard
        </UButton>

        <UInput v-model.number="limit" type="number" min="1" max="200" class="w-28" />
      </div>
    </div>

    <!-- ✅ No USelect: game tabs -->
    <div class="mt-5 flex gap-2 overflow-x-auto pb-1">
      <UButton
        v-for="g in GAMES"
        :key="g.slug"
        size="sm"
        :variant="selected === g.slug ? 'solid' : 'soft'"
        color="primary"
        @click="selected = g.slug"
      >
        {{ g.name }}
      </UButton>
    </div>

    <UCard class="mt-6 bg-white/5 border-white/10">
      <template #header>
        <div class="flex items-center justify-between">
          <div class="font-semibold">Winners — {{ selected }}</div>
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
              <th class="py-3 pr-3">Best score</th>
              <th class="py-3 pr-3">Achieved</th>
            </tr>
          </thead>

          <tbody>
            <tr
              v-for="(r, i) in rows"
              :key="r.userId || i"
              class="border-b border-white/5 hover:bg-white/5"
            >
              <td class="py-3 pr-3 opacity-70">{{ i + 1 }}</td>
              <td class="py-3 pr-3 font-medium">{{ r.player }}</td>

              <td class="py-3 pr-3 font-semibold tabular-nums">
                {{ r.bestScore }}
              </td>

              <td class="py-3 pr-3 opacity-70">
                <span v-if="parsePgTs(r.achievedAt)">
                  {{ parsePgTs(r.achievedAt)!.toLocaleString() }}
                </span>
                <span v-else>—</span>
              </td>
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
