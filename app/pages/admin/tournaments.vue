<!-- app/pages/admin/tournaments.vue -->
<script setup lang="ts">
import { GAMES } from '@/data/games'

definePageMeta({
  layout: 'admin',
  middleware: ['admin']
})

useHead({ title: 'Admin — Tournaments' })

const toast = useToast()
const supabase = useSupabaseClient()

/* ---------------- Types ---------------- */
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
  thumbnail_url?: string | null
  thumbnail_path?: string | null
  created_at?: string
  updated_at?: string
}

type WinnerRow = {
  id: string
  tournament_slug: string
  rank: number
  user_id: string | null
  player_name: string | null
  score: number
  prize_bdt?: number | null
  created_at?: string
}

/* ---------------- State ---------------- */
const loading = ref(false)
const errorMsg = ref<string | null>(null)

const q = ref('')
const filterStatus = ref<string>('')
const filterGame = ref<string>('')

const rows = ref<TournamentRow[]>([])
const selectedId = ref<string | null>(null)
const selected = computed(() => rows.value.find(r => r.id === selectedId.value) || null)
const isEditing = computed(() => Boolean(form.id))

/* ---------------- Form ---------------- */
const form = reactive({
  id: '' as string,
  slug: '' as string, // auto
  title: '' as string,
  description: '' as string,
  game_slug: (GAMES[0]?.slug || '') as string,
  starts_local: '' as string,
  ends_local: '' as string,
  status: 'scheduled' as string,
  prize: '' as string,
  finalized: false as boolean,

  thumbnail_url: '' as string,  // persisted
  thumbnail_path: '' as string  // persisted
})

/* ---------------- Time helpers ---------------- */
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

/* ---------------- Slug auto ---------------- */
function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
watch(
  () => form.title,
  (v) => {
    // Only auto-generate when creating NEW tournament (do not mutate existing slugs)
    if (!form.id) form.slug = slugify(v || '')
  }
)

/* ---------------- Thumbnail (TEMP until create/save) ----------------
User wants:
- Pick thumbnail first (temporary)
- Create tournament -> upload thumbnail + persist in DB
So we store the File in memory + show preview. We do NOT upload before tournament exists.
------------------------------------------------ */
const BUCKET = 'tournament-thumbnails'
const thumbUploading = ref(false)

const thumbFile = ref<File | null>(null)         // temporary file in memory
const thumbPreview = ref<string>('')             // temporary preview URL

function setThumbFile(file: File | null) {
  if (thumbPreview.value) URL.revokeObjectURL(thumbPreview.value)
  thumbPreview.value = ''
  thumbFile.value = file
  if (file) thumbPreview.value = URL.createObjectURL(file)
}

function onThumbPick(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input?.files?.[0] || null
  setThumbFile(file)
}

const effectiveThumbUrl = computed(() => {
  // Show temp preview first, otherwise persisted thumbnail_url
  if (thumbPreview.value) return thumbPreview.value
  if (form.thumbnail_url) return form.thumbnail_url
  return ''
})

function clearThumbSelection() {
  setThumbFile(null)
}

async function removeSavedThumbnail() {
  // Removes persisted thumbnail (storage + db) — available even if no new file selected
  if (!form.id) {
    // nothing persisted yet
    form.thumbnail_url = ''
    form.thumbnail_path = ''
    setThumbFile(null)
    return
  }

  try {
    if (form.thumbnail_path) {
      await supabase.storage.from(BUCKET).remove([form.thumbnail_path])
    }
  } catch {
    // ignore
  }

  form.thumbnail_url = ''
  form.thumbnail_path = ''
  setThumbFile(null)

  // persist change
  await apiUpsert({ saveOnlyMeta: true, skipThumbUpload: true })
  toast.add({ title: 'Thumbnail removed', color: 'success' })
}

/**
 * Uploads the currently selected temp thumb file (if any),
 * and persists thumbnail_url/path to DB.
 */
async function uploadThumbAndPersist(tournamentId: string) {
  if (!thumbFile.value) return // nothing new selected

  thumbUploading.value = true
  try {
    const safeName = thumbFile.value.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `tournaments/${tournamentId}/${Date.now()}-${safeName}`

    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, thumbFile.value, {
      upsert: true,
      contentType: thumbFile.value.type
    })
    if (upErr) throw upErr

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    const publicUrl = data?.publicUrl || ''

    // update form fields + persist them via API
    form.thumbnail_path = path
    form.thumbnail_url = publicUrl

    await apiUpsert({ saveOnlyMeta: true, skipThumbUpload: true })

    // clear temp file after successful upload
    setThumbFile(null)
    toast.add({ title: 'Thumbnail saved', color: 'success' })
  } finally {
    thumbUploading.value = false
  }
}

