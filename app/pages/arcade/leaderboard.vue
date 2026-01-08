<script setup lang="ts">
import { GAMES } from '@/data/games'

useHead({ title: 'Leaderboard' })

const route = useRoute()
const router = useRouter()

const selected = ref<string>(GAMES[0]?.slug || '')
onMounted(() => {
  const q = route.query.game
  if (typeof q === 'string' && q.trim()) selected.value = q.trim()
  else selected.value = GAMES[0]?.slug || ''
})

const period = ref<'daily' | 'weekly'>('daily')
onMounted(() => {
  const p = route.query.period
  if (p === 'daily' || p === 'weekly') period.value = p
})

const limit = ref<number>(50)
function clampLimit(n: number) {
  if (!Number.isFinite(n)) return 50
  return Math.max(1, Math.min(Math.floor(n), 200))
}

watch(
    [selected, period],
    async () => {
      const q: Record<string, any> = { ...route.query }
      q.game = selected.value
      q.period = period.value
      await router.replace({ query: q })
    },
    { flush: 'post' }
)

const gameNameBySlug = computed(() => {
  const map: Record<string, string> = {}
  for (const g of GAMES) map[g.slug] = g.name
  return map
})

const now = ref(Date.now())
let timer: any = null
onMounted(() => {
  timer = setInterval(() => (now.value = Date.now()), 1000)
})
onBeforeUnmount(() => timer && clearInterval(timer))

function msToHMS(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const hh = Math.floor(s / 3600)
  const mm = Math.floor((s % 3600) / 60)
  const ss = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return hh > 0 ? `${hh}:${pad(mm)}:${pad(ss)}` : `${mm}:${pad(ss)}`
}

function nextUtcMidnightMs() {
  const d = new Date(now.value)
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth()
  const day = d.getUTCDate()
  return Date.UTC(y, m, day + 1, 0, 0, 0, 0)
}

function nextUtcSaturdayStartMs() {
  const d = new Date(now.value)
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth()
  const day = d.getUTCDate()
  const dow = d.getUTCDay()
  const daysUntilNextSat = ((6 - dow + 7) % 7) || 7
  return Date.UTC(y, m, day + daysUntilNextSat, 0, 0, 0, 0)
}

const resetAtMs = computed(() => (period.value === 'daily' ? nextUtcMidnightMs() : nextUtcSaturdayStartMs()))
const timeLeftMs = computed(() => resetAtMs.value - now.value)
const timeLeftText = computed(() => msToHMS(timeLeftMs.value))

const resetLabel = computed(() => (period.value === 'daily' ? 'Resets at 00:00 UTC' : 'Resets Saturday 00:00 UTC'))

const loading = ref(true)
const errorMsg = ref<string | null>(null)

type Row = {
  userId?: string
  player: string
  score: number
  createdAt: string
}
const rows = ref<Row[]>([])

async function load() {
  loading.value = true
  errorMsg.value = null
  rows.value = []

  try {
    if (!selected.value) return

    const res: any = await $fetch('/api/leaderboard/get', {
      method: 'GET',
      query: {
        gameSlug: selected.value,
        period: period.value,
        limit: clampLimit(limit.value)
      }
    })

    rows.value = Array.isArray(res?.items) ? res.items : []
  } catch (e: any) {
    errorMsg.value = e?.data?.message || e?.message || 'Failed to load leaderboard.'
  } finally {
    loading.value = false
  }
}

watch([selected, period, limit], load, { immediate: true })

function fmtDate(ts?: string) {
  if (!ts) return ''
  const iso = ts.includes('T') ? ts : ts.replace(' ', 'T')
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString()
}

function goWinners() {
  navigateTo(`/arcade/winners`)
}
</script>

