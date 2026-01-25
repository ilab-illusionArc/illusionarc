<script setup lang="ts">
import { GAMES } from '~/data/games'
import { TOURNAMENTS as FALLBACK } from '~/data/tournaments'
import { useTournaments } from '~/composables/useTournaments'
import { useSubscription } from '~/composables/useSubscription'

useHead({ title: 'Tournaments' })

type AnyTournament = any

const user = useSupabaseUser()
const supabase = useSupabaseClient()
const { list } = useTournaments()
const { me } = useSubscription()

/* ---------------- Load tournaments ---------------- */
const tournaments = ref<AnyTournament[]>([])
try {
  tournaments.value = await list()
} catch {
  tournaments.value = FALLBACK as any
}

/* ---------------- Subscription ---------------- */
const sub = ref<{ active: boolean } | null>(null)
try {
  const s = await me()
  sub.value = { active: Boolean(s?.active) }
} catch {
  sub.value = null
}
const canPlay = computed(() => Boolean(user.value) && Boolean(sub.value?.active))

/* ---------------- Time ticker ---------------- */
const now = ref(Date.now())
let timer: any = null
onMounted(() => (timer = setInterval(() => (now.value = Date.now()), 1000)))
onBeforeUnmount(() => timer && clearInterval(timer))

/* ---------------- Helpers ---------------- */
function getStatus(t: AnyTournament) {
  return String(t?.status || 'scheduled') as 'scheduled' | 'live' | 'ended' | 'canceled'
}
function getGameSlug(t: AnyTournament) {
  return String(t?.game_slug ?? t?.gameSlug ?? '').trim()
}
function getStartsAt(t: AnyTournament) {
  return String(t?.starts_at ?? t?.startsAt ?? '').trim()
}
function getEndsAt(t: AnyTournament) {
  return String(t?.ends_at ?? t?.endsAt ?? '').trim()
}

function gameTitle(slug: string) {
  return GAMES.find(g => g.slug === slug)?.name || slug
}
function fmt(dt: string) {
  if (!dt) return ''
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(dt))
}
function msToClock(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return '00:00:00'
  const total = Math.floor(ms / 1000)
  const h = String(Math.floor(total / 3600)).padStart(2, '0')
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0')
  const s = String(total % 60).padStart(2, '0')
  return `${h}:${m}:${s}`
}
function startsIn(t: AnyTournament) {
  return new Date(getStartsAt(t)).getTime() - now.value
}
function endsIn(t: AnyTournament) {
  return new Date(getEndsAt(t)).getTime() - now.value
}

/* ---------------- Thumbnail resolver (FIX) ----------------
Supports:
- t.thumbnail_url (full URL OR relative path)
- t.thumbnail_path + (optional) t.thumbnail_bucket  -> Supabase Storage public url
If the bucket is private, you must switch to a signed URL endpoint.
---------------------------------------------------------- */
const DEFAULT_BUCKET = 'tournament-thumbs' // change to your real bucket name

function rawThumb(t: AnyTournament) {
  return String(t?.thumbnail_url ?? t?.thumbnail ?? t?.thumb ?? '').trim()
}
function thumbBucket(t: AnyTournament) {
  return String(t?.thumbnail_bucket || DEFAULT_BUCKET).trim() || DEFAULT_BUCKET
}
function thumbPath(t: AnyTournament) {
  // optional db field if you store only object path in storage
  return String(t?.thumbnail_path ?? '').trim()
}

const thumbMap = reactive<Record<string, string>>({})

