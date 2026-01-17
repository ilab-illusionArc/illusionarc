<!--<script setup lang="ts">-->
<!--definePageMeta({-->
<!--  layout: 'admin',-->
<!--  middleware: ['admin']-->
<!--})-->

<!--useHead({ title: 'Admin — Scores' })-->

<!--const supabase = useSupabaseClient()-->
<!--const toast = useToast()-->

<!--type Period = 'daily' | 'weekly' | 'all'-->
<!--type ScoreRow = {-->
<!--  id: number-->
<!--  game_slug: string-->
<!--  user_id: string-->
<!--  player_name: string | null-->
<!--  score: number-->
<!--  created_at: string-->
<!--}-->

<!--const loading = ref(true)-->
<!--const errorMsg = ref<string | null>(null)-->

<!--const q = ref('')-->
<!--const game = ref<string>('all')-->
<!--const period = ref<Period>('daily')-->
<!--const limit = ref<number>(200)-->

<!--const start = ref<string>('') // YYYY-MM-DD-->
<!--const end = ref<string>('')   // YYYY-MM-DD-->

<!--const rows = ref<ScoreRow[]>([])-->

<!--/**-->
<!-- * For admin view, we’re using your existing leaderboard_scores table.-->
<!-- * Daily / Weekly are derived by time window:-->
<!-- * - daily: [today 00:00 UTC, tomorrow 00:00 UTC)-->
<!-- * - weekly: [Sat 00:00 UTC, next Sat 00:00 UTC)-->
<!-- * - all: no time filter-->
<!-- *-->
<!-- * If later you want "datewise" and "weekwise winners list" persisted,-->
<!-- * we can add materialized tables like leaderboard_daily_best, leaderboard_weekly_best.-->
<!-- */-->

<!--function clampLimit(n: number) {-->
<!--  if (!Number.isFinite(n)) return 200-->
<!--  return Math.max(10, Math.min(Math.floor(n), 1000))-->
<!--}-->

<!--function fmtDate(ts: string) {-->
<!--  const d = new Date(ts)-->
<!--  if (Number.isNaN(d.getTime())) return ts-->
<!--  return d.toLocaleString()-->
<!--}-->

<!--function toIsoUtcStartOfDay(dateStr: string) {-->
<!--  // dateStr: YYYY-MM-DD -> UTC 00:00-->
<!--  const [y, m, d] = dateStr.split('-').map(Number)-->
<!--  if (!y || !m || !d) return null-->
<!--  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0)).toISOString()-->
<!--}-->

<!--function addDaysUtcIso(iso: string, days: number) {-->
<!--  const d = new Date(iso)-->
<!--  d.setUTCDate(d.getUTCDate() + days)-->
<!--  return d.toISOString()-->
<!--}-->

<!--function getUtcTodayStr() {-->
<!--  const d = new Date()-->
<!--  const y = d.getUTCFullYear()-->
<!--  const m = String(d.getUTCMonth() + 1).padStart(2, '0')-->
<!--  const day = String(d.getUTCDate()).padStart(2, '0')-->
<!--  return `${y}-${m}-${day}`-->
<!--}-->

<!--function computeDefaultRange() {-->
<!--  // Default: today for daily, current week for weekly, empty for all-->
<!--  const today = getUtcTodayStr()-->
<!--  start.value = today-->
<!--  end.value = today-->
<!--}-->
<!--computeDefaultRange()-->

<!--function getWeeklyWindowFromDate(dateStr: string) {-->
<!--  // Weekly resets Saturday 00:00 UTC.-->
<!--  // For a given date, compute Saturday-start week window.-->
<!--  const [y, m, d] = dateStr.split('-').map(Number)-->
<!--  if (!y || !m || !d) return null-->

<!--  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0)) // midday avoids DST issues-->
<!--  const dow = dt.getUTCDay() // 0=Sun..6=Sat-->
<!--  // find most recent Saturday-->
<!--  const daysSinceSat = (dow - 6 + 7) % 7-->
<!--  const startSat = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0))-->
<!--  startSat.setUTCDate(startSat.getUTCDate() - daysSinceSat)-->

<!--  const endSat = new Date(startSat)-->
<!--  endSat.setUTCDate(endSat.getUTCDate() + 7)-->

<!--  return { startIso: startSat.toISOString(), endIso: endSat.toISOString() }-->
<!--}-->

<!--const games = computed(() => {-->
<!--  // derive from data loaded (fallback list)-->
<!--  const set = new Set<string>()-->
<!--  for (const r of rows.value) set.add(r.game_slug)-->
<!--  return Array.from(set).sort()-->
<!--})-->

<!--const filteredRows = computed(() => {-->
<!--  const needle = q.value.trim().toLowerCase()-->
<!--  let list = rows.value.slice()-->

<!--  if (game.value !== 'all') list = list.filter(r => r.game_slug === game.value)-->

<!--  if (needle) {-->
<!--    list = list.filter(r => {-->
<!--      const s = `${r.player_name || ''} ${r.user_id} ${r.game_slug} ${r.score}`.toLowerCase()-->
<!--      return s.includes(needle)-->
<!--    })-->
<!--  }-->

<!--  return list-->
<!--})-->

<!--const summary = computed(() => {-->
<!--  const list = filteredRows.value-->
<!--  const total = list.length-->
<!--  const top = list[0]?.score ?? 0-->
<!--  let sum = 0-->
<!--  for (const r of list) sum += r.score-->
<!--  const avg = total ? Math.round(sum / total) : 0-->
<!--  return { total, top, avg }-->
<!--})-->

