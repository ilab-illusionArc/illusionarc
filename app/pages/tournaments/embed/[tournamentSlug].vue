<!-- app/pages/tournaments/embed/[tournamentSlug].vue -->
<script setup lang="ts">
import { GAMES } from '~/data/games'
import { TOURNAMENTS as FALLBACK } from '~/data/tournaments'
import { useTournaments } from '~/composables/useTournaments'
import GamePlayer from '~/components/arcade/GamePlayer.vue'

definePageMeta({
  layout: 'embed',
  middleware: ['subscription-required'],
  ssr: false
})

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { bySlug } = useTournaments()

const tournamentSlug = computed(() => String(route.params.tournamentSlug || '').trim())

type AnyTournament = any

const t = ref<AnyTournament | null>(null)
const loading = ref(true)
const loadError = ref<string | null>(null)

/* ---------------- Hard Reload Once (WORKING FIX) ----------------
Why: Unity WebGL / iframe sometimes fails on SPA route navigation.
A full document load fixes it. We auto-do that once per slug.
--------------------------------------------------------------- */
function ensureHardReloadOnce(): boolean {
  if (!import.meta.client) return false
  const slug = tournamentSlug.value
  if (!slug) return false

  const key = `ia.tournament.embed.hardboot.${slug}`
  const already = sessionStorage.getItem(key) === '1'
  if (already) return false

  // Mark to prevent reload loop
  sessionStorage.setItem(key, '1')

  // Force full document reload to the same URL
  // (this mimics the user pressing refresh, but automated)
  window.location.replace(window.location.href)
  return true
}

/* ---------------- Helpers ---------------- */
function getGameSlug(x: AnyTournament) {
  return String(x?.game_slug ?? x?.gameSlug ?? '').trim()
}
function getStartsAt(x: AnyTournament) {
  return String(x?.starts_at ?? x?.startsAt ?? '').trim()
}
function getEndsAt(x: AnyTournament) {
  return String(x?.ends_at ?? x?.endsAt ?? '').trim()
}
function getStatus(x: AnyTournament) {
  return String(x?.status || 'scheduled') as 'scheduled' | 'live' | 'ended' | 'canceled'
}
function safeTimeMs(s: string) {
  const ms = new Date(s).getTime()
  return Number.isFinite(ms) ? ms : 0
}
function msToClock(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return '00:00:00'
  const total = Math.floor(ms / 1000)
  const h = String(Math.floor(total / 3600)).padStart(2, '0')
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0')
  const s2 = String(total % 60).padStart(2, '0')
  return `${h}:${m}:${s2}`
}

/* ---------------- Load tournament safely ---------------- */
async function loadTournament(slug: string) {
  if (!slug) return null
  try {
    const api = await bySlug(slug)
    if (api) return api
  } catch {}
  return (FALLBACK as any).find((x: any) => x.slug === slug) || null
}

async function refreshTournament() {
  const slug = tournamentSlug.value
  if (!slug) return

  loading.value = true
  loadError.value = null

  try {
    const row = await loadTournament(slug)
    t.value = row || null
    if (!t.value) loadError.value = 'Tournament not found'
  } catch (e: any) {
    loadError.value = e?.data?.message || e?.message || 'Failed to load tournament'
    t.value = null
  } finally {
    loading.value = false
  }
}

watch(
  tournamentSlug,
  async () => {
    t.value = null
    loadError.value = null
    loading.value = true
    await nextTick()
    await refreshTournament()
    if (isPlayable.value) bootWithRetry().catch(() => {})
  },
  { immediate: true }
)

const game = computed(() => {
  if (!t.value) return null
  const gs = getGameSlug(t.value)
  return GAMES.find((g) => g.slug === gs) || null
})

useHead(() => ({
  title: t.value ? `${t.value.title} — Play` : 'Tournament — Play',
  meta: [{ name: 'robots', content: 'noindex' }]
}))

/* ---------------- Effective status (time based) ---------------- */
const now = ref(Date.now())
let tick: any = null
onMounted(() => {
  tick = setInterval(() => (now.value = Date.now()), 1000)
})
onBeforeUnmount(() => tick && clearInterval(tick))

