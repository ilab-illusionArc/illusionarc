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

const tournamentSlug = computed(() => String(route.params.tournamentSlug || '').trim())
const { bySlug } = useTournaments()

type AnyTournament = any
const t = ref<AnyTournament | null>(null)

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

/* ---------------- Load tournament (API + fallback) ---------------- */
async function loadTournament() {
  try {
    const api = await bySlug(tournamentSlug.value)
    if (api) return api
  } catch {}
  return (FALLBACK as any).find((x: any) => x.slug === tournamentSlug.value) || null
}

t.value = await loadTournament()
if (!t.value) throw createError({ statusCode: 404, statusMessage: 'Tournament not found' })

const game = computed(() => {
  const gs = getGameSlug(t.value)
  return GAMES.find((g) => g.slug === gs) || null
})
if (!game.value) throw createError({ statusCode: 404, statusMessage: 'Game not found' })

useHead(() => ({
  title: `${t.value!.title} — Play`,
  meta: [{ name: 'robots', content: 'noindex' }]
}))

/* ---------------- Clock / window gating ---------------- */
const now = ref(Date.now())
let tick: any = null
onMounted(() => {
  tick = setInterval(() => (now.value = Date.now()), 1000)
})
onBeforeUnmount(() => tick && clearInterval(tick))

const startMs = computed(() => safeTimeMs(getStartsAt(t.value)))
const endMs = computed(() => safeTimeMs(getEndsAt(t.value)))

const inTimeWindow = computed(() => {
  if (!startMs.value || !endMs.value) return false
  return now.value >= startMs.value && now.value < endMs.value
})

const isPlayable = computed(() => {
  const st = getStatus(t.value)
  if (st === 'canceled') return false
  if (st === 'ended') return false
  // allow if time window says yes (cron may not update status instantly)
  return inTimeWindow.value
})

watch(isPlayable, (v, prev) => {
  if (prev && !v) {
    hardStop()
    toast.add({ title: 'Tournament is not live', description: 'Play window ended.', color: 'info' })
  }
})

const endsInMs = computed(() => Math.max(0, endMs.value - now.value))
const startsInMs = computed(() => Math.max(0, startMs.value - now.value))

/* ---------------- Fullscreen ---------------- */
const isIOS = computed(() => {
  if (import.meta.server) return false
  const ua = navigator.userAgent || ''
  const iOS = /iPad|iPhone|iPod/.test(ua)
  const iPadOS = navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1
  return iOS || iPadOS
})
const showFullscreen = computed(() => !isIOS.value)

/* ---------------- Player boot & auto-refresh-once ----------------
Goal:
- When user opens the embed route, sometimes player is blank until manual refresh.
Fix strategy:
1) Boot with safeStart (delayed start).
2) If still not running, retry start a couple times.
3) If still blank, do ONE automatic Nuxt reload (soft refresh) then boot again.
------------------------------------------------------------- */
const playerRef = ref<InstanceType<typeof GamePlayer> | null>(null)
const playerKey = ref(0)
const booting = ref(true)

function hardStop() {
  try {
    playerRef.value?.stop?.()
  } catch {}
}

async function delay(ms: number) {
  await new Promise((r) => setTimeout(r, ms))
}

// start is sometimes too early after navigation.
// nextTick + RAFs + small delay is usually enough.
async function safeStart() {
  await nextTick()
  await new Promise<void>((r) => requestAnimationFrame(() => r()))
  await new Promise<void>((r) => requestAnimationFrame(() => r()))
  await delay(80)
  playerRef.value?.start?.()
}

async function bootOnce() {
  booting.value = true
  try {
    await safeStart()
  } finally {
    booting.value = false
  }
}

async function retryBoot(attempts = 2) {
  for (let i = 0; i <= attempts; i++) {
    if (!isPlayable.value) return
    try {
      await bootOnce()
      // give it a moment to actually render
      await delay(150)
      // if GamePlayer exposes isRunning, use it. Otherwise we just assume attempt helped.
      const running = (playerRef.value as any)?.isRunning?.() ?? true
      if (running) return
    } catch {}
    // try again with a fresh mount
    hardStop()
    playerKey.value++
    await delay(120)
  }
}

// ✅ one-time auto refresh flag (per visit)
const didAutoRefresh = ref(false)

async function autoRefreshOnceIfNeeded() {
  if (!import.meta.client) return
  if (didAutoRefresh.value) return

  // Wait a bit; if still blank, do one reload
  await delay(650)
  if (!isPlayable.value) return

  // If GamePlayer can tell running state:
  const running = (playerRef.value as any)?.isRunning?.() ?? false

  // If no API, we still use a conservative approach:
  // if booting ended and user still sees blank, they normally refresh.
  // We do it once automatically.
  if (!running) {
    didAutoRefresh.value = true
    // mark in session to avoid loops
    sessionStorage.setItem(`ia.tourney.autorefresh.${tournamentSlug.value}`, '1')

    // Soft reload Nuxt app (better than location.reload for SPA)
    try {
      await refreshNuxtData()
    } catch {}

    // Final fallback: full reload (still only once)
    window.location.reload()
  }
}