<!--async function load(): Promise<void> {-->
<!--  loading.value = true-->
<!--  errorMsg.value = null-->
<!--  rows.value = []-->

<!--  try {-->
<!--    const lim = clampLimit(limit.value)-->

<!--    // Base query-->
<!--    let query = supabase-->
<!--        .from('leaderboard_scores')-->
<!--        .select('id, game_slug, user_id, player_name, score, created_at')-->
<!--        .order('score', { ascending: false })-->
<!--        .order('created_at', { ascending: false })-->
<!--        .limit(lim)-->

<!--    // Time window filter-->
<!--    if (period.value === 'daily') {-->
<!--      // Use selected start date as "day"-->
<!--      const day = start.value || getUtcTodayStr()-->
<!--      const startIso = toIsoUtcStartOfDay(day)-->
<!--      if (!startIso) throw new Error('Invalid day. Use YYYY-MM-DD.')-->
<!--      const endIso = addDaysUtcIso(startIso, 1)-->

<!--      query = query.gte('created_at', startIso).lt('created_at', endIso)-->
<!--    }-->

<!--    if (period.value === 'weekly') {-->
<!--      const day = start.value || getUtcTodayStr()-->
<!--      const win = getWeeklyWindowFromDate(day)-->
<!--      if (!win) throw new Error('Invalid date. Use YYYY-MM-DD.')-->
<!--      query = query.gte('created_at', win.startIso).lt('created_at', win.endIso)-->
<!--    }-->

<!--    if (period.value === 'all') {-->
<!--      // Optional date-range for all-time admin browsing-->
<!--      const s = start.value ? toIsoUtcStartOfDay(start.value) : null-->
<!--      const e = end.value ? toIsoUtcStartOfDay(end.value) : null-->
<!--      if (s) query = query.gte('created_at', s)-->
<!--      if (e) query = query.lt('created_at', addDaysUtcIso(e, 1))-->
<!--    }-->

<!--    // Game filter (SQL side)-->
<!--    if (game.value !== 'all') {-->
<!--      query = query.eq('game_slug', game.value)-->
<!--    }-->

<!--    const { data, error } = await query-->
<!--    if (error) throw error-->

<!--    rows.value = (data || []) as unknown as ScoreRow-->
<!--  } catch (e: any) {-->
<!--    errorMsg.value = e?.message || 'Failed to load scores.'-->
<!--  } finally {-->
<!--    loading.value = false-->
<!--  }-->
<!--}-->

<!--watch([period, game], () => {-->
<!--  // adjust default date inputs for the chosen period-->
<!--  if (period.value === 'all') {-->
<!--    // keep user’s chosen range; if empty, set a reasonable default range-->
<!--    if (!start.value && !end.value) {-->
<!--      start.value = getUtcTodayStr()-->
<!--      end.value = getUtcTodayStr()-->
<!--    }-->
<!--  } else {-->
<!--    // daily/weekly use start only (day picker)-->
<!--    if (!start.value) start.value = getUtcTodayStr()-->
<!--  }-->
<!--})-->

<!--onMounted(load)-->

<!--function setQuickDay(which: 'today' | 'yesterday') {-->
<!--  const todayIso = toIsoUtcStartOfDay(getUtcTodayStr())!-->
<!--  const dayIso = which === 'today' ? todayIso : addDaysUtcIso(todayIso, -1)-->
<!--  const d = new Date(dayIso)-->
<!--  const y = d.getUTCFullYear()-->
<!--  const m = String(d.getUTCMonth() + 1).padStart(2, '0')-->
<!--  const dd = String(d.getUTCDate()).padStart(2, '0')-->
<!--  start.value = `${y}-${m}-${dd}`-->
<!--}-->

<!--function exportCsv() {-->
<!--  if (!import.meta.client) return-->
<!--  const list = filteredRows.value-->
<!--  const header = ['id', 'game_slug', 'user_id', 'player_name', 'score', 'created_at']-->
<!--  const lines = [header.join(',')]-->
<!--  for (const r of list) {-->
<!--    const row = [-->
<!--      r.id,-->
<!--      r.game_slug,-->
<!--      r.user_id,-->
<!--      (r.player_name ?? '').replace(/"/g, '""'),-->
<!--      r.score,-->
<!--      r.created_at-->
<!--    ]-->
<!--    lines.push(row.map(v => `"${String(v)}"`).join(','))-->
<!--  }-->
<!--  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })-->
<!--  const url = URL.createObjectURL(blob)-->
<!--  const a = document.createElement('a')-->
<!--  a.href = url-->
<!--  a.download = `scores_${period.value}_${game.value}_${new Date().toISOString().slice(0, 10)}.csv`-->
<!--  a.click()-->
<!--  URL.revokeObjectURL(url)-->
<!--  toast.add({ title: 'Exported', description: 'CSV downloaded.', color: 'success' })-->
<!--}-->
<!--</script>-->

<!--<template>-->
<!--  <div class="space-y-4">-->
<!--    &lt;!&ndash; Hero &ndash;&gt;-->
<!--    <div-->
<!--        class="relative overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-5 lg:p-6 backdrop-blur"-->
<!--    >-->
<!--      <div-->
<!--          class="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full blur-3xl opacity-60"-->
<!--          style="background: radial-gradient(circle at 30% 30%, rgba(34,211,238,.22), transparent 60%);"-->
<!--          aria-hidden="true"-->
<!--      />-->
<!--      <div-->
<!--          class="pointer-events-none absolute -bottom-28 -left-28 h-80 w-80 rounded-full blur-3xl opacity-60"-->
<!--          style="background: radial-gradient(circle at 30% 30%, rgba(124,58,237,.22), transparent 60%);"-->
<!--          aria-hidden="true"-->
<!--      />-->

<!--      <div class="flex flex-wrap items-end justify-between gap-4">-->
<!--        <div class="min-w-0">-->
<!--          <div-->
<!--              class="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-1.5 text-xs text-black/60 dark:text-white/60"-->
<!--          >-->
<!--            <UIcon name="i-heroicons-trophy" class="h-4 w-4" />-->
<!--            Leaderboard Scores-->
<!--          </div>-->

