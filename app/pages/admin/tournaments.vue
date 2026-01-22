<!-- app/pages/admin/tournaments.vue -->
<script setup lang="ts">
import { GAMES } from '@/data/games'

definePageMeta({
  layout: 'admin',
  middleware: ['admin']
})

useHead({ title: 'Admin — Tournaments' })
const toast = useToast()

type TournamentRow = {
  id: string
  slug: string
  title: string
  description: string | null
  game_slug: string
  starts_at: string
  ends_at: string
  status: 'scheduled' | 'live' | 'ended' | 'canceled' | string
  prize: string | null
  finalized: boolean
  created_at?: string
  updated_at?: string
}

type WinnerRow = {
  id: string
  tournament_id: string
  rank: number
  user_id: string
  player_name: string | null
  score: number
  prize_bdt?: number | null
  created_at?: string
}

const loading = ref(false)
const errorMsg = ref<string | null>(null)

const q = ref('')
const status = ref<string>('') // '' | scheduled | live | ended | canceled
const gameSlug = ref<string>('') // '' | boss-rush etc

const rows = ref<TournamentRow[]>([])
const selectedId = ref<string | null>(null)

const selected = computed(() => rows.value.find(r => r.id === selectedId.value) || null)

/** Editor state (independent from list) */
const form = reactive({
  id: '' as string,
  slug: '' as string,
  title: '' as string,
  description: '' as string,
  game_slug: (GAMES[0]?.slug || '') as string,
  // datetime-local values:
  starts_local: '' as string,
  ends_local: '' as string,
  status: 'scheduled' as string,
  prize: '' as string,
  finalized: false as boolean
})

/* ---------------- Time helpers ----------------
We use <input type="datetime-local">.
- It returns a string like "2026-01-22T17:50"
- new Date(that).toISOString() converts from browser local TZ to UTC ISO.
In Bangladesh this matches your Dhaka time entry perfectly.
------------------------------------------------ */
function toIsoFromLocal(dtLocal: string) {
  if (!dtLocal) return ''
  const d = new Date(dtLocal)
  const ms = d.getTime()
  if (!Number.isFinite(ms)) return ''
  return d.toISOString()
}
function toLocalInputValue(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  const ms = d.getTime()
  if (!Number.isFinite(ms)) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  const yyyy = d.getFullYear()
  const mm = pad(d.getMonth() + 1)
  const dd = pad(d.getDate())
  const hh = pad(d.getHours())
  const mi = pad(d.getMinutes())
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
}
function fmt(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString()
}
function msToClock(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return '00:00:00'
  const total = Math.floor(ms / 1000)
  const h = String(Math.floor(total / 3600)).padStart(2, '0')
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0')
  const s = String(total % 60).padStart(2, '0')
  return `${h}:${m}:${s}`
}
const now = ref(Date.now())
let ticker: any = null
onMounted(() => (ticker = setInterval(() => (now.value = Date.now()), 1000)))
onBeforeUnmount(() => ticker && clearInterval(ticker))

const startsIso = computed(() => toIsoFromLocal(form.starts_local))
const endsIso = computed(() => toIsoFromLocal(form.ends_local))
const startsIn = computed(() => (startsIso.value ? new Date(startsIso.value).getTime() - now.value : 0))
const endsIn = computed(() => (endsIso.value ? new Date(endsIso.value).getTime() - now.value : 0))
const timeError = computed(() => {
  if (!startsIso.value || !endsIso.value) return ''
  const s = new Date(startsIso.value).getTime()
  const e = new Date(endsIso.value).getTime()
  if (!Number.isFinite(s) || !Number.isFinite(e)) return 'Invalid datetime'
  if (e <= s) return 'End must be after start'
  return ''
})

/* ---------------- API ---------------- */
async function apiList() {
  loading.value = true
  errorMsg.value = null
  try {
    const res = await $fetch<{ rows: TournamentRow[] }>('/api/admin/tournaments/list', {
      credentials: 'include',
      query: {
        q: q.value || undefined,
        status: status.value || undefined,
        gameSlug: gameSlug.value || undefined
      }
    })
    rows.value = (res?.rows || []) as TournamentRow[]
  } catch (e: any) {
    errorMsg.value = e?.data?.message || e?.message || 'Failed to load tournaments'
    rows.value = []
  } finally {
    loading.value = false
  }
}