const startMs = computed(() => (t.value ? safeTimeMs(getStartsAt(t.value)) : 0))
const endMs = computed(() => (t.value ? safeTimeMs(getEndsAt(t.value)) : 0))

const endedByTime = computed(() => !!endMs.value && now.value >= endMs.value)
const liveByTime = computed(() => !!startMs.value && !!endMs.value && now.value >= startMs.value && now.value < endMs.value)

const effectiveStatus = computed<'scheduled' | 'live' | 'ended' | 'canceled'>(() => {
  if (!t.value) return 'scheduled'
  const st = getStatus(t.value)
  if (st === 'canceled') return 'canceled'
  if (endedByTime.value) return 'ended'
  if (liveByTime.value) return 'live'
  return 'scheduled'
})

const isPlayable = computed(() => {
  if (!t.value) return false
  if (!game.value) return false
  return effectiveStatus.value === 'live'
})

const endsInMs = computed(() => (endMs.value ? Math.max(0, endMs.value - now.value) : 0))
const startsInMs = computed(() => (startMs.value ? Math.max(0, startMs.value - now.value) : 0))

/* ---------------- Fullscreen ---------------- */
const isIOS = computed(() => {
  if (!import.meta.client) return false
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const platform = (navigator as any).platform || ''
  const maxTouch = (navigator as any).maxTouchPoints || 0
  const iOS = /iPad|iPhone|iPod/.test(ua)
  const iPadOS = platform === 'MacIntel' && maxTouch > 1
  return iOS || iPadOS
})
const showFullscreen = computed(() => !isIOS.value)

/* ---------------- Player boot ---------------- */
const playerRef = ref<InstanceType<typeof GamePlayer> | null>(null)
const playerKey = ref(0)
const booting = ref(false)

function hardStop() {
  try {
    playerRef.value?.stop?.()
  } catch {}
}

async function delay(ms: number) {
  await new Promise((r) => setTimeout(r, ms))
}

async function safeStart() {
  await nextTick()
  await new Promise<void>((r) => requestAnimationFrame(() => r()))
  await new Promise<void>((r) => requestAnimationFrame(() => r()))
  await delay(120)
  playerRef.value?.start?.()
}

async function boot() {
  booting.value = true
  try {
    await safeStart()
  } finally {
    booting.value = false
  }
}

async function bootWithRetry() {
  if (!isPlayable.value) return
  await boot()
}

function hardReloadPlayer() {
  hardStop()
  playerKey.value++
  bootWithRetry().catch(() => {})
}

function goBack() {
  if (history.length > 1) router.back()
  else navigateTo(`/tournaments/${tournamentSlug.value}`)
}

function requestFullscreen() {
  if (!showFullscreen.value) return
  playerRef.value?.requestFullscreen?.()
}

/* ---------------- Submit score ---------------- */
async function onScore(payload: any) {
  if (!isPlayable.value) return
  const score = typeof payload === 'number' ? payload : Number(payload?.score)
  if (!Number.isFinite(score) || score < 0) return

  try {
    await $fetch('/api/tournaments/submit', {
      method: 'POST',
      credentials: 'include',
      body: { tournamentSlug: tournamentSlug.value, score }
    })
  } catch (e: any) {
    toast.add({
      title: 'Score submit failed',
      description: e?.data?.message || e?.message || 'Try again',
      color: 'error'
    })
  }
}

/* ✅ The key fix: auto hard reload once on first entry */
onMounted(() => {
  if (ensureHardReloadOnce()) return
  // normal boot after the page is fully loaded (no SPA issue)
  if (isPlayable.value) bootWithRetry().catch(() => {})
})
</script>