<!--          <h1 class="mt-3 text-2xl lg:text-3xl font-extrabold tracking-tight text-black dark:text-white">-->
<!--            Scores-->
<!--          </h1>-->

<!--          <p class="mt-1 text-sm text-black/60 dark:text-white/60 max-w-2xl">-->
<!--            View scores by <span class="font-semibold text-black dark:text-white">Daily</span> (UTC day),-->
<!--            <span class="font-semibold text-black dark:text-white">Weekly</span> (Sat 00:00 UTC reset),-->
<!--            or <span class="font-semibold text-black dark:text-white">All-time</span> (optional date range).-->
<!--          </p>-->
<!--        </div>-->

<!--        <div class="flex flex-wrap items-center gap-2">-->
<!--          <button-->
<!--              type="button"-->
<!--              class="inline-flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-4 py-2.5 text-sm hover:bg-black/10 dark:hover:bg-white/10 transition"-->
<!--              @click="load"-->
<!--          >-->
<!--            <UIcon name="i-heroicons-arrow-path" class="h-5 w-5 opacity-80" />-->
<!--            Refresh-->
<!--          </button>-->

<!--          <button-->
<!--              type="button"-->
<!--              class="inline-flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-4 py-2.5 text-sm hover:bg-black/10 dark:hover:bg-white/10 transition"-->
<!--              @click="exportCsv"-->
<!--          >-->
<!--            <UIcon name="i-heroicons-arrow-down-tray" class="h-5 w-5 opacity-80" />-->
<!--            Export CSV-->
<!--          </button>-->

<!--          <div class="inline-flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2.5">-->
<!--            <UIcon name="i-heroicons-list-bullet" class="h-4 w-4 opacity-70" />-->
<!--            <span class="text-xs text-black/60 dark:text-white/60">Limit</span>-->
<!--            <input-->
<!--                v-model.number="limit"-->
<!--                type="number"-->
<!--                min="10"-->
<!--                max="1000"-->
<!--                class="w-24 bg-transparent text-sm text-black dark:text-white outline-none"-->
<!--            />-->
<!--          </div>-->
<!--        </div>-->
<!--      </div>-->

<!--      &lt;!&ndash; Controls &ndash;&gt;-->
<!--      <div class="mt-4 grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-3">-->
<!--        &lt;!&ndash; Search &ndash;&gt;-->
<!--        <div-->
<!--            class="flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2.5 backdrop-blur"-->
<!--        >-->
<!--          <UIcon name="i-heroicons-magnifying-glass" class="h-5 w-5 opacity-60" />-->
<!--          <input-->
<!--              v-model="q"-->
<!--              type="text"-->
<!--              placeholder="Search player name, user id, score…"-->
<!--              class="w-full bg-transparent text-sm outline-none text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40"-->
<!--          />-->
<!--          <button-->
<!--              v-if="q.trim()"-->
<!--              type="button"-->
<!--              class="rounded-xl px-2 py-1 text-xs border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition"-->
<!--              @click="q = ''"-->
<!--          >-->
<!--            Clear-->
<!--          </button>-->
<!--        </div>-->

<!--        &lt;!&ndash; Filters panel &ndash;&gt;-->
<!--        <div-->
<!--            class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-3 backdrop-blur"-->
<!--        >-->
<!--          <div class="flex flex-wrap items-center gap-2 justify-between">-->
<!--            &lt;!&ndash; Period pills &ndash;&gt;-->
<!--            <div class="inline-flex rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-1">-->
<!--              <button-->
<!--                  type="button"-->
<!--                  class="px-3 py-2 rounded-xl text-sm transition"-->
<!--                  :class="period === 'daily'-->
<!--                  ? 'bg-black/10 dark:bg-white/10 text-black dark:text-white'-->
<!--                  : 'text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white'"-->
<!--                  @click="period = 'daily'"-->
<!--              >-->
<!--                Daily-->
<!--              </button>-->

<!--              <button-->
<!--                  type="button"-->
<!--                  class="px-3 py-2 rounded-xl text-sm transition"-->
<!--                  :class="period === 'weekly'-->
<!--                  ? 'bg-black/10 dark:bg-white/10 text-black dark:text-white'-->
<!--                  : 'text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white'"-->
<!--                  @click="period = 'weekly'"-->
<!--              >-->
<!--                Weekly-->
<!--              </button>-->

<!--              <button-->
<!--                  type="button"-->
<!--                  class="px-3 py-2 rounded-xl text-sm transition"-->
<!--                  :class="period === 'all'-->
<!--                  ? 'bg-black/10 dark:bg-white/10 text-black dark:text-white'-->
<!--                  : 'text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white'"-->
<!--                  @click="period = 'all'"-->
<!--              >-->
<!--                All-time-->
<!--              </button>-->
<!--            </div>-->

<!--            &lt;!&ndash; Game dropdown (simple) &ndash;&gt;-->
<!--            <div class="flex items-center gap-2">-->
<!--              <span class="text-xs text-black/60 dark:text-white/60">Game</span>-->
<!--              <select-->
<!--                  v-model="game"-->
<!--                  class="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2 text-sm text-black dark:text-white outline-none"-->
<!--              >-->
<!--                <option value="all">All games</option>-->
<!--                &lt;!&ndash; If you have a GAMES constant, replace this with that list.-->
<!--                     This auto-populates from loaded rows (works after first load). &ndash;&gt;-->
<!--                <option v-for="g in games" :key="g" :value="g">{{ g }}</option>-->
<!--              </select>-->
<!--            </div>-->
<!--          </div>-->

