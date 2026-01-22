<script setup lang="ts">
import { GAMES } from '~/data/games'
import { TOURNAMENTS as FALLBACK } from '~/data/tournaments'
import { useTournaments } from '~/composables/useTournaments'
import { useSubscription } from '~/composables/useSubscription'

useHead({ title: 'Tournaments' })

type AnyTournament = any

const user = useSupabaseUser()
const { list } = useTournaments()
const { me } = useSubscription()

/* -------- Load tournaments -------- */
const tournaments = ref<AnyTournament[]>([])
try {
  tournaments.value = await list()
} catch {
  tournaments.value = FALLBACK as any
}

/* -------- Subscription state -------- */
const sub = ref<{ active: boolean } | null>(null)
try {
  const s = await me()
  sub.value = { active: Boolean(s?.active) }
} catch {
  sub.value = null
}

/* -------- Time ticker -------- */
const now = ref(Date.now())
let timer: any = null
onMounted(() => (timer = setInterval(() => (now.value = Date.now()), 1000)))
onBeforeUnmount(() => timer && clearInterval(timer))

/* -------- Helpers -------- */
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

const live = computed(() => tournaments.value.filter(t => getStatus(t) === 'live'))
const upcoming = computed(() => tournaments.value.filter(t => getStatus(t) === 'scheduled'))
const ended = computed(() => tournaments.value.filter(t => getStatus(t) === 'ended'))

const canPlay = computed(() => Boolean(user.value) && Boolean(sub.value?.active))
</script>

<template>
  <UContainer class="py-10">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-3xl font-semibold">Tournaments</h1>
        <p class="mt-2 opacity-80">Time-based events with separate leaderboards.</p>
      </div>

      <div class="flex items-center gap-2">
        <UButton v-if="user && sub && !sub.active" to="/subscribe" class="!rounded-full">
          Subscribe to Play
        </UButton>
        <UButton v-else-if="user" to="/subscribe" variant="soft" class="!rounded-full">
          Subscription
        </UButton>
      </div>
    </div>

    <!-- Live -->
    <div v-if="live.length" class="mt-10">
      <h2 class="text-xl font-semibold">Live now</h2>

      <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="t in live"
          :key="t.slug"
          class="rounded-2xl border border-white/10 bg-white/5 p-4"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="text-lg font-semibold">{{ t.title }}</div>
              <div class="mt-1 text-sm opacity-80">
                Game: <span class="font-medium">{{ gameTitle(getGameSlug(t)) }}</span>
              </div>
            </div>

            <span class="text-xs rounded-full px-2 py-1 bg-emerald-500/15 text-emerald-300">LIVE</span>
          </div>

          <div class="mt-3 text-sm opacity-80">
            Ends in: <span class="font-mono">{{ msToClock(endsIn(t)) }}</span>
          </div>

          <div class="mt-4 flex flex-wrap gap-2">
            <UButton :to="`/tournaments/${t.slug}`" variant="soft" class="!rounded-full">
              Details
            </UButton>

            <UButton
              v-if="canPlay"
              :to="`/tournaments/embed/${t.slug}`"
              class="!rounded-full"
            >
              Play
            </UButton>

            <UButton
              v-else
              to="/subscribe"
              class="!rounded-full"
            >
              Subscribe
            </UButton>
          </div>

          <div class="mt-3 text-xs opacity-70">
            Window: {{ fmt(getStartsAt(t)) }} → {{ fmt(getEndsAt(t)) }}
          </div>
        </div>
      </div>
    </div>

    <!-- Upcoming -->
    <div v-if="upcoming.length" class="mt-10">
      <h2 class="text-xl font-semibold">Upcoming</h2>

      <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="t in upcoming"
          :key="t.slug"
          class="rounded-2xl border border-white/10 bg-white/5 p-4"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="text-lg font-semibold">{{ t.title }}</div>
              <div class="mt-1 text-sm opacity-80">
                Game: <span class="font-medium">{{ gameTitle(getGameSlug(t)) }}</span>
              </div>
            </div>

            <span class="text-xs rounded-full px-2 py-1 bg-violet-500/15 text-violet-300">SCHEDULED</span>
          </div>

          <div class="mt-3 text-sm opacity-80">
            Starts in: <span class="font-mono">{{ msToClock(startsIn(t)) }}</span>
          </div>

          <div class="mt-4 flex flex-wrap gap-2">
            <UButton :to="`/tournaments/${t.slug}`" class="!rounded-full">
              View
            </UButton>
          </div>

          <div class="mt-3 text-xs opacity-70">
            Window: {{ fmt(getStartsAt(t)) }} → {{ fmt(getEndsAt(t)) }}
          </div>
        </div>
      </div>
    </div>

    <!-- Ended -->
    <div v-if="ended.length" class="mt-10">
      <h2 class="text-xl font-semibold">Ended</h2>

      <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="t in ended"
          :key="t.slug"
          class="rounded-2xl border border-white/10 bg-white/5 p-4"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="text-lg font-semibold">{{ t.title }}</div>
              <div class="mt-1 text-sm opacity-80">
                Game: <span class="font-medium">{{ gameTitle(getGameSlug(t)) }}</span>
              </div>
            </div>

            <span class="text-xs rounded-full px-2 py-1 bg-white/10 text-white/70">ENDED</span>
          </div>

          <div class="mt-3 text-sm opacity-80">
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

    <div v-if="!tournaments.length" class="mt-10 rounded-2xl border border-white/10 bg-white/5 p-6 opacity-80">
      No tournaments yet.
    </div>
  </UContainer>
</template>
