<!-- app/pages/tournaments/[tournamentSlug].vue -->
<script setup lang="ts">
import { GAMES } from '~/data/games'
import { TOURNAMENTS as FALLBACK } from '~/data/tournaments'
import { useTournaments } from '~/composables/useTournaments'
import { useTournamentLeaderboard } from '~/composables/useTournamentLeaderboard'
import { useSubscription } from '~/composables/useSubscription'

const route = useRoute()
const slug = computed(() => String(route.params.tournamentSlug || '').trim())

const user = useSupabaseUser()
const { bySlug } = useTournaments()
const { getLeaderboard } = useTournamentLeaderboard()
const { me } = useSubscription()

type AnyTournament = any
const t = ref<AnyTournament | null>(null)

/* -------- Load tournament (API with fallback) -------- */
try {
  t.value = await bySlug(slug.value)
  if (!t.value) t.value = (FALLBACK as any).find((x: any) => x.slug === slug.value) || null
} catch {
  t.value = (FALLBACK as any).find((x: any) => x.slug === slug.value) || null
}

useHead(() => ({
  title: t.value ? `Tournament — ${t.value.title}` : 'Tournament'
}))

/* -------- Subscription state -------- */
const sub = ref<{ active: boolean; subscription?: any } | null>(null)
async function refreshSub() {
  try {
    const s = await me()
    sub.value = { active: Boolean(s?.active), subscription: s?.subscription || null }
  } catch {
    sub.value = { active: false, subscription: null }
  }
}
await refreshSub()

/* -------- Time ticker -------- */
const now = ref(Date.now())
let timer: any = null
onMounted(() => (timer = setInterval(() => (now.value = Date.now()), 1000)))
onBeforeUnmount(() => timer && clearInterval(timer))

/* -------- Helpers -------- */
function getStatus(x: AnyTournament) {
  return String(x?.status || 'scheduled') as 'scheduled' | 'live' | 'ended' | 'canceled'
}
function getGameSlug(x: AnyTournament) {
  return String(x?.game_slug ?? x?.gameSlug ?? '').trim()
}
function getStartsAt(x: AnyTournament) {
  return String(x?.starts_at ?? x?.startsAt ?? '').trim()
}
function getEndsAt(x: AnyTournament) {
  return String(x?.ends_at ?? x?.endsAt ?? '').trim()
}
function fmt(dt: string) {
  if (!dt) return ''
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'short' }).format(new Date(dt))
}
function msToClock(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return '00:00:00'
  const total = Math.floor(ms / 1000)
  const h = String(Math.floor(total / 3600)).padStart(2, '0')
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0')
  const s = String(total % 60).padStart(2, '0')
  return `${h}:${m}:${s}`
}

const startsInMs = computed(() => (t.value ? new Date(getStartsAt(t.value)).getTime() - now.value : 0))
const endsInMs = computed(() => (t.value ? new Date(getEndsAt(t.value)).getTime() - now.value : 0))

const game = computed(() => {
  if (!t.value) return null
  const gs = getGameSlug(t.value)
  return GAMES.find(g => g.slug === gs) || null
})

const canPlay = computed(() => {
  if (!t.value) return false
  if (getStatus(t.value) !== 'live') return false
  if (!user.value) return false
  return sub.value?.active === true
})

/* -------- Leaderboard -------- */
type LbRow = { player_name: string; score: number; created_at: string }

const lb = ref<LbRow[]>([])
const lbPending = ref(false)
const lbError = ref<string | null>(null)

async function loadLeaderboard() {
  lbError.value = null
  lbPending.value = true
  try {
    const res = await getLeaderboard(slug.value, 50)
    lb.value = (res?.rows || []) as LbRow[]
  } catch (e: any) {
    lbError.value = e?.data?.message || e?.message || 'Failed to load leaderboard'
    lb.value = []
  } finally {
    lbPending.value = false
  }
}

await loadLeaderboard()

/* -------- Winners (final snapshot) -------- */
type WinnerRow = { rank: 1 | 2 | 3; player_name: string; score: number; user_id?: string | null }

const winners = ref<WinnerRow[]>([])
const winnersPending = ref(false)
const winnersError = ref<string | null>(null)