<!--          &lt;!&ndash; Date controls &ndash;&gt;-->
<!--          <div class="mt-3 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">-->
<!--            <div class="flex flex-wrap items-center gap-2">-->
<!--              <div class="inline-flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-2">-->
<!--                <UIcon name="i-heroicons-calendar-days" class="h-4 w-4 opacity-70" />-->
<!--                <span class="text-xs text-black/60 dark:text-white/60">-->
<!--                  <span v-if="period === 'daily'">Day (UTC)</span>-->
<!--                  <span v-else-if="period === 'weekly'">Week (pick any day)</span>-->
<!--                  <span v-else>Date range (UTC)</span>-->
<!--                </span>-->
<!--              </div>-->

<!--              <template v-if="period === 'all'">-->
<!--                <div class="inline-flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2">-->
<!--                  <span class="text-xs text-black/60 dark:text-white/60">From</span>-->
<!--                  <input-->
<!--                      v-model="start"-->
<!--                      type="date"-->
<!--                      class="bg-transparent text-sm text-black dark:text-white outline-none"-->
<!--                  />-->
<!--                </div>-->

<!--                <div class="inline-flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2">-->
<!--                  <span class="text-xs text-black/60 dark:text-white/60">To</span>-->
<!--                  <input-->
<!--                      v-model="end"-->
<!--                      type="date"-->
<!--                      class="bg-transparent text-sm text-black dark:text-white outline-none"-->
<!--                  />-->
<!--                </div>-->
<!--              </template>-->

<!--              <template v-else>-->
<!--                <div class="inline-flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2">-->
<!--                  <span class="text-xs text-black/60 dark:text-white/60">Date</span>-->
<!--                  <input-->
<!--                      v-model="start"-->
<!--                      type="date"-->
<!--                      class="bg-transparent text-sm text-black dark:text-white outline-none"-->
<!--                  />-->
<!--                </div>-->

<!--                <button-->
<!--                    type="button"-->
<!--                    class="inline-flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-2 text-xs hover:bg-black/10 dark:hover:bg-white/10 transition"-->
<!--                    @click="setQuickDay('today')"-->
<!--                >-->
<!--                  Today (UTC)-->
<!--                </button>-->

<!--                <button-->
<!--                    type="button"-->
<!--                    class="inline-flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-2 text-xs hover:bg-black/10 dark:hover:bg-white/10 transition"-->
<!--                    @click="setQuickDay('yesterday')"-->
<!--                >-->
<!--                  Yesterday (UTC)-->
<!--                </button>-->
<!--              </template>-->
<!--            </div>-->

<!--            <div class="flex items-center justify-end">-->
<!--              <button-->
<!--                  type="button"-->
<!--                  class="w-full md:w-auto inline-flex items-center justify-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-black text-white dark:bg-white dark:text-black px-4 py-2.5 text-sm font-semibold hover:opacity-90 transition"-->
<!--                  @click="load"-->
<!--              >-->
<!--                <UIcon name="i-heroicons-funnel" class="h-5 w-5" />-->
<!--                Apply-->
<!--              </button>-->
<!--            </div>-->
<!--          </div>-->

<!--          <div class="mt-2 text-xs text-black/60 dark:text-white/60">-->
<!--            Daily resets <span class="font-semibold text-black dark:text-white">00:00 UTC</span>.-->
<!--            Weekly resets <span class="font-semibold text-black dark:text-white">Saturday 00:00 UTC</span>.-->
<!--          </div>-->
<!--        </div>-->
<!--      </div>-->

<!--      &lt;!&ndash; Summary chips &ndash;&gt;-->
<!--      <div class="mt-3 flex flex-wrap items-center gap-2 text-xs text-black/60 dark:text-white/60">-->
<!--        <span class="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-1.5">-->
<!--          <UIcon name="i-heroicons-queue-list" class="h-4 w-4 opacity-70" />-->
<!--          Showing <span class="font-semibold text-black dark:text-white">{{ summary.total }}</span> rows-->
<!--        </span>-->

<!--        <span class="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-1.5">-->
<!--          <UIcon name="i-heroicons-arrow-trending-up" class="h-4 w-4 opacity-70" />-->
<!--          Top <span class="font-semibold text-black dark:text-white tabular-nums">{{ summary.top }}</span>-->
<!--        </span>-->

<!--        <span class="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-1.5">-->
<!--          <UIcon name="i-heroicons-calculator" class="h-4 w-4 opacity-70" />-->
<!--          Avg <span class="font-semibold text-black dark:text-white tabular-nums">{{ summary.avg }}</span>-->
<!--        </span>-->

<!--        <span v-if="loading" class="inline-flex items-center gap-2 rounded-full px-3 py-1.5 border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">-->
<!--          <span class="h-2 w-2 rounded-full animate-pulse bg-cyan-400" />-->
<!--          Loading…-->
<!--        </span>-->
<!--      </div>-->
<!--    </div>-->

<!--    &lt;!&ndash; Table &ndash;&gt;-->
<!--    <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur overflow-hidden">-->
<!--      <div v-if="errorMsg" class="p-4">-->
<!--        <div class="text-sm text-black dark:text-white">❌ {{ errorMsg }}</div>-->
<!--        <div class="mt-3">-->
<!--          <button-->
<!--              type="button"-->
<!--              class="inline-flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-4 py-2.5 text-sm hover:bg-black/10 dark:hover:bg-white/10 transition"-->
<!--              @click="load"-->
<!--          >-->
<!--            <UIcon name="i-heroicons-arrow-path" class="h-5 w-5 opacity-80" />-->
<!--            Retry-->
<!--          </button>-->
<!--        </div>-->
<!--      </div>-->