async function apiUpsert() {
  if (timeError.value) {
    toast.add({ title: 'Fix time window', description: timeError.value, color: 'error' })
    return
  }
  if (!form.title.trim()) {
    toast.add({ title: 'Title required', color: 'error' })
    return
  }
  if (!form.slug.trim()) {
    toast.add({ title: 'Slug required', description: 'Use a unique slug', color: 'error' })
    return
  }
  if (!form.game_slug) {
    toast.add({ title: 'Game required', color: 'error' })
    return
  }

  loading.value = true
  errorMsg.value = null
  try {
    const res = await $fetch<{ ok: boolean; tournament: TournamentRow }>('/api/admin/tournaments/upsert', {
      method: 'POST',
      credentials: 'include',
      body: {
        id: form.id || null,
        slug: form.slug.trim(),
        title: form.title.trim(),
        description: form.description.trim() || null,
        prize: form.prize.trim() || null,
        game_slug: form.game_slug,
        starts_at: startsIso.value,
        ends_at: endsIso.value,
        status: form.status,
        finalized: Boolean(form.finalized)
      }
    })

    toast.add({ title: form.id ? 'Tournament updated' : 'Tournament created', color: 'success' })

    // Refresh list and reselect
    await apiList()
    const id = res?.tournament?.id
    if (id) selectTournament(id)
  } catch (e: any) {
    toast.add({
      title: 'Save failed',
      description: e?.data?.message || e?.message || 'Try again',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

async function apiDelete(id: string) {
  if (!id) return
  const ok = confirm('Delete this tournament? (If winners exist, it will be blocked)')
  if (!ok) return

  loading.value = true
  try {
    await $fetch('/api/admin/tournaments/delete', {
      method: 'POST',
      credentials: 'include',
      body: { id }
    })
    toast.add({ title: 'Deleted', color: 'success' })
    if (selectedId.value === id) resetForm()
    await apiList()
  } catch (e: any) {
    toast.add({ title: 'Delete failed', description: e?.data?.message || e?.message || '', color: 'error' })
  } finally {
    loading.value = false
  }
}

/* ---------------- Winners ---------------- */
const winners = ref<WinnerRow[]>([])
const winnersLoading = ref(false)
const winnersErr = ref<string | null>(null)

async function loadWinners() {
  winnersErr.value = null
  winners.value = []
  const id = form.id
  if (!id) return

  winnersLoading.value = true
  try {
    const res = await $fetch<{ rows: WinnerRow[] }>('/api/admin/tournaments/winners', {
      credentials: 'include',
      query: { tournamentId: id }
    })
    winners.value = (res?.rows || []) as WinnerRow[]
  } catch (e: any) {
    winnersErr.value = e?.data?.message || e?.message || 'Failed to load winners'
  } finally {
    winnersLoading.value = false
  }
}

async function finalize(force = false) {
  const id = form.id
  if (!id) return
  winnersErr.value = null

  winnersLoading.value = true
  try {
    await $fetch('/api/admin/tournaments/finalize', {
      method: 'POST',
      credentials: 'include',
      body: { tournamentId: id, force }
    })
    toast.add({ title: force ? 'Re-finalized' : 'Finalized winners', color: 'success' })
    // also mark finalized in form
    form.finalized = true
    await apiList()
    await loadWinners()
  } catch (e: any) {
    toast.add({ title: 'Finalize failed', description: e?.data?.message || e?.message || '', color: 'error' })
  } finally {
    winnersLoading.value = false
  }
}

async function updateWinner(row: WinnerRow) {
  try {
    await $fetch('/api/admin/tournaments/winners.update', {
      method: 'POST',
      credentials: 'include',
      body: {
        id: row.id,
        player_name: row.player_name,
        score: row.score,
        prize_bdt: row.prize_bdt ?? 0
      }
    })
    toast.add({ title: 'Winner updated', color: 'success' })
    await loadWinners()
  } catch (e: any) {
    toast.add({ title: 'Update failed', description: e?.data?.message || e?.message || '', color: 'error' })
  }
}

/* ---------------- Selection & reset ---------------- */
function resetForm() {
  selectedId.value = null
  form.id = ''
  form.slug = ''
  form.title = ''
  form.description = ''
  form.prize = ''
  form.game_slug = GAMES[0]?.slug || ''
  form.status = 'scheduled'
  form.finalized = false

  // default: next hour → +1h
  const d = new Date()
  d.setMinutes(0, 0, 0)
  d.setHours(d.getHours() + 1)
  form.starts_local = toLocalInputValue(d.toISOString())
  d.setHours(d.getHours() + 2)
  form.ends_local = toLocalInputValue(d.toISOString())

  winners.value = []
  winnersErr.value = null
}

function selectTournament(id: string) {
  selectedId.value = id
  const t = rows.value.find(r => r.id === id)
  if (!t) return

  form.id = t.id
  form.slug = t.slug
  form.title = t.title
  form.description = t.description || ''
  form.prize = t.prize || ''
  form.game_slug = t.game_slug
  form.status = t.status || 'scheduled'
  form.finalized = Boolean(t.finalized)

  form.starts_local = toLocalInputValue(t.starts_at)
  form.ends_local = toLocalInputValue(t.ends_at)

  loadWinners().catch(() => {})
}

function autoSlugFromTitle() {
  const s = form.title
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!form.slug) form.slug = s
}

// auto load
onMounted(async () => {
  resetForm()
  await apiList()
})

// debounce search
function debounce<T extends (...args: any[]) => void>(fn: T, ms: number) {
  let t: any = null
  return (...args: Parameters<T>) => {
    if (t) clearTimeout(t)
    t = setTimeout(() => fn(...args), ms)
  }
}
const reloadDebounced = debounce(() => apiList().catch(() => {}), 250)
watch([q, status, gameSlug], () => reloadDebounced())
watch(() => form.title, () => autoSlugFromTitle())

/* Visual status helpers */
function badgeClass(s: string) {
  if (s === 'live') return 'bg-emerald-500/15 border-emerald-400/20 text-emerald-300'
  if (s === 'scheduled') return 'bg-violet-500/15 border-violet-400/20 text-violet-300'
  if (s === 'ended') return 'bg-white/10 border-white/10 text-white/70'
  return 'bg-white/10 border-white/10 text-white/70'
}
</script>

<template>
  <div class="space-y-4">
    <!-- HERO -->
    <div class="relative overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-5 lg:p-6 backdrop-blur">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="min-w-0">
          <div class="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-1.5 text-xs text-black/60 dark:text-white/60">
            <UIcon name="i-heroicons-trophy" class="h-4 w-4" />
            Admin • Tournaments
          </div>
          <h1 class="mt-3 text-2xl lg:text-3xl font-extrabold tracking-tight text-black dark:text-white">
            Create • Update • Delete • Winners
          </h1>
          <p class="mt-1 text-sm text-black/60 dark:text-white/60 max-w-2xl">
            Use Dhaka time in the form. We store <b>UTC ISO</b> in DB. Finalize winners after tournament ends.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <UButton variant="soft" class="!rounded-full" :loading="loading" @click="apiList()">
            Refresh
          </UButton>
          <UButton class="!rounded-full" @click="resetForm()">
            New Tournament
          </UButton>
        </div>
      </div>

      <!-- Filters -->
      <div class="mt-4 grid gap-3 md:grid-cols-3">
        <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2.5">
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-magnifying-glass" class="h-5 w-5 opacity-60" />
            <input
              v-model="q"
              type="text"
              placeholder="Search title / slug / game…"
              class="w-full bg-transparent text-sm outline-none text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40"
            />
          </div>
        </div>

        <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2.5">
          <div class="text-xs opacity-70">Status</div>
          <select v-model="status" class="w-full bg-transparent text-sm outline-none">
            <option value="">All</option>
            <option value="scheduled">Scheduled</option>
            <option value="live">Live</option>
            <option value="ended">Ended</option>
            <option value="canceled">Canceled</option>
          </select>
        </div>

        <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2.5">
          <div class="text-xs opacity-70">Game</div>
          <select v-model="gameSlug" class="w-full bg-transparent text-sm outline-none">
            <option value="">All</option>
            <option v-for="g in GAMES" :key="g.slug" :value="g.slug">{{ g.name }}</option>
          </select>
        </div>
      </div>

      <div v-if="errorMsg" class="mt-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm">
        {{ errorMsg }}
      </div>
    </div>

    <!-- MAIN GRID -->
    <div class="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <!-- List -->
      <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur overflow-hidden">
        <div class="p-4 flex items-center justify-between gap-3 border-b border-black/10 dark:border-white/10">
          <div class="font-semibold">Tournaments ({{ rows.length }})</div>
          <div v-if="loading" class="text-xs opacity-70">Loading…</div>
        </div>

        <div class="divide-y divide-black/10 dark:divide-white/10">
          <button
            v-for="r in rows"
            :key="r.id"
            type="button"
            class="w-full text-left p-4 hover:bg-black/5 dark:hover:bg-white/5 transition"
            :class="selectedId === r.id ? 'bg-black/5 dark:bg-white/5' : ''"
            @click="selectTournament(r.id)"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="font-semibold truncate">{{ r.title }}</div>
                <div class="mt-1 text-xs opacity-70 truncate">
                  {{ r.slug }} • {{ r.game_slug }}
                </div>
                <div class="mt-2 text-xs opacity-70">
                  {{ fmt(r.starts_at) }} → {{ fmt(r.ends_at) }}
                </div>
              </div>

              <div class="shrink-0 flex flex-col items-end gap-2">
                <span class="px-2 py-1 rounded-full border text-xs" :class="badgeClass(r.status)">
                  {{ String(r.status || 'scheduled').toUpperCase() }}
                </span>
                <span
                  v-if="r.finalized"
                  class="px-2 py-1 rounded-full border border-amber-400/20 bg-amber-500/10 text-amber-200 text-xs"
                >
                  FINALIZED
                </span>
              </div>
            </div>
          </button>

          <div v-if="!loading && rows.length === 0" class="p-6 text-sm opacity-70">
            No tournaments found.
          </div>
        </div>
      </div>

      <!-- Editor -->
      <div class="space-y-4">
        <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-4">
          <div class="flex items-center justify-between gap-3">
            <div class="font-semibold">
              {{ form.id ? 'Edit Tournament' : 'Create Tournament' }}
            </div>
            <div class="text-xs opacity-70" v-if="form.id">
              ID: <span class="font-mono">{{ form.id.slice(0, 8) }}…</span>
            </div>
          </div>

          <div class="mt-3 grid gap-3">
            <div class="grid gap-2">
              <label class="text-xs opacity-70">Title</label>
              <input v-model="form.title" class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/20 px-3 py-2 outline-none" />
            </div>

            <div class="grid gap-2">
              <label class="text-xs opacity-70">Slug (unique)</label>
              <input v-model="form.slug" class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/20 px-3 py-2 outline-none font-mono text-sm" />
              <div class="text-xs opacity-60">Tip: Keep it stable. This becomes your tournament URL.</div>
            </div>

            <div class="grid gap-2">
              <label class="text-xs opacity-70">Game</label>
              <select v-model="form.game_slug" class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/20 px-3 py-2 outline-none">
                <option v-for="g in GAMES" :key="g.slug" :value="g.slug">{{ g.name }}</option>
              </select>
            </div>

            <div class="grid gap-2">
              <label class="text-xs opacity-70">Description</label>
              <textarea v-model="form.description" rows="3" class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/20 px-3 py-2 outline-none" />
            </div>

            <div class="grid gap-2">
              <label class="text-xs opacity-70">Prize (text)</label>
              <input v-model="form.prize" class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/20 px-3 py-2 outline-none" placeholder="e.g. Top 3 get special badge" />
            </div>

            <div class="grid gap-3 md:grid-cols-2">
              <div class="grid gap-2">
                <label class="text-xs opacity-70">Starts (Dhaka)</label>
                <input v-model="form.starts_local" type="datetime-local" class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/20 px-3 py-2 outline-none" />
                <div class="text-xs opacity-60">Stored as UTC: <span class="font-mono">{{ startsIso }}</span></div>
              </div>

              <div class="grid gap-2">
                <label class="text-xs opacity-70">Ends (Dhaka)</label>
                <input v-model="form.ends_local" type="datetime-local" class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/20 px-3 py-2 outline-none" />
                <div class="text-xs opacity-60">Stored as UTC: <span class="font-mono">{{ endsIso }}</span></div>
              </div>
            </div>

            <div v-if="timeError" class="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm">
              {{ timeError }}
            </div>

            <div class="grid gap-3 md:grid-cols-2">
              <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-3">
                <div class="text-xs opacity-70">Starts in</div>
                <div class="mt-1 font-mono text-sm">{{ msToClock(startsIn) }}</div>
              </div>
              <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-3">
                <div class="text-xs opacity-70">Ends in</div>
                <div class="mt-1 font-mono text-sm">{{ msToClock(endsIn) }}</div>
              </div>
            </div>

            <div class="grid gap-2">
              <label class="text-xs opacity-70">Status</label>
              <select v-model="form.status" class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/20 px-3 py-2 outline-none">
                <option value="scheduled">scheduled</option>
                <option value="live">live</option>
                <option value="ended">ended</option>
                <option value="canceled">canceled</option>
              </select>
            </div>

            <div class="flex items-center gap-2">
              <input id="finalized" type="checkbox" v-model="form.finalized" />
              <label for="finalized" class="text-sm opacity-80">Finalized</label>
            </div>

            <div class="flex flex-wrap gap-2 pt-2">
              <UButton class="!rounded-full" :loading="loading" @click="apiUpsert()">
                {{ form.id ? 'Save Changes' : 'Create Tournament' }}
              </UButton>

              <UButton
                v-if="form.id"
                variant="soft"
                class="!rounded-full"
                :to="`/tournaments/${form.slug}`"
              >
                Open Public Page
              </UButton>

              <UButton
                v-if="form.id"
                color="red"
                variant="soft"
                class="!rounded-full"
                :loading="loading"
                @click="apiDelete(form.id)"
              >
                Delete
              </UButton>
            </div>
          </div>
        </div>

        <!-- Winners -->
        <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="font-semibold">Winners</div>
              <div class="text-xs opacity-70">
                Snapshot top 3 after tournament ends. You can edit prize amounts.
              </div>
            </div>

            <div class="flex items-center gap-2">
              <UButton variant="soft" size="xs" class="!rounded-full" :loading="winnersLoading" :disabled="!form.id" @click="loadWinners()">
                Refresh
              </UButton>
              <UButton size="xs" class="!rounded-full" :disabled="!form.id" :loading="winnersLoading" @click="finalize(false)">
                Finalize
              </UButton>
              <UButton variant="soft" size="xs" class="!rounded-full" :disabled="!form.id" :loading="winnersLoading" @click="finalize(true)">
                Re-Finalize (force)
              </UButton>
            </div>
          </div>

          <div v-if="!form.id" class="mt-4 text-sm opacity-70">
            Create or select a tournament to manage winners.
          </div>

          <div v-else>
            <div v-if="winnersErr" class="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm">
              {{ winnersErr }}
            </div>

            <div v-if="winnersLoading" class="mt-4 text-sm opacity-70">Loading…</div>

            <div v-else-if="winners.length === 0" class="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm opacity-80">
              No winners yet. If tournament ended recently, finalize now (or wait for cron + refresh).
            </div>

            <div v-else class="mt-4 space-y-2">
              <div
                v-for="w in winners"
                :key="w.id"
                class="rounded-2xl border border-white/10 bg-white/5 p-3"
              >
                <div class="flex items-center justify-between gap-3">
                  <div class="flex items-center gap-3">
                    <div
                      class="h-10 w-10 rounded-2xl grid place-items-center border border-white/10"
                      :class="w.rank === 1 ? 'bg-amber-500/15' : w.rank === 2 ? 'bg-slate-500/15' : 'bg-orange-500/15'"
                    >
                      <UIcon
                        :name="w.rank === 1 ? 'i-heroicons-trophy' : 'i-heroicons-star'"
                        class="h-5 w-5 opacity-80"
                      />
                    </div>
                    <div>
                      <div class="font-semibold">
                        #{{ w.rank }} — {{ w.player_name || 'Unknown' }}
                      </div>
                      <div class="text-xs opacity-70">
                        Score: <b class="opacity-100">{{ w.score }}</b>
                        <span class="opacity-40">•</span>
                        User: <span class="font-mono">{{ w.user_id?.slice?.(0, 8) }}…</span>
                      </div>
                    </div>
                  </div>

                  <div class="flex items-center gap-2">
                    <div class="text-xs opacity-70">Prize (BDT)</div>
                    <input
                      v-model.number="w.prize_bdt"
                      type="number"
                      min="0"
                      class="w-28 rounded-xl border border-white/10 bg-black/20 px-2 py-1 text-sm outline-none"
                    />
                    <UButton size="xs" class="!rounded-full" @click="updateWinner(w)">
                      Save
                    </UButton>
                  </div>
                </div>
              </div>

              <div class="mt-2 text-xs opacity-70">
                Note: this editor assumes `tournament_winners` has `prize_bdt` column.
                If yours is named differently, tell me the column names and I’ll adjust.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>