const hasWinners = computed(() => winners.value.length > 0)

function winnerByRank(rank: 1 | 2 | 3) {
  return winners.value.find(w => Number(w.rank) === rank) || null
}

function medal(rank: 1 | 2 | 3) {
  return rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'
}

function podiumLabel(rank: 1 | 2 | 3) {
  return rank === 1 ? 'Champion' : rank === 2 ? 'Runner-up' : '3rd Place'
}

function safeName(name: any) {
  const s = String(name || '').trim()
  return s || 'Player'
}

async function loadWinners() {
  winnersError.value = null
  winnersPending.value = true
  try {
    const res = await $fetch<{ winners?: WinnerRow[] }>(`/api/tournaments/winners`, {
      credentials: 'include',
      query: { slug: slug.value }
    })
    winners.value = Array.isArray(res?.winners) ? (res.winners as WinnerRow[]) : []
  } catch (e: any) {
    // keep non-blocking; page still works
    winnersError.value = e?.data?.message || e?.message || 'Failed to load winners'
    winners.value = []
  } finally {
    winnersPending.value = false
  }
}
watchEffect(async () => {
  if (!t.value) return

  // when time crosses start/end boundary, refetch tournament from API
  const s = new Date(getStartsAt(t.value)).getTime()
  const e = new Date(getEndsAt(t.value)).getTime()

  if (Math.abs(now.value - s) < 1500 || Math.abs(now.value - e) < 1500) {
    try {
      const fresh = await bySlug(slug.value)
      if (fresh) t.value = fresh
    } catch {}
    // also refresh winners/leaderboard
    loadLeaderboard()
    // if ended => load winners snapshot
    // @ts-ignore
    if (effectiveStatus?.value === 'ended') loadWinners?.()
  }
})

if (t.value && getStatus(t.value) === 'ended') {
  await loadWinners()
}
</script>