<!--      <div v-else class="overflow-auto">-->
<!--        <table class="w-full text-sm">-->
<!--          <thead class="text-black/60 dark:text-white/60">-->
<!--          <tr class="text-left border-b border-black/10 dark:border-white/10">-->
<!--            <th class="py-3 px-4">#</th>-->
<!--            <th class="py-3 px-4">Player</th>-->
<!--            <th class="py-3 px-4">Game</th>-->
<!--            <th class="py-3 px-4">Score</th>-->
<!--            <th class="py-3 px-4 hidden md:table-cell">Achieved</th>-->
<!--            <th class="py-3 px-4 hidden lg:table-cell">User</th>-->
<!--          </tr>-->
<!--          </thead>-->

<!--          <tbody>-->
<!--          <tr-->
<!--              v-for="(r, i) in filteredRows"-->
<!--              :key="`${r.id}`"-->
<!--              class="border-b border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition"-->
<!--          >-->
<!--            <td class="py-3 px-4 text-black/60 dark:text-white/60 tabular-nums">{{ i + 1 }}</td>-->

<!--            <td class="py-3 px-4 min-w-[220px]">-->
<!--              <div class="flex items-center gap-3 min-w-0">-->
<!--                <div class="h-10 w-10 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 grid place-items-center shrink-0">-->
<!--                  <UIcon name="i-heroicons-user" class="h-5 w-5 opacity-70" />-->
<!--                </div>-->
<!--                <div class="min-w-0">-->
<!--                  <div class="font-semibold text-black dark:text-white truncate">-->
<!--                    {{ r.player_name || 'Unknown' }}-->
<!--                  </div>-->
<!--                  <div class="text-xs text-black/60 dark:text-white/60 md:hidden">-->
<!--                    {{ fmtDate(r.created_at) }}-->
<!--                  </div>-->
<!--                </div>-->
<!--              </div>-->
<!--            </td>-->

<!--            <td class="py-3 px-4">-->
<!--                <span class="rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-1.5 text-xs text-black/70 dark:text-white/70">-->
<!--                  {{ r.game_slug }}-->
<!--                </span>-->
<!--            </td>-->

<!--            <td class="py-3 px-4 font-extrabold text-black dark:text-white tabular-nums">-->
<!--              {{ r.score }}-->
<!--            </td>-->

<!--            <td class="py-3 px-4 hidden md:table-cell text-black/60 dark:text-white/60 whitespace-nowrap">-->
<!--              {{ fmtDate(r.created_at) }}-->
<!--            </td>-->

<!--            <td class="py-3 px-4 hidden lg:table-cell text-black/60 dark:text-white/60">-->
<!--              <span class="font-mono text-xs">{{ r.user_id.slice(0, 8) }}…{{ r.user_id.slice(-6) }}</span>-->
<!--            </td>-->
<!--          </tr>-->

<!--          <tr v-if="!loading && filteredRows.length === 0">-->
<!--            <td colspan="6" class="py-10 text-center text-black/60 dark:text-white/60">-->
<!--              No scores found for this filter.-->
<!--            </td>-->
<!--          </tr>-->

<!--          <tr v-if="loading">-->
<!--            <td colspan="6" class="py-8">-->
<!--              <div class="px-4 grid gap-2">-->
<!--                <div class="h-10 rounded-2xl bg-black/10 dark:bg-white/10 animate-pulse" />-->
<!--                <div class="h-10 rounded-2xl bg-black/10 dark:bg-white/10 animate-pulse" />-->
<!--                <div class="h-10 rounded-2xl bg-black/10 dark:bg-white/10 animate-pulse" />-->
<!--              </div>-->
<!--            </td>-->
<!--          </tr>-->
<!--          </tbody>-->
<!--        </table>-->
<!--      </div>-->
<!--    </div>-->

<!--    &lt;!&ndash; Persisted Daily/Weekly winners note &ndash;&gt;-->
<!--    <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-5 backdrop-blur">-->
<!--      <div class="flex items-start gap-3">-->
<!--        <div class="mt-0.5 h-10 w-10 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 grid place-items-center shrink-0">-->
<!--          <UIcon name="i-heroicons-light-bulb" class="h-5 w-5 opacity-70" />-->
<!--        </div>-->

<!--        <div class="min-w-0">-->
<!--          <div class="font-extrabold text-black dark:text-white">Daily/Weekly winners “stored” (recommended)</div>-->
<!--          <div class="mt-1 text-sm text-black/60 dark:text-white/60">-->
<!--            Right now Daily/Weekly are computed by time window from <code class="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10">leaderboard_scores</code>.-->
<!--            If you want <b>datewise</b> and <b>weekwise</b> winners permanently stored (fast & consistent),-->
<!--            we can create tables like <code class="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10">leaderboard_daily_best</code> and-->
<!--            <code class="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10">leaderboard_weekly_best</code>,-->
<!--            and fill them with a scheduled job (Supabase cron) or trigger-based upserts.-->
<!--          </div>-->
<!--        </div>-->
<!--      </div>-->
<!--    </div>-->
<!--  </div>-->
<!--</template>-->

<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: ['admin']
})

useHead({ title: 'Admin — Scores' })

const supabase = useSupabaseClient()
const toast = useToast()

type Period = 'daily' | 'weekly' | 'all'

type ScoreRow = {
  id: number
  game_slug: string
  user_id: string
  player_name: string | null
  score: number
  created_at: string
  // optional fields that exist on stored tables but not required for UI:
  date?: string
  week_start?: string
  week_end?: string
  source_score_id?: number | null
}

const loading = ref(true)
const errorMsg = ref<string | null>(null)

const q = ref('')
const game = ref<string>('all')
const period = ref<Period>('daily')
const limit = ref<number>(200)

// Filters for stored winners
const day = ref<string>('')        // YYYY-MM-DD (daily)
const weekStart = ref<string>('')  // YYYY-MM-DD (weekly week_start)