<template>
  <ClientOnly>
    <div class="fixed inset-0 bg-black text-white">
      <!-- Top bar -->
      <div
        class="absolute left-0 right-0 top-0 z-[220] border-b border-white/10 bg-black/70 backdrop-blur"
        :style="{ paddingTop: 'env(safe-area-inset-top)' }"
      >
        <div class="h-14 px-3 flex items-center justify-between gap-2">
          <div class="flex items-center gap-2 min-w-0">
            <UButton variant="ghost" class="!rounded-full" @click="goBack">
              <UIcon name="i-heroicons-arrow-left" class="w-5 h-5" />
              <span class="hidden sm:inline">Back</span>
            </UButton>

            <div class="min-w-0">
              <div class="text-sm font-semibold truncate">
                <span v-if="t">{{ t.title }}</span>
                <span v-else-if="loading">Loading…</span>
                <span v-else>Embed</span>
              </div>

              <div class="text-xs opacity-70 truncate">
                <span v-if="game">{{ game.name }}</span>
                <span v-else-if="t">Game missing</span>
                <span v-else>—</span>

                <span class="mx-2 opacity-40">•</span>

                <template v-if="effectiveStatus === 'live'">
                  Ends in <span class="font-mono">{{ msToClock(endsInMs) }}</span>
                </template>
                <template v-else-if="effectiveStatus === 'scheduled'">
                  Starts in <span class="font-mono">{{ msToClock(startsInMs) }}</span>
                </template>
                <template v-else-if="effectiveStatus === 'ended'">Ended</template>
                <template v-else>Canceled</template>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <UButton
              v-if="showFullscreen && isPlayable"
              variant="ghost"
              class="!rounded-full"
              @click="requestFullscreen"
              title="Fullscreen"
            >
              <UIcon name="i-heroicons-arrows-pointing-out" class="w-5 h-5" />
              <span class="hidden sm:inline">Fullscreen</span>
            </UButton>

            <UButton
              variant="soft"
              class="!rounded-full"
              :disabled="!isPlayable"
              @click="hardReloadPlayer"
              title="Reload game"
            >
              <UIcon name="i-heroicons-arrow-path" class="w-5 h-5" />
              <span class="hidden sm:inline">Reload</span>
            </UButton>
          </div>
        </div>
      </div>

      <!-- Body -->
      <div
        class="absolute inset-0 z-[210]"
        :style="{ paddingTop: 'calc(env(safe-area-inset-top) + 56px)', paddingBottom: 'env(safe-area-inset-bottom)' }"
      >
        <div class="h-full p-2">
          <div
            v-if="loading"
            class="h-full grid place-items-center rounded-2xl border border-white/10 bg-white/5 p-6"
          >
            <div class="text-center max-w-md">
              <div class="text-lg font-semibold">Loading tournament…</div>
              <p class="mt-2 text-sm opacity-80">Preparing your session.</p>
            </div>
          </div>

          <div
            v-else-if="loadError || !t || !game"
            class="h-full grid place-items-center rounded-2xl border border-white/10 bg-white/5 p-6"
          >
            <div class="text-center max-w-md">
              <div class="text-lg font-semibold">Can’t open this tournament</div>
              <p class="mt-2 text-sm opacity-80">{{ loadError || 'Missing tournament/game' }}</p>
              <div class="mt-4 flex flex-wrap gap-2 justify-center">
                <UButton class="!rounded-full" :to="`/tournaments/${tournamentSlug}`">Back to details</UButton>
                <UButton variant="soft" class="!rounded-full" to="/tournaments">All tournaments</UButton>
              </div>
            </div>
          </div>

          <div
            v-else-if="!isPlayable"
            class="h-full grid place-items-center rounded-2xl border border-white/10 bg-white/5 p-6"
          >
            <div class="text-center max-w-md">
              <div class="text-lg font-semibold">Tournament is not live</div>
              <p class="mt-2 text-sm opacity-80">You can’t play outside the tournament window.</p>
              <div class="mt-4 flex flex-wrap gap-2 justify-center">
                <UButton class="!rounded-full" :to="`/tournaments/${tournamentSlug}`">Back to details</UButton>
                <UButton variant="soft" class="!rounded-full" to="/tournaments">All tournaments</UButton>
              </div>
            </div>
          </div>

          <div v-else class="h-full">
            <div v-if="booting" class="mb-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm opacity-80">
              Loading game…
            </div>

            <GamePlayer
              :key="`${tournamentSlug}:${playerKey}`"
              ref="playerRef"
              :game="game"
              :defer="true"
              :fullscreen="true"
              @score="onScore"
            />
          </div>
        </div>
      </div>
    </div>
  </ClientOnly>
</template>
