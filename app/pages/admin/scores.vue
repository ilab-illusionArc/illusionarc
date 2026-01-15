<script setup lang="ts">
definePageMeta({ layout: 'admin' })
useHead({ title: 'Admin · Scores — illusion Arc' })

type TabKey = 'raw' | 'daily' | 'weekly'

type RawRow = {
  id: number
  game_slug: string
  user_id: string
  player_name: string | null
  score: number
  created_at: string
}

type DailyRow = {
  id: number
  day: string // date as string
  game_slug: string
  user_id: string
  player_name: string | null
  score: number
  updated_at: string
}

type WeeklyRow = {
  id: number
  week_start: string // date as string
  game_slug: string
  user_id: string
  player_name: string | null
  score: number
  updated_at: string
}

const supabase = useSupabaseClient()
const sb: any = supabase
const toast = useToast()

const tab = ref<TabKey>('daily')

const loading = ref(false)
const game = ref<string>('all')
const limit = ref<number>(100)

const q = ref('')

// date filters
const todayISO = new Date().toISOString().slice(0, 10) // YYYY-MM-DD (UTC)
const day = ref<string>(todayISO)

// week filter (store as week_start date)
function startOfWeekISO(d = new Date()) {
  // Monday start (ISO). If you prefer Sunday, change logic.
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dayOfWeek = x.getUTCDay() || 7 // Sunday=7
  x.setUTCDate(x.getUTCDate() - (dayOfWeek - 1))
  return x.toISOString().slice(0, 10)
}
const weekStart = ref<string>(startOfWeekISO(new Date()))

// datasets
const raw = ref<RawRow[]>([])
const daily = ref<DailyRow[]>([])
const weekly = ref<WeeklyRow[]>([])

// games list for dropdown
const games = computed(() => {
  const set = new Set<string>()
  for (const r of raw.value) set.add(r.game_slug)
  for (const r of daily.value) set.add(r.game_slug)
  for (const r of weekly.value) set.add(r.game_slug)
  return ['all', ...Array.from(set).sort()]
})

// selected modal
const selected = ref<RawRow | DailyRow | WeeklyRow | null>(null)
const isModalOpen = computed({
  get: () => !!selected.value,
  set: (v) => { if (!v) selected.value = null }
})

function fmtTime(v: string) {
  try { return new Date(v).toLocaleString() } catch { return v }
}
function clip(s: string, n = 110) {
  const t = String(s || '')
  return t.length <= n ? t : t.slice(0, n - 1) + '…'
}

function matchesQuery(row: any) {
  const query = q.value.trim().toLowerCase()
  if (!query) return true
  const hay = `${row.player_name || ''} ${row.user_id || ''} ${row.game_slug || ''}`.toLowerCase()
  return hay.includes(query)
}

const viewRows = computed(() => {
  const g = game.value
  if (tab.value === 'raw') {
    return raw.value
      .filter(r => (g === 'all' ? true : r.game_slug === g))
      .filter(matchesQuery)
  }
  if (tab.value === 'daily') {
    return daily.value
      .filter(r => (g === 'all' ? true : r.game_slug === g))
      .filter(matchesQuery)
  }
  return weekly.value
    .filter(r => (g === 'all' ? true : r.game_slug === g))
    .filter(matchesQuery)
})

// ranking view
const ranked = computed(() => {
  const list = viewRows.value.slice().sort((a: any, b: any) => (b.score || 0) - (a.score || 0))
  return list.map((r: any, idx: number) => ({ rank: idx + 1, ...r }))
})

