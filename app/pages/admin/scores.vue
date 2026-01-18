<!-- app/pages/admin/scores.vue -->
<script setup lang="ts">
import { GAMES } from '@/data/games'

definePageMeta({
  layout: 'admin',
  middleware: ['admin']
})

useHead({ title: 'Admin — Scores' })

const supabase = useSupabaseClient()
const toast = useToast()

type Period = 'daily' | 'weekly' | 'all'

// ✅ Explicit row shape (fixes "never")
type RawScoreRow = {
  id?: number
  user_id: string
  player_name: string | null
  game_slug: string
  score: number
  created_at: string // e.g. "2026-01-07 08:17:53.462376+00"
}

// UI state
const loading = ref(false)
const errorMsg = ref<string | null>(null)

// ✅ default game = first game slug (no All games option)
const game = ref<string>(GAMES[0]?.slug || '')
const period = ref<Period>('daily')

// ✅ default view: best per player
const showAllScores = ref(false)

const q = ref('')

// Date selection
const date = ref<string>('') // YYYY-MM-DD for daily/weekly
const rangeStart = ref<string>('') // YYYY-MM-DD for all
const rangeEnd = ref<string>('')   // YYYY-MM-DD for all

// Pagination
const page = ref(1)
const pageSize = ref(25)

// For all-scores mode: real server count
const totalRowsServer = ref(0)

// Data
const rawRows = ref<RawScoreRow[]>([])

/* ---------------- Helpers ---------------- */
function getUtcTodayStr() {
  const d = new Date()
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function toIsoUtcStartOfDay(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0)).toISOString()
}

function addDaysUtcIso(iso: string, days: number) {
  const d = new Date(iso)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString()
}

// Weekly resets Saturday 00:00 UTC
function isSaturday(dateStr: string) {
  const d = new Date(`${dateStr}T12:00:00Z`)
  return d.getUTCDay() === 6
}

function snapToSaturday(dateStr: string) {
  const d = new Date(`${dateStr}T12:00:00Z`)
  const dow = d.getUTCDay()
  const diff = (dow - 6 + 7) % 7
  d.setUTCDate(d.getUTCDate() - diff)
  return d.toISOString().slice(0, 10)
}

function weeklyWindowFromSaturday(satStr: string) {
  const startIso = toIsoUtcStartOfDay(satStr)
  if (!startIso) return null
  const endIso = addDaysUtcIso(startIso, 7)
  return { startIso, endIso }
}

// created_at might be "YYYY-MM-DD HH:mm:ss+00" -> convert to ISO-ish
function fmtDate(ts: string) {
  const iso = ts.includes('T') ? ts : ts.replace(' ', 'T')
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ts
  return d.toLocaleString()
}

function clampPageSize(n: number) {
  if (!Number.isFinite(n)) return 25
  return Math.max(10, Math.min(Math.floor(n), 200))
}

function debounce<T extends (...args: any[]) => void>(fn: T, ms: number) {
  let t: any = null
  return (...args: Parameters<T>) => {
    if (t) clearTimeout(t)
    t = setTimeout(() => fn(...args), ms)
  }
}

/* ---------------- Defaults ---------------- */
function ensureDefaults() {
  const today = getUtcTodayStr()

  // ensure game exists
  if (!game.value && GAMES[0]?.slug) game.value = GAMES[0].slug

  // ensure dates
  if (!date.value) date.value = today
  if (!rangeStart.value) rangeStart.value = today
  if (!rangeEnd.value) rangeEnd.value = today

  // enforce saturday when weekly
  if (period.value === 'weekly' && date.value && !isSaturday(date.value)) {
    date.value = snapToSaturday(date.value)
  }
}

onMounted(() => {
  pageSize.value = clampPageSize(pageSize.value)
  ensureDefaults()
  loadDebounced()
})

/* ---------------- Derived lists ---------------- */
const searched = computed(() => {
  const needle = q.value.trim().toLowerCase()
  if (!needle) return rawRows.value
  return rawRows.value.filter((r) => {
    const s = `${r.player_name || ''} ${r.user_id} ${r.game_slug} ${r.score} ${r.created_at}`.toLowerCase()
    return s.includes(needle)
  })
})

// Best-per-player per game (you now always filter by a single game)
const bestPerPlayer = computed<RawScoreRow[]>(() => {
  const map = new Map<string, RawScoreRow>()
  for (const r of searched.value) {
    const prev = map.get(r.user_id)
    if (!prev || r.score > prev.score) map.set(r.user_id, r)
  }
  return Array.from(map.values()).sort((a, b) => b.score - a.score)
})