// Optional range for all-time browsing
const start = ref<string>('') // YYYY-MM-DD
const end = ref<string>('')   // YYYY-MM-DD

const rows = ref<ScoreRow[]>([])
const knownGames = ref<string[]>([]) // stable list (learned from data)

function clampLimit(n: number) {
  if (!Number.isFinite(n)) return 200
  return Math.max(10, Math.min(Math.floor(n), 1000))
}

function fmtDate(ts: string) {
  const iso = ts?.includes('T') ? ts : String(ts || '').replace(' ', 'T')
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ts
  return d.toLocaleString()
}

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

// Weekly resets Saturday 00:00 UTC.
// If the admin picks any date, compute the week_start (Saturday) for that date.
function computeWeekStartFromDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return null

  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0)) // midday safe
  const dow = dt.getUTCDay() // 0=Sun..6=Sat
  const daysSinceSat = (dow - 6 + 7) % 7

  const startSat = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0))
  startSat.setUTCDate(startSat.getUTCDate() - daysSinceSat)

  const yy = startSat.getUTCFullYear()
  const mm = String(startSat.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(startSat.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function initDefaults() {
  const today = getUtcTodayStr()
  if (!day.value) day.value = today
  if (!weekStart.value) weekStart.value = computeWeekStartFromDate(today) || today
  if (!start.value) start.value = today
  if (!end.value) end.value = today
}
initDefaults()

const games = computed(() => {
  // Prefer stable knownGames list; fallback to rows-derived.
  if (knownGames.value.length) return knownGames.value
  const set = new Set<string>()
  for (const r of rows.value) set.add(r.game_slug)
  return Array.from(set).sort()
})

const filteredRows = computed(() => {
  const needle = q.value.trim().toLowerCase()
  let list = rows.value.slice()

  if (game.value !== 'all') list = list.filter(r => r.game_slug === game.value)

  if (needle) {
    list = list.filter(r => {
      const s = `${r.player_name || ''} ${r.user_id} ${r.game_slug} ${r.score}`.toLowerCase()
      return s.includes(needle)
    })
  }

  return list
})

const summary = computed(() => {
  const list = filteredRows.value
  const total = list.length
  const top = list[0]?.score ?? 0
  let sum = 0
  for (const r of list) sum += r.score
  const avg = total ? Math.round(sum / total) : 0
  return { total, top, avg }
})

const titleHint = computed(() => {
  if (period.value === 'daily') return `Daily winners • ${day.value || getUtcTodayStr()} (UTC)`
  if (period.value === 'weekly') return `Weekly winners • week_start ${weekStart.value || ''} (UTC)`
  return `All-time scores • optional range (UTC)`
})

async function loadGamesCatalogOnce() {
  // Try to learn all game slugs from any table quickly.
  // If RLS blocks, ignore—UI still works with "All games" + rows derived.
  try {
    const { data: d1 } = await supabase.from('leaderboard_scores').select('game_slug').limit(500)
    const { data: d2 } = await supabase.from('leaderboard_daily_best').select('game_slug').limit(500)
    const { data: d3 } = await supabase.from('leaderboard_weekly_best').select('game_slug').limit(500)
    const set = new Set<string>()
    ;[d1, d2, d3].forEach(arr => {
      if (!Array.isArray(arr)) return
      for (const r of arr as any[]) if (r?.game_slug) set.add(String(r.game_slug))
    })
    const list = Array.from(set).sort()
    if (list.length) knownGames.value = list
  } catch {
    // ignore
  }
}

async function load(): Promise<void> {
  loading.value = true
  errorMsg.value = null
  rows.value = []

  try {
    const lim = clampLimit(limit.value)

    // Choose source table by period
    let query: any

    if (period.value === 'daily') {
      const d = day.value || getUtcTodayStr()
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error('Invalid day. Use YYYY-MM-DD.')
      query = supabase
          .from('leaderboard_daily_best')
          .select('id, game_slug, user_id, player_name, score, created_at, date')
          .eq('date', d)
          .order('score', { ascending: false })
          .limit(lim)

      if (game.value !== 'all') query = query.eq('game_slug', game.value)
    }

    else if (period.value === 'weekly') {
      let ws = weekStart.value
      if (!ws) {
        ws = computeWeekStartFromDate(getUtcTodayStr()) || getUtcTodayStr()
        weekStart.value = ws
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ws)) throw new Error('Invalid week_start. Use YYYY-MM-DD.')
      query = supabase
          .from('leaderboard_weekly_best')
          .select('id, game_slug, user_id, player_name, score, created_at, week_start, week_end')
          .eq('week_start', ws)
          .order('score', { ascending: false })
          .limit(lim)

      if (game.value !== 'all') query = query.eq('game_slug', game.value)
    }

    else {
      // all-time scores with optional date range
      query = supabase
          .from('leaderboard_scores')
          .select('id, game_slug, user_id, player_name, score, created_at')
          .order('score', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(lim)

      if (game.value !== 'all') query = query.eq('game_slug', game.value)

      const s = start.value ? toIsoUtcStartOfDay(start.value) : null
      const e = end.value ? toIsoUtcStartOfDay(end.value) : null
      if (s) query = query.gte('created_at', s)
      if (e) query = query.lt('created_at', addDaysUtcIso(e, 1))
    }

    const { data, error } = await query
    if (error) throw error

    rows.value = Array.isArray(data) ? (data as unknown as ScoreRow[]) : []
  } catch (e: any) {
    errorMsg.value = e?.message || 'Failed to load scores.'
  } finally {
    loading.value = false
  }
}

watch(period, () => {
  // Keep inputs sane for the selected period
  const today = getUtcTodayStr()
  if (period.value === 'daily') {
    if (!day.value) day.value = today
  } else if (period.value === 'weekly') {
    if (!weekStart.value) weekStart.value = computeWeekStartFromDate(today) || today
  } else {
    if (!start.value) start.value = today
    if (!end.value) end.value = today
  }
})

function setQuickDay(which: 'today' | 'yesterday') {
  const todayIso = toIsoUtcStartOfDay(getUtcTodayStr())!
  const dayIso = which === 'today' ? todayIso : addDaysUtcIso(todayIso, -1)
  const d = new Date(dayIso)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  day.value = `${y}-${m}-${dd}`
}

function setQuickWeek(which: 'this' | 'prev') {
  const today = getUtcTodayStr()
  const ws = computeWeekStartFromDate(today) || today
  if (which === 'this') {
    weekStart.value = ws
    return
  }
  // prev week = ws - 7 days
  const wsIso = toIsoUtcStartOfDay(ws)!
  const prev = addDaysUtcIso(wsIso, -7)
  const d = new Date(prev)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  weekStart.value = `${y}-${m}-${dd}`
}

function exportCsv() {
  if (!import.meta.client) return
  const list = filteredRows.value
  const header = ['id', 'game_slug', 'user_id', 'player_name', 'score', 'created_at']
  const lines = [header.join(',')]
  for (const r of list) {
    const row = [
      r.id,
      r.game_slug,
      r.user_id,
      (r.player_name ?? '').replace(/"/g, '""'),
      r.score,
      r.created_at
    ]
    lines.push(row.map(v => `"${String(v)}"`).join(','))
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `scores_${period.value}_${game.value}_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
  toast.add({ title: 'Exported', description: 'CSV downloaded.', color: 'success' })
}

onMounted(async () => {
  await loadGamesCatalogOnce()
  await load()
})
</script>

<template>
  <div class="space-y-4">
    <!-- HERO -->
    <div
        class="relative overflow-hidden rounded-[28px] border border-black/10 dark:border-white/10 bg-white/75 dark:bg-white/[0.06] p-5 lg:p-6 backdrop-blur"
    >
      <!-- neon blobs -->
      <div
          class="pointer-events-none absolute -top-28 -right-28 h-80 w-80 rounded-full blur-3xl opacity-60"
          style="background: radial-gradient(circle at 30% 30%, rgba(34,211,238,.20), transparent 60%);"
          aria-hidden="true"
      />
      <div
          class="pointer-events-none absolute -bottom-28 -left-28 h-96 w-96 rounded-full blur-3xl opacity-60"
          style="background: radial-gradient(circle at 30% 30%, rgba(124,58,237,.18), transparent 60%);"
          aria-hidden="true"
      />
      <div
          class="pointer-events-none absolute top-10 left-1/2 -translate-x-1/2 h-64 w-64 rounded-full blur-3xl opacity-30"
          style="background: radial-gradient(circle at 30% 30%, rgba(34,197,94,.14), transparent 62%);"
          aria-hidden="true"
      />

      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="min-w-0">
          <div class="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-1.5 text-xs text-black/60 dark:text-white/60">
            <UIcon name="i-heroicons-trophy" class="h-4 w-4" />
            Leaderboard Admin
          </div>

          <h1 class="mt-3 text-2xl lg:text-3xl font-extrabold tracking-tight text-black dark:text-white">
            Scores & Winners
          </h1>

          <p class="mt-1 text-sm text-black/60 dark:text-white/60 max-w-2xl">
            Daily and Weekly winners are loaded from <span class="font-semibold text-black dark:text-white">stored</span> tables
            (cron-filled). All-time shows raw scores.
          </p>

          <div class="mt-2 text-xs text-black/60 dark:text-white/60">
            <span class="font-semibold text-black dark:text-white">{{ titleHint }}</span>
            • Daily resets <span class="font-semibold text-black dark:text-white">00:00 UTC</span>
            • Weekly resets <span class="font-semibold text-black dark:text-white">Saturday 00:00 UTC</span>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button
              type="button"
              class="inline-flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-4 py-2.5 text-sm hover:bg-black/10 dark:hover:bg-white/10 transition"
              @click="load"
          >
            <UIcon name="i-heroicons-arrow-path" class="h-5 w-5 opacity-80" />
            Refresh
          </button>

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
            <span class="text-xs text-black/60 dark:text-white/60">Limit</span>
            <input
                v-model.number="limit"
                type="number"
                min="10"
                max="1000"
                class="w-24 bg-transparent text-sm text-black dark:text-white outline-none"
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
              placeholder="Search player, user id, score, game…"
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

        <!-- Filter panel -->
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

            <!-- Game select -->
            <div class="flex items-center gap-2">
              <span class="text-xs text-black/60 dark:text-white/60">Game</span>
              <select
                  v-model="game"
                  class="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2 text-sm text-black dark:text-white outline-none"
              >
                <option value="all">All games</option>
                <option v-for="g in games" :key="g" :value="g">{{ g }}</option>
              </select>
            </div>
          </div>

          <!-- Date controls -->
          <div class="mt-3 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
            <div class="flex flex-wrap items-center gap-2">
              <div class="inline-flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-2">
                <UIcon name="i-heroicons-calendar-days" class="h-4 w-4 opacity-70" />
                <span class="text-xs text-black/60 dark:text-white/60">
                  <span v-if="period === 'daily'">Day (UTC)</span>
                  <span v-else-if="period === 'weekly'">Week start (Saturday UTC)</span>
                  <span v-else>Date range (UTC)</span>
                </span>
              </div>

              <!-- Daily -->
              <template v-if="period === 'daily'">
                <div class="inline-flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2">
                  <span class="text-xs text-black/60 dark:text-white/60">Date</span>
                  <input v-model="day" type="date" class="bg-transparent text-sm text-black dark:text-white outline-none" />
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
              </template>

              <!-- Weekly -->
              <template v-else-if="period === 'weekly'">
                <div class="inline-flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2">
                  <span class="text-xs text-black/60 dark:text-white/60">Week start</span>
                  <input
                      v-model="weekStart"
                      type="date"
                      class="bg-transparent text-sm text-black dark:text-white outline-none"
                  />
                </div>

                <button
                    type="button"
                    class="inline-flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-2 text-xs hover:bg-black/10 dark:hover:bg-white/10 transition"
                    @click="setQuickWeek('this')"
                >
                  This week
                </button>

                <button
                    type="button"
                    class="inline-flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-2 text-xs hover:bg-black/10 dark:hover:bg-white/10 transition"
                    @click="setQuickWeek('prev')"
                >
                  Previous week
                </button>
              </template>

              <!-- All -->
              <template v-else>
                <div class="inline-flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2">
                  <span class="text-xs text-black/60 dark:text-white/60">From</span>
                  <input v-model="start" type="date" class="bg-transparent text-sm text-black dark:text-white outline-none" />
                </div>

                <div class="inline-flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2">
                  <span class="text-xs text-black/60 dark:text-white/60">To</span>
                  <input v-model="end" type="date" class="bg-transparent text-sm text-black dark:text-white outline-none" />
                </div>
              </template>
            </div>

            <div class="flex items-center justify-end">
              <button
                  type="button"
                  class="w-full md:w-auto inline-flex items-center justify-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-black text-white dark:bg-white dark:text-black px-4 py-2.5 text-sm font-semibold hover:opacity-90 transition"
                  @click="load"
              >
                <UIcon name="i-heroicons-funnel" class="h-5 w-5" />
                Apply
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Summary chips -->
      <div class="mt-3 flex flex-wrap items-center gap-2 text-xs text-black/60 dark:text-white/60">
        <span class="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-1.5">
          <UIcon name="i-heroicons-queue-list" class="h-4 w-4 opacity-70" />
          Rows <span class="font-semibold text-black dark:text-white">{{ summary.total }}</span>
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
      </div>
    </div>

    <!-- TABLE -->
    <div class="rounded-[28px] border border-black/10 dark:border-white/10 bg-white/75 dark:bg-white/[0.06] backdrop-blur overflow-hidden">
      <div v-if="errorMsg" class="p-4">
        <div class="text-sm text-black dark:text-white">❌ {{ errorMsg }}</div>
        <div class="mt-3">
          <button
              type="button"
              class="inline-flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-4 py-2.5 text-sm hover:bg-black/10 dark:hover:bg-white/10 transition"
              @click="load"
          >
            <UIcon name="i-heroicons-arrow-path" class="h-5 w-5 opacity-80" />
            Retry
          </button>
        </div>
      </div>

      <div v-else class="overflow-auto">
        <table class="w-full text-sm">
          <thead class="text-black/60 dark:text-white/60">
          <tr class="text-left border-b border-black/10 dark:border-white/10">
            <th class="py-3 px-4">#</th>
            <th class="py-3 px-4">Player</th>
            <th class="py-3 px-4">Game</th>
            <th class="py-3 px-4">Score</th>
            <th class="py-3 px-4 hidden md:table-cell">Achieved</th>
            <th class="py-3 px-4 hidden lg:table-cell">User</th>
          </tr>
          </thead>

          <tbody>
          <tr
              v-for="(r, i) in filteredRows"
              :key="`${r.id}`"
              class="border-b border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition"
          >
            <td class="py-3 px-4 text-black/60 dark:text-white/60 tabular-nums">{{ i + 1 }}</td>

            <td class="py-3 px-4 min-w-[220px]">
              <div class="flex items-center gap-3 min-w-0">
                <div class="h-10 w-10 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 grid place-items-center shrink-0">
                  <UIcon name="i-heroicons-user" class="h-5 w-5 opacity-70" />
                </div>
                <div class="min-w-0">
                  <div class="font-semibold text-black dark:text-white truncate">
                    {{ r.player_name || 'Unknown' }}
                    <span
                        v-if="period !== 'all'"
                        class="ml-2 inline-flex items-center rounded-full border border-yellow-500/25 bg-yellow-500/10 px-2 py-0.5 text-[11px] font-bold text-yellow-700 dark:text-yellow-300"
                    >
                        Winner
                      </span>
                  </div>
                  <div class="text-xs text-black/60 dark:text-white/60 md:hidden">
                    {{ fmtDate(r.created_at) }}
                  </div>
                </div>
              </div>
            </td>

            <td class="py-3 px-4">
                <span class="rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-1.5 text-xs text-black/70 dark:text-white/70">
                  {{ r.game_slug }}
                </span>
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

          <tr v-if="!loading && filteredRows.length === 0">
            <td colspan="6" class="py-10 text-center text-black/60 dark:text-white/60">
              No scores found for this filter.
            </td>
          </tr>

          <tr v-if="loading">
            <td colspan="6" class="py-8">
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

    <!-- NOTE -->
    <div class="rounded-[28px] border border-black/10 dark:border-white/10 bg-white/75 dark:bg-white/[0.06] p-5 backdrop-blur">
      <div class="flex items-start gap-3">
        <div class="mt-0.5 h-10 w-10 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 grid place-items-center shrink-0">
          <UIcon name="i-heroicons-light-bulb" class="h-5 w-5 opacity-70" />
        </div>

        <div class="min-w-0">
          <div class="font-extrabold text-black dark:text-white">Stored winners (fast + consistent)</div>
          <div class="mt-1 text-sm text-black/60 dark:text-white/60">
            <b>Daily</b> reads from <code class="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10">leaderboard_daily_best</code>
            and <b>Weekly</b> reads from <code class="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10">leaderboard_weekly_best</code>.
            Those tables are filled by your Vercel Cron API routes.
          </div>
        </div>
      </div>
    </div>
  </div>
</template>