function normalizeMaybeUrl(x: string) {
  const s = String(x || '').trim()
  if (!s) return ''
  // Already an absolute url
  if (/^https?:\/\//i.test(s)) return s
  // Already a root path in your app
  if (s.startsWith('/')) return s
  // Looks like a storage public URL path or relative - keep as is (we’ll try to convert below)
  return s
}

async function resolveThumb(t: AnyTournament) {
  const slug = String(t?.slug || '').trim()
  if (!slug) return ''

  // 1) Prefer thumbnail_url if present
  const direct = normalizeMaybeUrl(rawThumb(t))
  if (direct) {
    // If it’s not http or /, it might be a storage object path. Try converting:
    if (!/^https?:\/\//i.test(direct) && !direct.startsWith('/')) {
      const bucket = thumbBucket(t)
      const { data } = supabase.storage.from(bucket).getPublicUrl(direct)
      return String(data?.publicUrl || direct)
    }
    return direct
  }

  // 2) If thumbnail_path is provided → convert to public URL
  const p = thumbPath(t)
  if (p) {
    const bucket = thumbBucket(t)
    const { data } = supabase.storage.from(bucket).getPublicUrl(p)
    return String(data?.publicUrl || '')
  }

  return ''
}

async function hydrateThumbs(arr: AnyTournament[]) {
  for (const t of arr || []) {
    const slug = String(t?.slug || '').trim()
    if (!slug) continue
    if (thumbMap[slug]) continue
    const url = await resolveThumb(t)
    if (url) thumbMap[slug] = url
  }
}

watch(
  () => tournaments.value,
  async (arr) => {
    await hydrateThumbs(arr || [])
  },
  { immediate: true, deep: true }
)

function getThumb(t: AnyTournament) {
  const slug = String(t?.slug || '').trim()
  if (!slug) return ''
  return thumbMap[slug] || ''
}

function onThumbError(t: AnyTournament) {
  const slug = String(t?.slug || '').trim()
  const u = slug ? thumbMap[slug] : ''
  console.warn('[TournamentThumb] Failed to load:', { slug, url: u, raw: rawThumb(t), path: thumbPath(t), bucket: thumbBucket(t) })
  if (slug) thumbMap[slug] = '' // fallback to gradient
}

/* ---------------- UI state ---------------- */
const q = ref('')
const tab = ref<'all' | 'live' | 'scheduled' | 'ended'>('all')
const gameFilter = ref<string>('all')
const onlyJoinable = ref(false)

const normalized = computed(() => {
  const arr = [...(tournaments.value || [])]
  // Sort: live first, then scheduled, then ended; within each, by start desc
  const rank = (s: string) => (s === 'live' ? 0 : s === 'scheduled' ? 1 : s === 'ended' ? 2 : 3)
  arr.sort((a, b) => {
    const sa = getStatus(a)
    const sb = getStatus(b)
    const ra = rank(sa)
    const rb = rank(sb)
    if (ra !== rb) return ra - rb
    const aa = new Date(getStartsAt(a)).getTime()
    const bb = new Date(getStartsAt(b)).getTime()
    return bb - aa
  })
  return arr
})

const filtered = computed(() => {
  let arr = normalized.value

  const qs = q.value.trim().toLowerCase()
  if (qs) {
    arr = arr.filter((t) => {
      const title = String(t?.title || '').toLowerCase()
      const slug = String(t?.slug || '').toLowerCase()
      const g = getGameSlug(t).toLowerCase()
      return title.includes(qs) || slug.includes(qs) || g.includes(qs)
    })
  }

  if (tab.value !== 'all') {
    arr = arr.filter(t => getStatus(t) === tab.value)
  }

  if (gameFilter.value !== 'all') {
    arr = arr.filter(t => getGameSlug(t) === gameFilter.value)
  }

  if (onlyJoinable.value) {
    arr = arr.filter(t => getStatus(t) === 'live' && canPlay.value)
  }

  return arr
})

const live = computed(() => filtered.value.filter(t => getStatus(t) === 'live'))
const upcoming = computed(() => filtered.value.filter(t => getStatus(t) === 'scheduled'))
const ended = computed(() => filtered.value.filter(t => getStatus(t) === 'ended'))

const counts = computed(() => {
  const all = normalized.value
  return {
    live: all.filter(t => getStatus(t) === 'live').length,
    scheduled: all.filter(t => getStatus(t) === 'scheduled').length,
    ended: all.filter(t => getStatus(t) === 'ended').length
  }
})

function badgeClass(s: string) {
  if (s === 'live') return 'bg-emerald-500/15 border-emerald-400/20 text-emerald-300'
  if (s === 'scheduled') return 'bg-violet-500/15 border-violet-400/20 text-violet-300'
  if (s === 'ended') return 'bg-white/10 border-white/10 text-white/70'
  return 'bg-white/10 border-white/10 text-white/70'
}

function heroBg(s: string) {
  if (s === 'live') return 'from-emerald-500/20 via-white/5 to-transparent'
  if (s === 'scheduled') return 'from-violet-500/20 via-white/5 to-transparent'
  return 'from-white/10 via-white/5 to-transparent'
}
</script>

<template>
  <UContainer class="py-8 sm:py-10">
    <!-- HERO / HEADER -->
    <div class="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-8">
      <div class="pointer-events-none absolute inset-0">
        <div class="absolute -top-28 -left-28 h-80 w-80 rounded-full bg-violet-500/20 blur-3xl"></div>
        <div class="absolute -bottom-28 -right-28 h-80 w-80 rounded-full bg-emerald-500/15 blur-3xl"></div>
        <div class="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent"></div>
      </div>

      <div class="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div class="min-w-0">
          <div class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white/70">
            <span class="h-2 w-2 rounded-full bg-emerald-400"></span>
            Tournament Hub
          </div>

          <h1 class="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight">
            Compete. Climb. Win.
          </h1>
          <p class="mt-2 max-w-2xl text-sm sm:text-base opacity-80">
            Time-based events with separate leaderboards. Winners are locked once the window ends.
          </p>

          <div class="mt-4 flex flex-wrap gap-2 text-xs">
            <span class="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              Live: <b class="font-semibold">{{ counts.live }}</b>
            </span>
            <span class="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              Upcoming: <b class="font-semibold">{{ counts.scheduled }}</b>
            </span>
            <span class="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              Ended: <b class="font-semibold">{{ counts.ended }}</b>
            </span>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <UButton v-if="user && sub && !sub.active" to="/subscribe" class="!rounded-full">
            Subscribe to Play
          </UButton>
          <UButton v-else-if="user" to="/subscribe" variant="soft" class="!rounded-full">
            Subscription
          </UButton>
          <UButton v-else to="/login" variant="soft" class="!rounded-full">
            Login
          </UButton>
        </div>
      </div>

      <!-- CONTROLS -->
      <div class="relative mt-6 grid gap-3 lg:grid-cols-[1.3fr_.7fr_.7fr_.6fr]">
        <!-- Search -->
        <div class="rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5">
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-magnifying-glass" class="h-5 w-5 opacity-60" />
            <input
              v-model="q"
              type="text"
              placeholder="Search tournaments…"
              class="w-full bg-transparent text-sm outline-none placeholder:text-white/40"
            />
            <button
              v-if="q"
              class="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs opacity-80 hover:opacity-100"
              @click="q = ''"
              type="button"
            >
              Clear
            </button>
          </div>
        </div>

        <!-- Tabs -->
        <div class="rounded-2xl border border-white/10 bg-black/20 p-1.5">
          <div class="grid grid-cols-4 gap-1">
            <button
              class="rounded-xl px-2 py-2 text-xs sm:text-sm transition"
              :class="tab === 'all' ? 'bg-white/10' : 'opacity-70 hover:opacity-100'"
              @click="tab = 'all'"
              type="button"
            >
              All
            </button>
            <button
              class="rounded-xl px-2 py-2 text-xs sm:text-sm transition"
              :class="tab === 'live' ? 'bg-white/10' : 'opacity-70 hover:opacity-100'"
              @click="tab = 'live'"
              type="button"
            >
              Live
            </button>
            <button
              class="rounded-xl px-2 py-2 text-xs sm:text-sm transition"
              :class="tab === 'scheduled' ? 'bg-white/10' : 'opacity-70 hover:opacity-100'"
              @click="tab = 'scheduled'"
              type="button"
            >
              Upcoming
            </button>
            <button
              class="rounded-xl px-2 py-2 text-xs sm:text-sm transition"
              :class="tab === 'ended' ? 'bg-white/10' : 'opacity-70 hover:opacity-100'"
              @click="tab = 'ended'"
              type="button"
            >
              Ended
            </button>
          </div>
        </div>

        <!-- Game filter -->
        <div class="rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5">
          <div class="text-xs opacity-70">Game</div>
          <select v-model="gameFilter" class="mt-1 w-full bg-transparent text-sm outline-none">
            <option value="all">All games</option>
            <option v-for="g in GAMES" :key="g.slug" :value="g.slug">{{ g.name }}</option>
          </select>
        </div>

        <!-- Only joinable -->
        <button
          type="button"
          class="rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-left hover:bg-white/5 transition"
          @click="onlyJoinable = !onlyJoinable"
        >
          <div class="flex items-center justify-between gap-2">
            <div>
              <div class="text-xs opacity-70">Quick filter</div>
              <div class="mt-1 text-sm font-medium">
                {{ onlyJoinable ? 'Only joinable' : 'Show all' }}
              </div>
            </div>
            <div
              class="h-6 w-11 rounded-full border border-white/10 p-1 transition"
              :class="onlyJoinable ? 'bg-emerald-500/20' : 'bg-white/5'"
            >
              <div
                class="h-4 w-4 rounded-full bg-white/80 transition"
                :class="onlyJoinable ? 'translate-x-5' : 'translate-x-0'"
              />
            </div>
          </div>
          <div class="mt-1 text-xs opacity-60">Live + subscription</div>
        </button>
      </div>
    </div>

    <!-- LIVE FEATURED -->
    <div v-if="live.length" class="mt-8 sm:mt-10">
      <div class="flex items-end justify-between gap-3">
        <h2 class="text-xl font-semibold">Live now</h2>
        <div class="text-xs opacity-70">Play before time runs out.</div>
      </div>

      <div class="mt-4 grid gap-4 lg:grid-cols-2">
        <div
          v-for="t in live"
          :key="t.slug"
          class="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5"
        >
          <div class="absolute inset-0 bg-gradient-to-br" :class="heroBg('live')"></div>

          <!-- Thumb -->
          <div class="relative h-44 sm:h-52">
            <img
              v-if="getThumb(t)"
              :src="getThumb(t)"
              alt=""
              class="absolute inset-0 h-full w-full object-cover"
              @error="onThumbError(t)"
            />
            <div v-else class="absolute inset-0 bg-gradient-to-br from-white/10 via-white/5 to-transparent"></div>
            <div class="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent"></div>

            <div class="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
              <span class="relative flex h-2 w-2">
                <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60"></span>
                <span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-400"></span>
              </span>
              LIVE
            </div>

            <div class="absolute right-4 top-4 rounded-full border border-white/10 bg-black/35 px-3 py-1 text-xs text-white/85">
              Ends in <span class="font-mono font-semibold">{{ msToClock(endsIn(t)) }}</span>
            </div>

            <div class="absolute bottom-4 left-4 right-4">
              <div class="text-xl sm:text-2xl font-extrabold truncate">{{ t.title }}</div>
              <div class="mt-1 text-sm opacity-90">
                Game: <span class="font-medium">{{ gameTitle(getGameSlug(t)) }}</span>
              </div>
            </div>
          </div>

          <div class="relative p-4 sm:p-5">
            <div class="flex flex-wrap items-center gap-2 text-xs">
              <span class="rounded-full border border-white/10 bg-black/20 px-3 py-1">
                Window: {{ fmt(getStartsAt(t)) }} → {{ fmt(getEndsAt(t)) }}
              </span>
              <span v-if="t.prize" class="rounded-full border border-white/10 bg-black/20 px-3 py-1">
                Prize: <b class="font-semibold">{{ t.prize }}</b>
              </span>
            </div>

            <div class="mt-4 flex flex-wrap gap-2">
              <UButton :to="`/tournaments/${t.slug}`" variant="soft" class="!rounded-full">
                Details
              </UButton>

              <UButton v-if="canPlay" :to="`/tournaments/embed/${t.slug}`" class="!rounded-full">
                Play Now
              </UButton>

              <UButton v-else to="/subscribe" class="!rounded-full">
                Subscribe
              </UButton>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- UPCOMING -->
    <div v-if="upcoming.length" class="mt-8 sm:mt-10">
      <div class="flex items-end justify-between gap-3">
        <h2 class="text-xl font-semibold">Upcoming</h2>
        <div class="text-xs opacity-70">Get ready for the next run.</div>
      </div>

      <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="t in upcoming"
          :key="t.slug"
          class="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5"
        >
          <div class="absolute inset-0 bg-gradient-to-br" :class="heroBg('scheduled')"></div>

          <div class="relative h-36">
            <img
              v-if="getThumb(t)"
              :src="getThumb(t)"
              alt=""
              class="absolute inset-0 h-full w-full object-cover"
              @error="onThumbError(t)"
            />
            <div v-else class="absolute inset-0 bg-gradient-to-br from-white/10 via-white/5 to-transparent"></div>
            <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"></div>

            <div class="absolute left-4 top-4 text-xs rounded-full px-2.5 py-1 border" :class="badgeClass('scheduled')">
              UPCOMING
            </div>

            <div class="absolute bottom-3 left-4 right-4">
              <div class="text-lg font-semibold truncate">{{ t.title }}</div>
              <div class="mt-1 text-sm opacity-85 truncate">
                Game: <span class="font-medium">{{ gameTitle(getGameSlug(t)) }}</span>
              </div>
            </div>
          </div>

          <div class="relative p-4">
            <div class="text-sm opacity-85">
              Starts in: <span class="font-mono font-semibold">{{ msToClock(startsIn(t)) }}</span>
            </div>

            <div class="mt-2 text-xs opacity-70">
              Window: {{ fmt(getStartsAt(t)) }} → {{ fmt(getEndsAt(t)) }}
            </div>

            <div class="mt-4 flex flex-wrap gap-2">
              <UButton :to="`/tournaments/${t.slug}`" class="!rounded-full">
                View
              </UButton>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ENDED -->
    <div v-if="ended.length" class="mt-8 sm:mt-10">
      <div class="flex items-end justify-between gap-3">
        <h2 class="text-xl font-semibold">Ended</h2>
        <div class="text-xs opacity-70">View results & winners.</div>
      </div>

      <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="t in ended"
          :key="t.slug"
          class="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5"
        >
          <div class="absolute inset-0 bg-gradient-to-br" :class="heroBg('ended')"></div>

          <div class="relative h-32">
            <img
              v-if="getThumb(t)"
              :src="getThumb(t)"
              alt=""
              class="absolute inset-0 h-full w-full object-cover grayscale-[20%] opacity-95"
              @error="onThumbError(t)"
            />
            <div v-else class="absolute inset-0 bg-gradient-to-br from-white/10 via-white/5 to-transparent"></div>
            <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"></div>

            <div class="absolute left-4 top-4 text-xs rounded-full px-2.5 py-1 border" :class="badgeClass('ended')">
              ENDED
            </div>

            <div class="absolute bottom-3 left-4 right-4">
              <div class="text-lg font-semibold truncate">{{ t.title }}</div>
              <div class="mt-1 text-sm opacity-85 truncate">
                Game: <span class="font-medium">{{ gameTitle(getGameSlug(t)) }}</span>
              </div>
            </div>
          </div>

          <div class="relative p-4">
            <div class="text-sm opacity-85">
              Ended: <span class="font-medium">{{ fmt(getEndsAt(t)) }}</span>
            </div>

            <div class="mt-4 flex flex-wrap gap-2">
              <UButton :to="`/tournaments/${t.slug}`" variant="soft" class="!rounded-full">
                Results
              </UButton>
              <UButton :to="`/arcade/${getGameSlug(t)}`" variant="soft" class="!rounded-full">
                Back in Arcade
              </UButton>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty -->
    <div v-if="!filtered.length" class="mt-10 rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
      <div class="mx-auto h-12 w-12 rounded-2xl border border-white/10 bg-black/20 grid place-items-center">
        <UIcon name="i-heroicons-calendar-days" class="h-6 w-6 opacity-70" />
      </div>
      <div class="mt-4 text-lg font-semibold">No tournaments found</div>
      <p class="mt-1 text-sm opacity-70">Try clearing filters or searching again.</p>
      <div class="mt-4 flex justify-center gap-2">
        <UButton
          variant="soft"
          class="!rounded-full"
          @click="q = ''; tab = 'all'; gameFilter = 'all'; onlyJoinable = false"
        >
          Clear filters
        </UButton>
      </div>
    </div>
  </UContainer>
</template>

<style scoped>
select { color: inherit; }
</style>