const displayList = computed<RawScoreRow[]>(() => {
  return showAllScores.value ? searched.value : bestPerPlayer.value
})

// Client-side pagination for best-per-player (and for search)
const totalRowsClient = computed(() => displayList.value.length)
const totalPagesClient = computed(() => Math.max(1, Math.ceil(totalRowsClient.value / pageSize.value)))

const pagedRows = computed(() => {
  const size = clampPageSize(pageSize.value)
  const p = Math.max(1, Math.min(page.value, totalPagesClient.value))
  const from = (p - 1) * size
  const to = from + size
  return displayList.value.slice(from, to)
})

const summary = computed(() => {
  const list = displayList.value
  const total = list.length
  const top = list[0]?.score ?? 0
  let sum = 0
  for (const r of list) sum += r.score
  const avg = total ? Math.round(sum / total) : 0
  return { total, top, avg }
})

const periodLabel = computed(() => {
  if (period.value === 'daily') return 'Daily (UTC 00:00 → 00:00)'
  if (period.value === 'weekly') return 'Weekly (Saturday 00:00 UTC reset)'
  return 'All-time (optional date range)'
})

/* ---------------- Auto refresh rules ----------------
- ANY parameter change refreshes automatically
- No Apply button
- Page resets on major filter changes
----------------------------------------------------- */

// weekly: snap to saturday and refresh
watch(date, (v) => {
  if (period.value !== 'weekly') return
  if (!v) return
  if (!isSaturday(v)) {
    date.value = snapToSaturday(v)
    toast.add({
      title: 'Weekly uses Saturdays',
      description: 'Snapped to the nearest previous Saturday (UTC).',
      color: 'info'
    })
  }
})

// page size clamp
watch(pageSize, (v) => {
  pageSize.value = clampPageSize(v)
  page.value = 1
})

// reset page on major filter changes
watch([game, period, showAllScores], () => {
  page.value = 1
})

// auto load (debounced) for filter changes
const loadDebounced = debounce(() => {
  load().catch(() => {})
}, 250)

// refresh triggers
watch([game, period, showAllScores, page, pageSize], () => loadDebounced())
watch(q, () => {
  page.value = 1
  // no DB reload needed; search is client-side
})
watch([rangeStart, rangeEnd], () => {
  if (period.value === 'all') {
    page.value = 1
    loadDebounced()
  }
})
watch(date, () => {
  if (period.value === 'daily' || period.value === 'weekly') {
    page.value = 1
    loadDebounced()
  }
})

/* ---------------- Load ---------------- */
/**
 * showAllScores = true  => server pagination (real count)
 * showAllScores = false => fetch larger batch, compute best-per-player, paginate client-side
 */
async function load(): Promise<void> {
  ensureDefaults()

  loading.value = true
  errorMsg.value = null
  rawRows.value = []
  totalRowsServer.value = 0

  try {
    const size = clampPageSize(pageSize.value)

    let query = supabase
      .from('leaderboard_scores')
      .select('id, user_id, player_name, game_slug, score, created_at', {
        count: showAllScores.value ? 'exact' : undefined
      })
      .eq('game_slug', game.value)
      .order('created_at', { ascending: false })
      .order('score', { ascending: false })

    // time windows
    if (period.value === 'daily') {
      const day = date.value || getUtcTodayStr()
      const startIso = toIsoUtcStartOfDay(day)
      if (!startIso) throw new Error('Invalid date. Use YYYY-MM-DD.')
      const endIso = addDaysUtcIso(startIso, 1)
      query = query.gte('created_at', startIso).lt('created_at', endIso)
    }

    if (period.value === 'weekly') {
      const pick = date.value || getUtcTodayStr()
      const sat = isSaturday(pick) ? pick : snapToSaturday(pick)
      const win = weeklyWindowFromSaturday(sat)
      if (!win) throw new Error('Invalid weekly date.')
      query = query.gte('created_at', win.startIso).lt('created_at', win.endIso)
    }

    if (period.value === 'all') {
      const s = rangeStart.value ? toIsoUtcStartOfDay(rangeStart.value) : null
      const e = rangeEnd.value ? toIsoUtcStartOfDay(rangeEnd.value) : null
      if (s) query = query.gte('created_at', s)
      if (e) query = query.lt('created_at', addDaysUtcIso(e, 1))
    }

    if (showAllScores.value) {
      // ✅ true server pagination
      const from = (page.value - 1) * size
      const to = from + size - 1

      const { data, error, count } = await query.range(from, to)
      if (error) throw error

      totalRowsServer.value = count ?? 0
      rawRows.value = (data ?? []) as RawScoreRow[]
      return
    }

    // ✅ best-per-player mode:
    // fetch a larger set; client-side best & paginate
    const FETCH_LIMIT = 5000
    const { data, error } = await query.limit(FETCH_LIMIT)
    if (error) throw error

    rawRows.value = (data ?? []) as RawScoreRow[]

    // keep page within bounds after data changes
    if (page.value > totalPagesClient.value) page.value = totalPagesClient.value

    if (rawRows.value.length >= FETCH_LIMIT) {
      toast.add({
        title: 'Large window',
        description: `Fetched ${FETCH_LIMIT} rows to compute best-per-player. If your window exceeds this, we can move "best-per-player" to a SQL view/RPC.`,
        color: 'warning'
      })
    }
  } catch (e: any) {
    errorMsg.value = e?.message || 'Failed to load scores.'
  } finally {
    loading.value = false
  }
}