<template>
  <UContainer class="py-10">
    <div v-if="!t" class="rounded-2xl border border-white/10 bg-white/5 p-6">
      <div class="text-lg font-semibold">Tournament not found</div>
      <NuxtLink to="/tournaments" class="mt-3 inline-block text-sm opacity-80 hover:opacity-100">
        ← Back to tournaments
      </NuxtLink>
    </div>

    <div v-else>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <NuxtLink to="/tournaments" class="text-sm opacity-70 hover:opacity-100">← Back</NuxtLink>

        <div class="flex items-center gap-2">
          <UButton v-if="user && sub && !sub.active" to="/subscribe" class="!rounded-full">
            Subscribe to Play
          </UButton>
          <UButton v-else-if="user" to="/subscribe" variant="soft" class="!rounded-full">
            Subscription
          </UButton>
        </div>
      </div>

      <!-- Title / Summary -->
      <div class="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="text-3xl font-semibold">{{ t.title }}</h1>
          <p v-if="t.description" class="mt-2 opacity-80 max-w-3xl">{{ t.description }}</p>

          <div class="mt-3 flex flex-wrap gap-2 text-xs">
            <span
              v-if="getStatus(t) === 'live'"
              class="px-2 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/20 text-emerald-300"
            >
              LIVE
            </span>
            <span
              v-else-if="getStatus(t) === 'scheduled'"
              class="px-2 py-1 rounded-full bg-violet-500/15 border border-violet-400/20 text-violet-300"
            >
              SCHEDULED
            </span>
            <span
              v-else
              class="px-2 py-1 rounded-full bg-white/10 border border-white/10 text-white/70"
            >
              ENDED
            </span>

            <span class="px-2 py-1 rounded-full bg-white/5 border border-white/10">
              Game: <b class="font-semibold">{{ game?.name || getGameSlug(t) }}</b>
            </span>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <UButton
            v-if="canPlay"
            :to="`/tournaments/embed/${t.slug}`"
            class="!rounded-full"
          >
            Play Now
          </UButton>

          <UButton
            v-else-if="getStatus(t) === 'live' && user && sub && !sub.active"
            to="/subscribe"
            class="!rounded-full"
          >
            Subscribe to Play
          </UButton>

          <UButton
            v-else
            :to="`/tournaments/embed/${t.slug}`"
            variant="soft"
            class="!rounded-full"
          >
            Open
          </UButton>

          <UButton :to="`/arcade/${getGameSlug(t)}`" variant="soft" class="!rounded-full">
            Arcade (if available)
          </UButton>
        </div>
      </div>

      <!-- ✅ Winners Podium (ENDED only) -->
      <div
        v-if="getStatus(t) === 'ended'"
        class="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6 overflow-hidden"
      >
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="text-lg font-semibold flex items-center gap-2">
              <UIcon name="i-heroicons-trophy" class="w-5 h-5" />
              Final Results
            </div>
            <div class="mt-1 text-sm opacity-70">
              Winners are locked after the tournament ends.
            </div>
          </div>

          <UButton
            size="xs"
            variant="soft"
            class="!rounded-full"
            :loading="winnersPending"
            @click="loadWinners"
          >
            Refresh
          </UButton>
        </div>

        <div v-if="winnersError" class="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm">
          {{ winnersError }}
        </div>

        <div v-if="!winnersPending && !hasWinners" class="mt-5 rounded-xl border border-white/10 bg-white/5 p-4 text-sm opacity-80">
          No winners snapshot yet. If the tournament ended recently, wait 1 minute (cron) then refresh.
        </div>

        <div v-else class="mt-6">
          <!-- Podium -->
          <div class="grid gap-4 md:grid-cols-3 items-end">
            <!-- 🥈 Rank 2 -->
            <div class="order-2 md:order-1">
              <div class="rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
                <div class="text-3xl">🥈</div>
                <div class="mt-2 text-xs uppercase tracking-wider opacity-70">{{ podiumLabel(2) }}</div>
                <div class="mt-2 text-lg font-semibold">
                  {{ safeName(winnerByRank(2)?.player_name) }}
                </div>
                <div class="mt-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-sm">
                  <UIcon name="i-heroicons-bolt" class="w-4 h-4 opacity-80" />
                  <span class="font-semibold">{{ winnerByRank(2)?.score ?? '—' }}</span>
                </div>
                <div class="mt-4 h-12 rounded-xl bg-white/5 border border-white/10"></div>
              </div>
            </div>

            <!-- 🥇 Rank 1 (bigger) -->
            <div class="order-1 md:order-2">
              <div class="rounded-2xl border border-amber-400/30 bg-gradient-to-b from-amber-500/15 to-white/5 p-6 text-center">
                <div class="flex items-center justify-center gap-2">
                  <span class="text-3xl">🥇</span>
                  <span class="text-2xl">👑</span>
                </div>
                <div class="mt-2 text-xs uppercase tracking-wider text-amber-200/90">{{ podiumLabel(1) }}</div>
                <div class="mt-2 text-2xl font-semibold">
                  {{ safeName(winnerByRank(1)?.player_name) }}
                </div>
                <div class="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-500/10 px-4 py-1 text-sm">
                  <UIcon name="i-heroicons-bolt" class="w-4 h-4 opacity-90" />
                  <span class="font-semibold">{{ winnerByRank(1)?.score ?? '—' }}</span>
                </div>
                <div class="mt-5 h-16 rounded-xl bg-amber-500/10 border border-amber-400/20"></div>
              </div>
            </div>

            <!-- 🥉 Rank 3 -->
            <div class="order-3">
              <div class="rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
                <div class="text-3xl">🥉</div>
                <div class="mt-2 text-xs uppercase tracking-wider opacity-70">{{ podiumLabel(3) }}</div>
                <div class="mt-2 text-lg font-semibold">
                  {{ safeName(winnerByRank(3)?.player_name) }}
                </div>
                <div class="mt-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-sm">
                  <UIcon name="i-heroicons-bolt" class="w-4 h-4 opacity-80" />
                  <span class="font-semibold">{{ winnerByRank(3)?.score ?? '—' }}</span>
                </div>
                <div class="mt-4 h-10 rounded-xl bg-white/5 border border-white/10"></div>
              </div>
            </div>
          </div>

          <!-- Winners list -->
          <div class="mt-6 grid gap-3 md:grid-cols-3">
            <div
              v-for="r in winners"
              :key="`${r.rank}-${r.player_name}-${r.score}`"
              class="rounded-2xl border border-white/10 bg-white/5 p-4"
            >
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-2">
                  <div class="text-2xl">{{ medal(r.rank) }}</div>
                  <div>
                    <div class="text-xs opacity-70">Rank #{{ r.rank }}</div>
                    <div class="font-semibold">{{ safeName(r.player_name) }}</div>
                  </div>
                </div>

                <div class="text-right">
                  <div class="text-xs opacity-70">Score</div>
                  <div class="text-lg font-semibold">{{ r.score }}</div>
                </div>
              </div>
            </div>
          </div>

          <div class="mt-5 text-xs opacity-60">
            Tip: If the tournament just ended, winners may appear within ~1 minute after cron finalizes.
          </div>
        </div>
      </div>

      <div class="mt-8 grid gap-4 lg:grid-cols-3">
        <!-- Details -->
        <div class="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5 p-5">
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="rounded-xl border border-white/10 bg-white/5 p-4">
              <div class="text-xs opacity-70">Starts</div>
              <div class="mt-1 text-sm font-medium">{{ fmt(getStartsAt(t)) }}</div>
              <div v-if="getStatus(t) === 'scheduled'" class="mt-2 text-sm opacity-80">
                Starts in: <span class="font-mono">{{ msToClock(startsInMs) }}</span>
              </div>
            </div>

            <div class="rounded-xl border border-white/10 bg-white/5 p-4">
              <div class="text-xs opacity-70">Ends</div>
              <div class="mt-1 text-sm font-medium">{{ fmt(getEndsAt(t)) }}</div>
              <div v-if="getStatus(t) === 'live'" class="mt-2 text-sm opacity-80">
                Ends in: <span class="font-mono">{{ msToClock(endsInMs) }}</span>
              </div>
            </div>
          </div>

          <div v-if="t.prize" class="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
            <div class="text-xs opacity-70">Prize</div>
            <div class="mt-1 text-sm font-medium">{{ t.prize }}</div>
          </div>

          <!-- Gate hint -->
          <div class="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm">
            <div v-if="getStatus(t) !== 'live'" class="opacity-80">
              Tournament is not live yet. You can still view details and leaderboard.
            </div>
            <div v-else-if="!user" class="opacity-80">
              Please log in to play tournaments.
              <div class="mt-3">
                <UButton to="/login" class="!rounded-full">Login</UButton>
              </div>
            </div>
            <div v-else-if="sub && !sub.active" class="opacity-80">
              Subscription required to play. Activate a plan to participate.
              <div class="mt-3">
                <UButton to="/subscribe" class="!rounded-full">Subscribe</UButton>
              </div>
            </div>
            <div v-else class="opacity-80">
              You’re eligible to play. Click <b>Play Now</b> to start.
            </div>
          </div>
        </div>

        <!-- Leaderboard -->
        <div class="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div class="flex items-center justify-between gap-3">
            <div>
              <div class="text-lg font-semibold">Leaderboard</div>
              <p class="mt-1 text-sm opacity-70">Tournament-only scores.</p>
            </div>

            <UButton
              size="xs"
              variant="soft"
              class="!rounded-full"
              :loading="lbPending"
              @click="loadLeaderboard"
            >
              Refresh
            </UButton>
          </div>

          <div v-if="lbError" class="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm">
            {{ lbError }}
          </div>

          <div v-if="!lbPending && !lb.length" class="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm opacity-80">
            No scores yet.
          </div>

          <div v-else class="mt-4 space-y-2">
            <div
              v-for="(r, i) in lb"
              :key="`${r.player_name}-${r.created_at}-${i}`"
              class="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2"
            >
              <div class="flex items-center gap-2">
                <div class="w-6 text-xs opacity-70">{{ i + 1 }}</div>
                <div class="text-sm font-medium">{{ r.player_name }}</div>
              </div>
              <div class="text-sm font-semibold">{{ r.score }}</div>
            </div>

            <div v-if="lbPending" class="rounded-xl border border-white/10 bg-white/5 p-4 text-sm opacity-70">
              Loading…
            </div>
          </div>
        </div>
      </div>
    </div>
  </UContainer>
</template>