// main loader
async function load(): Promise<void> {
  loading.value = true
  selected.value = null

  try {
    // Raw is useful to populate games dropdown & debug.
    // Load a small chunk only (latest)
    const { data: rawData, error: rawErr } = await sb
      .from('leaderboard_scores')
      .select('id, game_slug, user_id, player_name, score, created_at')
      .order('created_at', { ascending: false })
      .limit(400)

    if (rawErr) throw rawErr
    raw.value = (rawData || []) as RawRow[]

    if (tab.value === 'daily') {
      // If you created stored daily table: leaderboard_daily_scores
      // If you haven't created it yet, do the SQL below first.
      let qy = sb
        .from('leaderboard_daily_scores')
        .select('id, day, game_slug, user_id, player_name, score, updated_at')
        .eq('day', day.value)
        .order('score', { ascending: false })
        .limit(limit.value)

      if (game.value !== 'all') qy = qy.eq('game_slug', game.value)

      const { data, error } = await qy
      if (error) throw error
      daily.value = (data || []) as DailyRow[]
      weekly.value = []
      return
    }

    if (tab.value === 'weekly') {
      let qy = sb
        .from('leaderboard_weekly_scores')
        .select('id, week_start, game_slug, user_id, player_name, score, updated_at')
        .eq('week_start', weekStart.value)
        .order('score', { ascending: false })
        .limit(limit.value)

      if (game.value !== 'all') qy = qy.eq('game_slug', game.value)

      const { data, error } = await qy
      if (error) throw error
      weekly.value = (data || []) as WeeklyRow[]
      daily.value = []
      return
    }

    // raw tab (latest)
    daily.value = []
    weekly.value = []
  } catch (e: any) {
    toast.add({
      title: 'Failed to load scores',
      description: String(e?.message || 'Unknown error'),
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

// optional: refresh stored snapshots (calls SQL function you’ll create below)
const refreshing = ref(false)
async function refreshSnapshots(): Promise<void> {
  refreshing.value = true
  try {
    // you will create this RPC in SQL: public.refresh_score_snapshots(day date, week_start date)
    const { error } = await sb.rpc('refresh_score_snapshots', {
      day: day.value,
      week_start: weekStart.value
    })
    if (error) throw error

    toast.add({ title: 'Refreshed', description: 'Daily/weekly snapshots updated.', color: 'success' })
    await load()
  } catch (e: any) {
    toast.add({
      title: 'Refresh failed',
      description: String(e?.message || 'Create refresh_score_snapshots() first.'),
      color: 'warning'
    })
  } finally {
    refreshing.value = false
  }
}

watch([tab, game, day, weekStart, limit], () => {
  // avoid spamming reload while typing query
  load()
})

onMounted(load)
</script>

<template>
  <div class="page">
    <!-- Header -->
    <div class="head">
      <div>
        <div class="title">Scores</div>
        <div class="sub">Raw scores + stored daily/weekly leaderboards.</div>
      </div>

      <div class="actions">
        <UButton variant="soft" :loading="loading" @click="load">
          <UIcon name="i-heroicons-arrow-path" class="w-4 h-4" />
          Refresh
        </UButton>

        <UButton color="primary" variant="solid" :loading="refreshing" @click="refreshSnapshots">
          <UIcon name="i-heroicons-bolt" class="w-4 h-4" />
          Refresh snapshots
        </UButton>
      </div>
    </div>

    <!-- Controls -->
    <div class="toolbar">
      <div class="topRow">
        <UTabs
          v-model="tab"
          :items="[
            { label: 'Daily', value: 'daily' },
            { label: 'Weekly', value: 'weekly' },
            { label: 'Raw', value: 'raw' }
          ]"
        />

        <UInput v-model="q" icon="i-heroicons-magnifying-glass" placeholder="Search player/user/game…" class="w-full" />
      </div>

      <div class="filters">
        <USelect
          v-model="game"
          :options="games.map(g => ({ label: g === 'all' ? 'All games' : g, value: g }))"
        />

        <UInput v-if="tab === 'daily'" v-model="day" type="date" />
        <UInput v-if="tab === 'weekly'" v-model="weekStart" type="date" />

        <USelect
          v-model="limit"
          :options="[
            { label: 'Top 50', value: 50 },
            { label: 'Top 100', value: 100 },
            { label: 'Top 200', value: 200 }
          ]"
        />
      </div>
    </div>

    <!-- Card -->
    <div class="card">
      <div class="cardHead">
        <div class="meta">
          <div class="k">Showing</div>
          <div class="v">{{ ranked.length }}</div>
        </div>

        <div class="dim" v-if="tab === 'daily'">Day: {{ day }}</div>
        <div class="dim" v-else-if="tab === 'weekly'">Week start: {{ weekStart }}</div>
        <div class="dim" v-else>Latest raw scores</div>
      </div>

      <div v-if="loading" class="skeleton">
        <div v-for="i in 10" :key="i" class="skRow" />
      </div>

      <div v-else-if="ranked.length === 0" class="empty">
        No scores found.
      </div>

      <div v-else class="tableWrap">
        <table class="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>Game</th>
              <th>Score</th>
              <th v-if="tab === 'raw'">Created</th>
              <th v-else-if="tab === 'daily'">Day</th>
              <th v-else>Week</th>
              <th class="rightCol">Details</th>
            </tr>
          </thead>

          <tbody>
            <tr v-for="r in ranked" :key="r.id" class="tr" @click="selected = r">
              <td class="rank">{{ r.rank }}</td>

              <td class="player">
                <div class="nm">{{ r.player_name || '—' }}</div>
                <div class="dim mono">{{ r.user_id }}</div>
              </td>

              <td class="game">{{ r.game_slug }}</td>

              <td class="score">{{ r.score }}</td>

              <td v-if="tab === 'raw'" class="dim">{{ fmtTime(r.created_at) }}</td>
              <td v-else-if="tab === 'daily'" class="dim">{{ r.day }}</td>
              <td v-else class="dim">{{ r.week_start }}</td>

              <td class="rightCol dim">Open</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Detail Modal -->
    <UModal v-model="isModalOpen" :ui="{ content: 'sm:max-w-2xl' }">
      <div v-if="selected" class="modal">
        <div class="mHead">
          <div>
            <div class="big">Score Detail</div>
            <div class="dim">{{ selected.game_slug }} · {{ selected.score }}</div>
          </div>

          <UButton variant="soft" @click="isModalOpen = false">Close</UButton>
        </div>

        <div class="mBody">
          <div class="block">
            <div class="k">Player</div>
            <div class="v">{{ selected.player_name || '—' }}</div>
          </div>

          <div class="block">
            <div class="k">User ID</div>
            <div class="v mono">{{ (selected as any).user_id }}</div>
          </div>

          <div class="grid2">
            <div class="block">
              <div class="k">Game</div>
              <div class="v">{{ selected.game_slug }}</div>
            </div>
            <div class="block">
              <div class="k">Score</div>
              <div class="v">{{ selected.score }}</div>
            </div>
          </div>

          <div class="block" v-if="(selected as any).created_at">
            <div class="k">Created</div>
            <div class="v">{{ fmtTime((selected as any).created_at) }}</div>
          </div>
          <div class="block" v-else-if="(selected as any).day">
            <div class="k">Day</div>
            <div class="v">{{ (selected as any).day }}</div>
          </div>
          <div class="block" v-else>
            <div class="k">Week start</div>
            <div class="v">{{ (selected as any).week_start }}</div>
          </div>

          <div class="block" v-if="(selected as any).updated_at">
            <div class="k">Snapshot updated</div>
            <div class="v">{{ fmtTime((selected as any).updated_at) }}</div>
          </div>
        </div>
      </div>
    </UModal>
  </div>
</template>

<style scoped>
.page { display: grid; gap: 14px; }

.head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  padding: 14px;
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.06);
  backdrop-filter: blur(10px);
}
.title { font-size: 1.35rem; font-weight: 900; letter-spacing: -.02em; }
.sub { opacity: .7; margin-top: 4px; }
.actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }

.toolbar{
  display: grid;
  gap: 12px;
  padding: 12px;
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.05);
  backdrop-filter: blur(10px);
}
.topRow { display: grid; gap: 10px; grid-template-columns: auto 1fr; align-items: center; }
.filters { display: flex; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }

.card{
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.05);
  backdrop-filter: blur(10px);
  overflow: hidden;
}
.cardHead{
  display:flex; align-items:center; justify-content:space-between; gap:10px;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(255,255,255,.08);
  background: rgba(0,0,0,.10);
}
.meta { display:flex; gap:10px; align-items: baseline; }
.k { font-size:.8rem; opacity:.7; }
.v { font-weight: 900; }
.dim { opacity:.65; font-size:.82rem; }

.tableWrap{ overflow:auto; }
.table{
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  min-width: 980px;
}
thead th{
  text-align:left;
  font-size:.75rem;
  opacity:.75;
  padding: 10px 12px;
  white-space: nowrap;
}
.tr{ cursor:pointer; transition: background .12s ease; }
.tr:hover{ background: rgba(255,255,255,.04); }
tbody td{
  padding: 12px;
  border-top: 1px solid rgba(255,255,255,.08);
  vertical-align: top;
}
.rank{ width: 56px; font-weight: 900; }
.player .nm{ font-weight: 900; letter-spacing: -.01em; }
.mono{
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: .82rem;
}
.score{ font-weight: 950; }
.rightCol{ text-align:right; white-space:nowrap; }

.skeleton { padding: 14px; display:grid; gap:10px; }
.skRow{
  height: 56px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.08);
  background: linear-gradient(90deg, rgba(255,255,255,.05), rgba(255,255,255,.10), rgba(255,255,255,.05));
  background-size: 200% 100%;
  animation: shimmer 1.2s ease-in-out infinite;
}
@keyframes shimmer { 0% { background-position: 0% 0; } 100% { background-position: 200% 0; } }

.empty { padding: 18px 14px; opacity: .7; }

/* Modal */
.modal{ padding: 14px; }
.mHead{
  display:flex; align-items:flex-start; justify-content:space-between; gap: 10px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255,255,255,.10);
}
.big{ font-size: 1.1rem; font-weight: 950; letter-spacing: -.02em; }
.mBody{ padding-top: 12px; display:grid; gap: 12px; }
.block{
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.04);
  padding: 12px;
}
.block .k{ font-size: .78rem; opacity:.7; margin-bottom: 6px; }
.block .v{ font-weight: 800; }
.grid2{ display:grid; gap: 12px; grid-template-columns: 1fr 1fr; }
@media (max-width: 760px) { .topRow { grid-template-columns: 1fr; } .grid2{ grid-template-columns: 1fr; } }
</style>