function setQuickDay(which: 'today' | 'yesterday') {
  const todayIso = toIsoUtcStartOfDay(getUtcTodayStr())!
  const iso = which === 'today' ? todayIso : addDaysUtcIso(todayIso, -1)
  date.value = iso.slice(0, 10)
}

function exportCsv() {
  if (!import.meta.client) return
  const list = displayList.value

  const header = ['id', 'user_id', 'player_name', 'game_slug', 'score', 'created_at']
  const lines = [header.join(',')]

  for (const r of list) {
    const row = [
      r.id ?? '',
      r.user_id,
      (r.player_name ?? '').replace(/"/g, '""'),
      r.game_slug,
      r.score,
      r.created_at
    ]
    lines.push(row.map((v) => `"${String(v)}"`).join(','))
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `admin_scores_${game.value}_${period.value}_${showAllScores.value ? 'all' : 'best'}_${new Date()
    .toISOString()
    .slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)

  toast.add({ title: 'Exported', description: 'CSV downloaded.', color: 'success' })
}
</script>

<template>
  <div class="space-y-4">
    <!-- HERO -->
    <div
      class="relative overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-5 lg:p-6 backdrop-blur"
    >
      <div
        class="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full blur-3xl opacity-60"
        style="background: radial-gradient(circle at 30% 30%, rgba(34,211,238,.22), transparent 60%);"
        aria-hidden="true"
      />
      <div
        class="pointer-events-none absolute -bottom-28 -left-28 h-80 w-80 rounded-full blur-3xl opacity-60"
        style="background: radial-gradient(circle at 30% 30%, rgba(124,58,237,.22), transparent 60%);"
        aria-hidden="true"
      />

      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="min-w-0">
          <div
            class="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-1.5 text-xs text-black/60 dark:text-white/60"
          >
            <UIcon name="i-heroicons-trophy" class="h-4 w-4" />
            Scores • {{ periodLabel }}
          </div>

          <h1 class="mt-3 text-2xl lg:text-3xl font-extrabold tracking-tight text-black dark:text-white">
            {{ GAMES.find(g => g.slug === game)?.name || game }}
          </h1>

          <p class="mt-1 text-sm text-black/60 dark:text-white/60 max-w-2xl">
            Default is <b class="text-black dark:text-white">best score per player</b>. Toggle to view <b class="text-black dark:text-white">all scores</b>.
            Refresh happens <b class="text-black dark:text-white">automatically</b> when filters change.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-4 py-2.5 text-sm hover:bg-black/10 dark:hover:bg-white/10 transition"
            @click="exportCsv"
          >
            <UIcon name="i-heroicons-arrow-down-tray" class="h-5 w-5 opacity-80" />
            Export CSV
          </button>

          <div class="inline-flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2.5">
            <UIcon name="i-heroicons-list-bullet" class="h-4 w-4 opacity-70" />
            <span class="text-xs text-black/60 dark:text-white/60">Page size</span>
            <input
              v-model.number="pageSize"
              type="number"
              min="10"
              max="200"
              class="w-20 bg-transparent text-sm text-black dark:text-white outline-none"
            />
          </div>
        </div>
      </div>

      <!-- CONTROLS -->
      <div class="mt-4 grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-3">
        <!-- Search -->
        <div class="flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2.5 backdrop-blur">
          <UIcon name="i-heroicons-magnifying-glass" class="h-5 w-5 opacity-60" />
          <input
            v-model="q"
            type="text"
            placeholder="Search player name, user id, score…"
            class="w-full bg-transparent text-sm outline-none text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40"
          />
          <button
            v-if="q.trim()"
            type="button"
            class="rounded-xl px-2 py-1 text-xs border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition"
            @click="q = ''"
          >
            Clear
          </button>
        </div>

        <!-- Filters -->
        <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-3 backdrop-blur">
          <div class="flex flex-wrap items-center gap-2 justify-between">
            <!-- Period pills -->
            <div class="inline-flex rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-1">
              <button
                type="button"
                class="px-3 py-2 rounded-xl text-sm transition"
                :class="period === 'daily'
                  ? 'bg-black/10 dark:bg-white/10 text-black dark:text-white'
                  : 'text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white'"
                @click="period = 'daily'"
              >
                Daily
              </button>

              <button
                type="button"
                class="px-3 py-2 rounded-xl text-sm transition"
                :class="period === 'weekly'
                  ? 'bg-black/10 dark:bg-white/10 text-black dark:text-white'
                  : 'text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white'"
                @click="period = 'weekly'"
              >
                Weekly
              </button>

              <button
                type="button"
                class="px-3 py-2 rounded-xl text-sm transition"
                :class="period === 'all'
                  ? 'bg-black/10 dark:bg-white/10 text-black dark:text-white'
                  : 'text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white'"
                @click="period = 'all'"
              >
                All-time
              </button>
            </div>

            <!-- Mode toggle -->
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2 text-sm hover:bg-black/10 dark:hover:bg-white/10 transition"
              @click="showAllScores = !showAllScores"
            >
              <UIcon :name="showAllScores ? 'i-heroicons-bars-3' : 'i-heroicons-star'" class="h-5 w-5 opacity-80" />
              {{ showAllScores ? 'All scores' : 'Best per player' }}
            </button>
          </div>

          <!-- Game buttons (no All games) -->
          <div class="mt-3 flex flex-wrap gap-2">
            <button
              v-for="g in GAMES"
              :key="g.slug"
              type="button"
              class="px-3 py-2 rounded-2xl border border-black/10 dark:border-white/10 text-sm transition"
              :class="game === g.slug
                ? 'bg-black text-white dark:bg-white dark:text-black'
                : 'bg-black/5 dark:bg-white/5 text-black/70 dark:text-white/70 hover:bg-black/10 dark:hover:bg-white/10'"
              @click="game = g.slug"
            >
              {{ g.name }}
            </button>
          </div>

          <!-- Date controls -->
          <div class="mt-3 flex flex-wrap items-center gap-2">
            <template v-if="period === 'all'">
              <div class="inline-flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2">
                <span class="text-xs text-black/60 dark:text-white/60">From</span>
                <input v-model="rangeStart" type="date" class="bg-transparent text-sm text-black dark:text-white outline-none" />
              </div>

              <div class="inline-flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2">
                <span class="text-xs text-black/60 dark:text-white/60">To</span>
                <input v-model="rangeEnd" type="date" class="bg-transparent text-sm text-black dark:text-white outline-none" />
              </div>
            </template>

            <template v-else>
              <div class="inline-flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2">
                <span class="text-xs text-black/60 dark:text-white/60">
                  {{ period === 'weekly' ? 'Saturday (UTC)' : 'Day (UTC)' }}
                </span>
                <input v-model="date" type="date" class="bg-transparent text-sm text-black dark:text-white outline-none" />
              </div>

              <button
                type="button"
                class="inline-flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-2 text-xs hover:bg-black/10 dark:hover:bg-white/10 transition"
                @click="setQuickDay('today')"
              >
                Today (UTC)
              </button>

              <button
                type="button"
                class="inline-flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-2 text-xs hover:bg-black/10 dark:hover:bg-white/10 transition"
                @click="setQuickDay('yesterday')"
              >
                Yesterday (UTC)
              </button>

              <span v-if="period === 'weekly'" class="text-xs text-black/60 dark:text-white/60">
                (auto-snaps to Saturday)
              </span>
            </template>
          </div>

          <div class="mt-2 text-xs text-black/60 dark:text-white/60">
            Daily resets <b class="text-black dark:text-white">00:00 UTC</b>. Weekly resets <b class="text-black dark:text-white">Saturday 00:00 UTC</b>.
          </div>
        </div>
      </div>

      <!-- Summary -->
      <div class="mt-3 flex flex-wrap items-center gap-2 text-xs text-black/60 dark:text-white/60">
        <span class="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-1.5">
          <UIcon name="i-heroicons-queue-list" class="h-4 w-4 opacity-70" />
          Total <span class="font-semibold text-black dark:text-white">{{ summary.total }}</span>
        </span>

        <span class="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-1.5">
          <UIcon name="i-heroicons-arrow-trending-up" class="h-4 w-4 opacity-70" />
          Top <span class="font-semibold text-black dark:text-white tabular-nums">{{ summary.top }}</span>
        </span>

        <span class="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-1.5">
          <UIcon name="i-heroicons-calculator" class="h-4 w-4 opacity-70" />
          Avg <span class="font-semibold text-black dark:text-white tabular-nums">{{ summary.avg }}</span>
        </span>

        <span v-if="loading" class="inline-flex items-center gap-2 rounded-full px-3 py-1.5 border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
          <span class="h-2 w-2 rounded-full animate-pulse bg-cyan-400" />
          Loading…
        </span>

        <span v-if="showAllScores" class="text-xs">
          (All-scores uses server pagination; best-per-player uses client pagination.)
        </span>
      </div>
    </div>

    <!-- TABLE -->
    <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur overflow-hidden">
      <div v-if="errorMsg" class="p-4">
        <div class="text-sm text-black dark:text-white">❌ {{ errorMsg }}</div>
      </div>

      <div v-else class="overflow-auto">
        <table class="w-full text-sm">
          <thead class="text-black/60 dark:text-white/60">
            <tr class="text-left border-b border-black/10 dark:border-white/10">
              <th class="py-3 px-4">#</th>
              <th class="py-3 px-4">Player</th>
              <th class="py-3 px-4">Score</th>
              <th class="py-3 px-4 hidden md:table-cell">Achieved</th>
              <th class="py-3 px-4 hidden lg:table-cell">User</th>
            </tr>
          </thead>

          <tbody>
            <tr
              v-for="(r, i) in pagedRows"
              :key="`${r.user_id}_${r.score}_${r.created_at}_${i}`"
              class="border-b border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition"
            >
              <td class="py-3 px-4 text-black/60 dark:text-white/60 tabular-nums">
                {{ (page - 1) * clampPageSize(pageSize) + i + 1 }}
              </td>

              <td class="py-3 px-4 min-w-[240px]">
                <div class="flex items-center gap-3 min-w-0">
                  <div class="h-10 w-10 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 grid place-items-center shrink-0">
                    <UIcon name="i-heroicons-user" class="h-5 w-5 opacity-70" />
                  </div>
                  <div class="min-w-0">
                    <div class="font-semibold text-black dark:text-white truncate">
                      {{ r.player_name || 'Unknown' }}
                    </div>
                    <div class="text-xs text-black/60 dark:text-white/60 md:hidden">
                      {{ fmtDate(r.created_at) }}
                    </div>
                  </div>
                </div>
              </td>

              <td class="py-3 px-4 font-extrabold text-black dark:text-white tabular-nums">
                {{ r.score }}
              </td>

              <td class="py-3 px-4 hidden md:table-cell text-black/60 dark:text-white/60 whitespace-nowrap">
                {{ fmtDate(r.created_at) }}
              </td>

              <td class="py-3 px-4 hidden lg:table-cell text-black/60 dark:text-white/60">
                <span class="font-mono text-xs">{{ r.user_id.slice(0, 8) }}…{{ r.user_id.slice(-6) }}</span>
              </td>
            </tr>

            <tr v-if="!loading && pagedRows.length === 0">
              <td colspan="5" class="py-10 text-center text-black/60 dark:text-white/60">
                No scores found for this filter.
              </td>
            </tr>

            <tr v-if="loading">
              <td colspan="5" class="py-8">
                <div class="px-4 grid gap-2">
                  <div class="h-10 rounded-2xl bg-black/10 dark:bg-white/10 animate-pulse" />
                  <div class="h-10 rounded-2xl bg-black/10 dark:bg-white/10 animate-pulse" />
                  <div class="h-10 rounded-2xl bg-black/10 dark:bg-white/10 animate-pulse" />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- PAGINATION -->
    <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4 backdrop-blur">
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div class="text-sm text-black/60 dark:text-white/60">
          Total:
          <span class="font-semibold text-black dark:text-white">
            {{ displayList.length }}
          </span>
          • Page <span class="font-semibold text-black dark:text-white">{{ page }}</span> / {{ totalPagesClient }}
          <span v-if="showAllScores && totalRowsServer" class="text-xs"> • Server total: {{ totalRowsServer }}</span>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            class="px-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition disabled:opacity-40"
            :disabled="page <= 1 || loading"
            @click="page = Math.max(1, page - 1)"
          >
            Prev
          </button>

          <button
            type="button"
            class="px-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-black text-white dark:bg-white dark:text-black hover:opacity-90 transition disabled:opacity-40"
            :disabled="loading"
            @click="page = 1"
          >
            First
          </button>

          <button
            type="button"
            class="px-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition disabled:opacity-40"
            :disabled="page >= totalPagesClient || loading"
            @click="page = Math.min(totalPagesClient, page + 1)"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