<template>
  <UContainer class="py-12">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-3xl font-semibold text-[var(--app-fg)]">Leaderboard</h1>
        <p class="mt-2 text-black/70 dark:text-white/70">
          {{ gameNameBySlug[selected] || selected }} • {{ period === 'daily' ? 'Daily' : 'Weekly' }}
        </p>
      </div>

      <div class="flex flex-wrap gap-2 items-center justify-end">
        <!-- Game buttons -->
        <div class="flex flex-wrap gap-2">
          <UButton
              v-for="g in GAMES"
              :key="g.slug"
              size="sm"
              :variant="selected === g.slug ? 'solid' : 'soft'"
              :color="selected === g.slug ? 'primary' : 'info'"
              @click="selected = g.slug"
          >
            {{ g.name }}
          </UButton>
        </div>

        <div class="w-full md:w-auto flex flex-wrap gap-2 items-center justify-end">
          <!-- Period tabs -->
          <div class="inline-flex rounded-full border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-1 backdrop-blur">
            <button
                type="button"
                class="px-3 py-1.5 rounded-full text-sm transition"
                :class="period === 'daily'
                ? 'bg-black/10 dark:bg-white/10 text-black dark:text-white'
                : 'text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white'"
                @click="period = 'daily'"
            >
              Daily
            </button>

            <button
                type="button"
                class="px-3 py-1.5 rounded-full text-sm transition"
                :class="period === 'weekly'
                ? 'bg-black/10 dark:bg-white/10 text-black dark:text-white'
                : 'text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white'"
                @click="period = 'weekly'"
            >
              Weekly
            </button>
          </div>

          <!-- Time left -->
          <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 py-2 backdrop-blur">
            <div class="flex items-start gap-2">
              <div class="mt-0.5 grid place-items-center h-8 w-8 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/30">
                <UIcon name="i-heroicons-clock" class="h-4 w-4 opacity-80" />
              </div>

              <div class="min-w-0">
                <div class="text-[11px] leading-4 text-black/60 dark:text-white/60 whitespace-nowrap">
                  {{ resetLabel }}
                </div>

                <div class="mt-0.5 text-sm font-semibold tabular-nums leading-5 whitespace-nowrap text-black dark:text-white">
                  {{ timeLeftText }}
                  <span class="text-black/60 dark:text-white/60 font-medium">left</span>
                </div>
              </div>
            </div>
          </div>

          <UButton variant="ghost" icon="i-heroicons-star" @click="goWinners">
            All-time Winners
          </UButton>

          <UInput v-model.number="limit" type="number" min="1" max="200" class="w-24" />
        </div>
      </div>
    </div>

    <UCard class="mt-6 border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur">
      <template #header>
        <div class="flex items-center justify-between">
          <div class="font-semibold text-black dark:text-white">
            Top Players — {{ period === 'daily' ? 'Daily' : 'Weekly' }}
          </div>
          <div class="text-sm text-black/60 dark:text-white/60" v-if="loading">Loading…</div>
        </div>
      </template>

      <div v-if="errorMsg" class="p-4 text-sm">
        <div class="text-black/90 dark:text-white/90">❌ {{ errorMsg }}</div>
        <div class="mt-3">
          <UButton size="sm" variant="soft" @click="load">Retry</UButton>
        </div>
      </div>

      <div v-else class="overflow-auto">
        <table class="w-full text-sm">
          <thead class="text-black/60 dark:text-white/60">
          <tr class="text-left border-b border-black/10 dark:border-white/10">
            <th class="py-3 pr-3">#</th>
            <th class="py-3 pr-3">Player</th>
            <th class="py-3 pr-3">Best score</th>
            <th class="py-3 pr-3">Achieved</th>
          </tr>
          </thead>

          <tbody>
          <tr
              v-for="(r, i) in rows"
              :key="r.userId ?? `${r.player}_${r.score}_${r.createdAt}_${i}`"
              class="border-b border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition"
          >
            <td class="py-3 pr-3 text-black/60 dark:text-white/60">{{ i + 1 }}</td>
            <td class="py-3 pr-3 font-medium text-black dark:text-white">{{ r.player }}</td>
            <td class="py-3 pr-3 font-semibold tabular-nums text-black dark:text-white">{{ r.score }}</td>
            <td class="py-3 pr-3 text-black/60 dark:text-white/60">{{ fmtDate(r.createdAt) }}</td>
          </tr>

          <tr v-if="!loading && rows.length === 0">
            <td colspan="4" class="py-10 text-center text-black/60 dark:text-white/60">
              No scores found for this {{ period }} period yet.
            </td>
          </tr>
          </tbody>
        </table>
      </div>
    </UCard>
  </UContainer>
</template>