/* ---------------- API ---------------- */
async function apiList() {
  loading.value = true
  errorMsg.value = null
  try {
    const res = await $fetch<{ rows: TournamentRow[] }>('/api/admin/tournaments/list', {
      credentials: 'include',
      query: {
        q: q.value || undefined,
        status: filterStatus.value || undefined,
        gameSlug: filterGame.value || undefined
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

type UpsertOpts = {
  saveOnlyMeta?: boolean
  skipThumbUpload?: boolean
}

/**
 * Main save.
 * Behavior:
 * - Creates/updates tournament first (so we get a stable id)
 * - Then uploads temp thumbnail (if selected) and persists thumbnail_url/path
 */
async function apiUpsert(opts: UpsertOpts = {}) {
  const saveOnlyMeta = Boolean(opts.saveOnlyMeta)
  const skipThumbUpload = Boolean(opts.skipThumbUpload)

  if (timeError.value) {
    toast.add({ title: 'Fix time window', description: timeError.value, color: 'error' })
    return null
  }
  if (!form.title.trim()) {
    toast.add({ title: 'Title required', color: 'error' })
    return null
  }
  if (!form.slug.trim()) {
    toast.add({ title: 'Slug could not be generated', description: 'Change the title', color: 'error' })
    return null
  }
  if (!form.game_slug) {
    toast.add({ title: 'Game required', color: 'error' })
    return null
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
        finalized: Boolean(form.finalized),

        // persisted thumbnail fields (may be blank on first create)
        thumbnail_url: form.thumbnail_url || null,
        thumbnail_path: form.thumbnail_path || null
      }
    })

    const t = res?.tournament
    if (!t?.id) throw new Error('Upsert did not return tournament id')

    // keep form synced
    form.id = t.id
    form.slug = t.slug
    form.thumbnail_url = t.thumbnail_url || form.thumbnail_url
    form.thumbnail_path = t.thumbnail_path || form.thumbnail_path

    if (!saveOnlyMeta) {
      toast.add({ title: isEditing.value ? 'Tournament saved' : 'Tournament created', color: 'success' })
    }

    // Upload thumbnail AFTER create/save (per your requirement)
    if (!skipThumbUpload) {
      try {
        await uploadThumbAndPersist(t.id)
      } catch (e: any) {
        toast.add({
          title: 'Saved, but thumbnail upload failed',
          description: e?.message || 'Try saving thumbnail again',
          color: 'error'
        })
      }
    }

    await apiList()
    selectTournament(t.id)

    return t
  } catch (e: any) {
    toast.add({
      title: 'Save failed',
      description: e?.data?.message || e?.message || 'Try again',
      color: 'error'
    })
    return null
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

const prizePool = ref<number>(0)

function applySplit(mode: 'equal' | '50_30_20') {
  if (!winners.value.length) return
  const pool = Number(prizePool.value || 0)
  if (!Number.isFinite(pool) || pool <= 0) {
    toast.add({ title: 'Enter prize pool first', color: 'error' })
    return
  }

  const w1 = winners.value.find(w => w.rank === 1)
  const w2 = winners.value.find(w => w.rank === 2)
  const w3 = winners.value.find(w => w.rank === 3)

  if (mode === 'equal') {
    const each = Math.floor(pool / winners.value.length)
    winners.value.forEach(w => (w.prize_bdt = each))
  } else {
    if (w1) w1.prize_bdt = Math.floor(pool * 0.5)
    if (w2) w2.prize_bdt = Math.floor(pool * 0.3)
    if (w3) w3.prize_bdt = Math.floor(pool * 0.2)
  }
}

async function loadWinners() {
  winnersErr.value = null
  winners.value = []
  if (!form.slug) return

  winnersLoading.value = true
  try {
    // IMPORTANT: your admin endpoint should support tournamentSlug
    const res = await $fetch<{ rows: WinnerRow[] }>('/api/admin/tournaments/winners', {
      credentials: 'include',
      query: { tournamentSlug: form.slug }
    })
    winners.value = (res?.rows || []) as WinnerRow[]
  } catch (e: any) {
    winnersErr.value = e?.data?.message || e?.message || 'Failed to load winners'
  } finally {
    winnersLoading.value = false
  }
}

async function finalize(force = false) {
  if (!form.id) return
  winnersErr.value = null

  winnersLoading.value = true
  try {
    await $fetch('/api/admin/tournaments/finalize', {
      method: 'POST',
      credentials: 'include',
      body: { tournamentId: form.id, force }
    })
    toast.add({ title: force ? 'Re-finalized' : 'Finalized winners', color: 'success' })
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

async function saveAllPrizes() {
  for (const w of winners.value) {
    await updateWinner(w)
  }
  toast.add({ title: 'All prizes saved', color: 'success' })
}

/* ---------------- Selection & reset ---------------- */
function resetForm() {
  selectedId.value = null

  form.id = ''
  form.title = ''
  form.slug = ''
  form.description = ''
  form.prize = ''
  form.game_slug = GAMES[0]?.slug || ''
  form.status = 'scheduled'
  form.finalized = false

  form.thumbnail_url = ''
  form.thumbnail_path = ''

  // default: next hour -> +2h
  const d = new Date()
  d.setMinutes(0, 0, 0)
  d.setHours(d.getHours() + 1)
  form.starts_local = toLocalInputValue(d.toISOString())
  d.setHours(d.getHours() + 2)
  form.ends_local = toLocalInputValue(d.toISOString())

  winners.value = []
  winnersErr.value = null
  prizePool.value = 0

  setThumbFile(null)
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

  form.thumbnail_url = t.thumbnail_url || ''
  form.thumbnail_path = t.thumbnail_path || ''

  setThumbFile(null)
  loadWinners().catch(() => {})
}

/* ---------------- Debounced reload ---------------- */
function debounce<T extends (...args: any[]) => void>(fn: T, ms: number) {
  let t: any = null
  return (...args: Parameters<T>) => {
    if (t) clearTimeout(t)
    t = setTimeout(() => fn(...args), ms)
  }
}
const reloadDebounced = debounce(() => apiList().catch(() => {}), 250)
watch([q, filterStatus, filterGame], () => reloadDebounced())

function badgeClass(s: string) {
  if (s === 'live') return 'bg-emerald-500/15 border-emerald-400/20 text-emerald-300'
  if (s === 'scheduled') return 'bg-violet-500/15 border-violet-400/20 text-violet-300'
  if (s === 'ended') return 'bg-white/10 border-white/10 text-white/70'
  if (s === 'canceled') return 'bg-red-500/10 border-red-500/20 text-red-200'
  return 'bg-white/10 border-white/10 text-white/70'
}

onMounted(async () => {
  resetForm()
  await apiList()
})
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div class="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-1.5 text-xs text-black/60 dark:text-white/60">
            <UIcon name="i-heroicons-trophy" class="h-4 w-4" />
            Admin • Tournaments
          </div>
          <h1 class="mt-3 text-2xl lg:text-3xl font-extrabold tracking-tight">
            Manage Tournaments
          </h1>
          <p class="mt-1 text-sm opacity-70 max-w-2xl">
            Use Dhaka time. Stored as UTC ISO. Winners snapshot is top 3 after end.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <UButton variant="soft" class="!rounded-full" :loading="loading" @click="apiList()">
            Refresh
          </UButton>
          <UButton class="!rounded-full" @click="resetForm()">
            New
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
              placeholder="Search title / slug…"
              class="w-full bg-transparent text-sm outline-none"
            />
          </div>
        </div>

        <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2.5">
          <div class="text-xs opacity-70">Status</div>
          <select v-model="filterStatus" class="w-full bg-transparent text-sm outline-none">
            <option value="">All</option>
            <option value="scheduled">Scheduled</option>
            <option value="live">Live</option>
            <option value="ended">Ended</option>
            <option value="canceled">Canceled</option>
          </select>
        </div>

        <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2.5">
          <div class="text-xs opacity-70">Game</div>
          <select v-model="filterGame" class="w-full bg-transparent text-sm outline-none">
            <option value="">All</option>
            <option v-for="g in GAMES" :key="g.slug" :value="g.slug">{{ g.name }}</option>
          </select>
        </div>
      </div>

      <div v-if="errorMsg" class="mt-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm">
        {{ errorMsg }}
      </div>
    </div>

    <!-- Main grid -->
    <div class="grid gap-4 lg:grid-cols-[1.1fr_1.2fr]">
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
                  <span class="font-mono">{{ r.slug }}</span> • {{ r.game_slug }}
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
        <!-- Basics -->
        <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-4">
          <div class="flex items-center justify-between gap-3">
            <div class="font-semibold">{{ isEditing ? 'Edit Tournament' : 'Create Tournament' }}</div>
            <div class="text-xs opacity-70" v-if="form.slug">
              Slug: <span class="font-mono">{{ form.slug }}</span>
              <span v-if="form.id" class="opacity-60"> • ID: <span class="font-mono">{{ form.id.slice(0,8) }}…</span></span>
            </div>
          </div>

          <div class="mt-4 grid gap-3">
            <div class="grid gap-2">
              <label class="text-xs opacity-70">Title</label>
              <input
                v-model="form.title"
                class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/20 px-3 py-2 outline-none"
                placeholder="Boss Rush January Campaign"
              />
              <div class="text-xs opacity-60">Slug auto-generates from title (new tournaments only).</div>
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
              <input v-model="form.prize" class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/20 px-3 py-2 outline-none" placeholder="Example: Top 3 get prizes + badge" />
            </div>
          </div>
        </div>

        <!-- Thumbnail (ALWAYS enabled) -->
        <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="font-semibold">Thumbnail</div>
              <div class="text-xs opacity-70">
                Pick an image now (temporary preview). It will upload & save permanently when you click <b>Create / Save</b>.
              </div>
            </div>
            <div class="text-xs opacity-70" v-if="thumbUploading">
              Uploading…
            </div>
          </div>

          <div class="mt-4 grid gap-4 md:grid-cols-[160px_1fr] items-start">
            <div class="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
              <div class="aspect-[16/10] bg-black/20 grid place-items-center">
                <img
                  v-if="effectiveThumbUrl"
                  :src="effectiveThumbUrl"
                  alt="Thumbnail preview"
                  class="h-full w-full object-cover"
                />
                <div v-else class="text-xs opacity-60">No image</div>
              </div>
            </div>

            <div class="space-y-3">
              <input type="file" accept="image/*" @change="onThumbPick" />

              <div class="flex flex-wrap gap-2">
                <UButton variant="soft" class="!rounded-full" :disabled="!thumbFile" @click="clearThumbSelection">
                  Clear Selection
                </UButton>

                <UButton
                  color="red"
                  variant="soft"
                  class="!rounded-full"
                  :disabled="!form.thumbnail_url"
                  @click="removeSavedThumbnail"
                >
                  Remove Saved Thumbnail
                </UButton>
              </div>

              <div class="text-xs opacity-60">
                Best: wide image (16:10 / 16:9). File stays in memory until you Save.
              </div>
            </div>
          </div>
        </div>

        <!-- Schedule + Status -->
        <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-4">
          <div class="font-semibold">Schedule & Status</div>

          <div class="mt-4 grid gap-3 md:grid-cols-2">
            <div class="grid gap-2">
              <label class="text-xs opacity-70">Starts (Dhaka)</label>
              <input v-model="form.starts_local" type="datetime-local" class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/20 px-3 py-2 outline-none" />
              <div class="text-xs opacity-60">UTC: <span class="font-mono">{{ startsIso }}</span></div>
            </div>

            <div class="grid gap-2">
              <label class="text-xs opacity-70">Ends (Dhaka)</label>
              <input v-model="form.ends_local" type="datetime-local" class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/20 px-3 py-2 outline-none" />
              <div class="text-xs opacity-60">UTC: <span class="font-mono">{{ endsIso }}</span></div>
            </div>
          </div>

          <div v-if="timeError" class="mt-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm">
            {{ timeError }}
          </div>

          <div class="mt-3 grid gap-3 md:grid-cols-2">
            <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-3">
              <div class="text-xs opacity-70">Starts in</div>
              <div class="mt-1 font-mono text-sm">{{ msToClock(startsIn) }}</div>
            </div>
            <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-3">
              <div class="text-xs opacity-70">Ends in</div>
              <div class="mt-1 font-mono text-sm">{{ msToClock(endsIn) }}</div>
            </div>
          </div>

          <div class="mt-4 grid gap-3 md:grid-cols-2 items-center">
            <div class="grid gap-2">
              <label class="text-xs opacity-70">Status</label>
              <select v-model="form.status" class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/20 px-3 py-2 outline-none">
                <option value="scheduled">scheduled</option>
                <option value="live">live</option>
                <option value="ended">ended</option>
                <option value="canceled">canceled</option>
              </select>
            </div>

            <div class="flex items-center gap-2 mt-6 md:mt-0">
              <input id="finalized" type="checkbox" v-model="form.finalized" />
              <label for="finalized" class="text-sm opacity-80">Finalized</label>
            </div>
          </div>

          <div class="mt-4 flex flex-wrap gap-2">
            <UButton
              class="!rounded-full"
              :loading="loading || thumbUploading"
              @click="apiUpsert()"
            >
              {{ isEditing ? 'Save Changes' : 'Create Tournament' }}
            </UButton>

            <UButton v-if="form.slug" variant="soft" class="!rounded-full" :to="`/tournaments/${form.slug}`">
              Open Public Page
            </UButton>

            <UButton v-if="form.id" color="red" variant="soft" class="!rounded-full" :loading="loading" @click="apiDelete(form.id)">
              Delete
            </UButton>
          </div>

          <div v-if="thumbFile" class="mt-3 text-xs opacity-70">
            Thumbnail selected and will be uploaded on Save/Create.
          </div>
        </div>

        <!-- Winners -->
        <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="font-semibold">Winners</div>
              <div class="text-xs opacity-70">
                Top 3 snapshot after end. Use Finalize if cron hasn’t run yet.
              </div>
            </div>

            <div class="flex items-center gap-2">
              <UButton variant="soft" size="xs" class="!rounded-full" :loading="winnersLoading" :disabled="!form.slug" @click="loadWinners()">
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

          <div v-if="!form.slug" class="mt-4 text-sm opacity-70">
            Create or select a tournament to manage winners.
          </div>

          <div v-else>
            <div v-if="winnersErr" class="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm">
              {{ winnersErr }}
            </div>

            <div class="mt-4 flex flex-wrap items-center gap-2">
              <div class="text-xs opacity-70">Prize pool (BDT)</div>
              <input
                v-model.number="prizePool"
                type="number"
                min="0"
                class="w-40 rounded-xl border border-white/10 bg-black/20 px-2 py-1 text-sm outline-none"
                placeholder="e.g. 1000"
              />
              <UButton size="xs" variant="soft" class="!rounded-full" :disabled="!winners.length" @click="applySplit('50_30_20')">
                Split 50/30/20
              </UButton>
              <UButton size="xs" variant="soft" class="!rounded-full" :disabled="!winners.length" @click="applySplit('equal')">
                Split Equal
              </UButton>
              <UButton size="xs" class="!rounded-full" :disabled="!winners.length" @click="saveAllPrizes">
                Save All Prizes
              </UButton>
            </div>

            <div v-if="winnersLoading" class="mt-4 text-sm opacity-70">Loading…</div>

            <div v-else-if="winners.length === 0" class="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm opacity-80">
              No winners yet. If the tournament ended, click Finalize (or wait for cron then refresh).
            </div>

            <div v-else class="mt-4 space-y-2">
              <div
                v-for="w in winners"
                :key="w.id"
                class="rounded-2xl border border-white/10 bg-white/5 p-3"
              >
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <div class="flex items-center gap-3">
                    <div
                      class="h-10 w-10 rounded-2xl grid place-items-center border border-white/10"
                      :class="w.rank === 1 ? 'bg-amber-500/15' : w.rank === 2 ? 'bg-slate-500/15' : 'bg-orange-500/15'"
                    >
                      <UIcon :name="w.rank === 1 ? 'i-heroicons-trophy' : 'i-heroicons-star'" class="h-5 w-5 opacity-80" />
                    </div>

                    <div>
                      <div class="font-semibold">
                        #{{ w.rank }} — {{ w.player_name || 'Unknown' }}
                      </div>
                      <div class="text-xs opacity-70">
                        Score: <b class="opacity-100">{{ w.score }}</b>
                        <span class="opacity-40">•</span>
                        User: <span class="font-mono">{{ w.user_id?.slice?.(0, 8) || '—' }}…</span>
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
                Tip: Make sure your <span class="font-mono">tournament_winners</span> table has <span class="font-mono">prize_bdt</span>.
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>