onMounted(async () => {
  // prevent infinite loops across refresh
  const key = `ia.tourney.autorefresh.${tournamentSlug.value}`
  didAutoRefresh.value = sessionStorage.getItem(key) === '1'

  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', onPageHide)

  if (isPlayable.value) {
    await retryBoot(2)
    // If still problematic, do one auto refresh
    await autoRefreshOnceIfNeeded()
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibility)
  window.removeEventListener('pagehide', onPageHide)
})

function hardReloadPlayer() {
  hardStop()
  playerKey.value++
  retryBoot(2).catch(() => {})
}

function onVisibility() {
  if (!isPlayable.value) return
  if (document.visibilityState === 'visible') {
    retryBoot(1).catch(() => {})
  } else {
    hardStop()
  }
}
function onPageHide() {
  hardStop()
}

/* ---------------- Navigation ---------------- */
function goBack() {
  if (history.length > 1) router.back()
  else navigateTo(`/tournaments/${tournamentSlug.value}`)
}

function requestFullscreen() {
  if (!showFullscreen.value) return
  playerRef.value?.requestFullscreen?.()
}

/* ---------------- Submit score ---------------- */
async function onScore(score: number) {
  if (!isPlayable.value) return

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
</script>

<template>
  <div class="fixed inset-0 bg-black text-white">
    <!-- Top bar -->
    <div
        class="absolute left-0 right-0 top-0 z-[220] pointer-events-auto
             border-b border-white/10 bg-black/70 backdrop-blur"
        :style="{ paddingTop: 'env(safe-area-inset-top)' }"
    >
      <div class="h-14 px-3 flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 min-w-0">
          <UButton variant="ghost" class="!rounded-full" @click="goBack">
            <UIcon name="i-heroicons-arrow-left" class="w-5 h-5" />
            <span class="hidden sm:inline">Back</span>
          </UButton>

          <div class="min-w-0">
            <div class="text-sm font-semibold truncate">{{ t!.title }}</div>
            <div class="text-xs opacity-70 truncate">
              {{ game!.name }}
              <span class="mx-2 opacity-40">•</span>
              <template v-if="isPlayable">
                Ends in <span class="font-mono">{{ msToClock(endsInMs) }}</span>
              </template>
              <template v-else>
                Starts in <span class="font-mono">{{ msToClock(startsInMs) }}</span>
              </template>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <UButton
              v-if="showFullscreen"
              variant="ghost"
              class="!rounded-full"
              @click="requestFullscreen"
              title="Fullscreen"
          >
            <UIcon name="i-heroicons-arrows-pointing-out" class="w-5 h-5" />
            <span class="hidden sm:inline">Fullscreen</span>
          </UButton>

          <UButton variant="soft" class="!rounded-full" @click="hardReloadPlayer" title="Reload game">
            <UIcon name="i-heroicons-arrow-path" class="w-5 h-5" />
            <span class="hidden sm:inline">Reload</span>
          </UButton>
        </div>
      </div>
    </div>

    <!-- Game area -->
    <div
        class="absolute inset-0 z-[210]"
        :style="{
        paddingTop: 'calc(env(safe-area-inset-top) + 56px)',
        paddingBottom: 'env(safe-area-inset-bottom)'
      }"
    >
      <div class="h-full p-2">
        <ClientOnly>
          <!-- Not playable screen -->
          <div
              v-if="!isPlayable"
              class="h-full grid place-items-center rounded-2xl border border-white/10 bg-white/5 p-6"
          >
            <div class="text-center max-w-md">
              <div class="text-lg font-semibold">Tournament is not live</div>
              <p class="mt-2 text-sm opacity-80">
                You can’t play outside the tournament window.
              </p>

              <div class="mt-4 flex flex-wrap gap-2 justify-center">
                <UButton class="!rounded-full" :to="`/tournaments/${tournamentSlug}`">
                  Back to details
                </UButton>
                <UButton variant="soft" class="!rounded-full" to="/tournaments">
                  All tournaments
                </UButton>
              </div>
            </div>
          </div>

          <!-- Playable -->
          <div v-else class="h-full">
            <div v-if="booting" class="mb-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm opacity-80">
              Loading game…
            </div>

            <GamePlayer
                :key="playerKey"
                ref="playerRef"
                :game="game!"
                :defer="true"
                :fullscreen="true"
                @score="(e) => onScore(e.score)"
            />
          </div>
        </ClientOnly>
      </div>
    </div>
  </div>
</template>
