<!-- app/pages/tournaments/embed/[tournamentSlug].vue -->
<script setup lang="ts">
import { GAMES } from '~/data/games'
import { TOURNAMENTS as FALLBACK } from '~/data/tournaments'
import { useTournaments } from '~/composables/useTournaments'
import { useSubscription } from '~/composables/useSubscription'
import GamePlayer from '~/components/arcade/GamePlayer.vue'

definePageMeta({
  layout: 'embed',
  ssr: false,
  keepalive: false
})

const route = useRoute()
const router = useRouter()
const toast = useToast()

const supabase = useSupabaseClient()
const { bySlug } = useTournaments()
const { me } = useSubscription()

const tournamentSlug = computed(() => String(route.params.tournamentSlug || '').trim())

type AnyTournament = any
const t = ref<AnyTournament | null>(null)
const loading = ref(true)
const err = ref<string | null>(null)

const now = ref(Date.now())
let tick: any = null
onMounted(() => (tick = setInterval(() => (now.value = Date.now()), 1000)))
onBeforeUnmount(() => tick && clearInterval(tick))

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

const startMs = computed(() => (t.value ? safeTimeMs(getStartsAt(t.value)) : 0))
const endMs = computed(() => (t.value ? safeTimeMs(getEndsAt(t.value)) : 0))
const startsInMs = computed(() => Math.max(0, startMs.value - now.value))
const endsInMs = computed(() => Math.max(0, endMs.value - now.value))

const inTimeWindow = computed(() => {
  if (!startMs.value || !endMs.value) return false
  return now.value >= startMs.value && now.value < endMs.value
})

const isPlayable = computed(() => {
  if (!t.value) return false
  const st = getStatus(t.value)
  if (st === 'canceled') return false
  if (st === 'ended') return false
  // ✅ allow by time window even if status isn't updated yet
  return inTimeWindow.value
})

const game = computed(() => {
  if (!t.value) return null
  return GAMES.find((g) => g.slug === getGameSlug(t.value!)) || null
})

useHead(() => ({
  title: t.value ? `${t.value.title} — Play` : 'Tournament — Play',
  meta: [{ name: 'robots', content: 'noindex' }]
}))

/* ---------------- ✅ Force refresh of GamePlayer every mount ---------------- */
const playerMountKey = ref(0)
function refreshPlayerMount() {
  // Changing key forces GamePlayer + iframe to remount (same as manual refresh for the embed)
  playerMountKey.value = Date.now()
}

/* ---------------- Robust init (NO throws) ---------------- */
let initToken = 0

async function gateSubscription() {
  // Ensure client session is restored (important on SPA nav)
  await supabase.auth.getSession()

  const { data } = await supabase.auth.getUser()
  if (!data?.user?.id) {
    await navigateTo(`/login?next=${encodeURIComponent(route.fullPath)}`)
    return false
  }

  const s = await me().catch(() => null)
  if (!s?.active) {
    await navigateTo(`/subscribe?next=${encodeURIComponent(route.fullPath)}`)
    return false
  }

  return true
}

async function loadTournamentSafe() {
  try {
    const api = await bySlug(tournamentSlug.value)
    if (api) return api
  } catch {}
  return (FALLBACK as any).find((x: any) => x.slug === tournamentSlug.value) || null
}

async function init() {
  const myToken = ++initToken
  loading.value = true
  err.value = null
  t.value = null

  try {
    const ok = await gateSubscription()
    if (!ok) return

    const found = await loadTournamentSafe()
    if (myToken !== initToken) return

    if (!found) {
      err.value = 'Tournament not found'
      return
    }

    t.value = found

    if (!game.value) {
      err.value = 'Game not found'
      return
    }

    // ✅ after init, force a fresh mount
    refreshPlayerMount()
  } catch (e: any) {
    if (myToken !== initToken) return
    err.value = e?.data?.message || e?.message || 'Failed to load'
  } finally {
    if (myToken === initToken) loading.value = false
  }
}

onMounted(async () => {
  // ✅ refresh on every mount
  refreshPlayerMount()
  await init()
})

// ✅ re-init when param changes (coming back / navigating again)
watch(
  () => tournamentSlug.value,
  async () => {
    refreshPlayerMount()
    await init()
  }
)

// ✅ if it becomes playable (time crosses start), remount once again
watch(isPlayable, (v, prev) => {
  if (!prev && v) refreshPlayerMount()
})

/* ---------------- Navigation ---------------- */
function goBack() {
  if (history.length > 1) router.back()
  else navigateTo(`/tournaments/${tournamentSlug.value}`)
}

/* ---------------- Score submit ---------------- */
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
            <div class="text-sm font-semibold truncate">{{ t?.title || 'Tournament' }}</div>
            <div class="text-xs opacity-70 truncate" v-if="t">
              {{ game?.name || '' }}
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
          <UButton variant="soft" class="!rounded-full" @click="refreshPlayerMount()" title="Reload embed">
            <UIcon name="i-heroicons-arrow-path" class="w-5 h-5" />
            <span class="hidden sm:inline">Reload</span>
          </UButton>

          <UButton variant="soft" class="!rounded-full" @click="init" :loading="loading" title="Retry load">
            Retry
          </UButton>
        </div>
      </div>
    </div>

    <!-- Body -->
    <div
      class="absolute inset-0 z-[210]"
      :style="{
        paddingTop: 'calc(env(safe-area-inset-top) + 56px)',
        paddingBottom: 'env(safe-area-inset-bottom)'
      }"
    >
      <div class="h-full p-2">
        <ClientOnly>
          <div v-if="loading" class="h-full grid place-items-center rounded-2xl border border-white/10 bg-white/5 p-6">
            <div class="text-center">
              <div class="text-lg font-semibold">Loading…</div>
              <div class="mt-2 text-sm opacity-70">Preparing tournament session</div>
            </div>
          </div>

          <div v-else-if="err" class="h-full grid place-items-center rounded-2xl border border-white/10 bg-white/5 p-6">
            <div class="text-center max-w-md">
              <div class="text-lg font-semibold">{{ err }}</div>
              <div class="mt-4 flex justify-center gap-2">
                <UButton class="!rounded-full" :to="`/tournaments/${tournamentSlug}`">Back to details</UButton>
                <UButton variant="soft" class="!rounded-full" to="/tournaments">All tournaments</UButton>
              </div>
            </div>
          </div>

          <div v-else-if="!isPlayable" class="h-full grid place-items-center rounded-2xl border border-white/10 bg-white/5 p-6">
            <div class="text-center max-w-md">
              <div class="text-lg font-semibold">Tournament is not live</div>
              <p class="mt-2 text-sm opacity-80">You can’t play outside the tournament window.</p>
              <div class="mt-4 flex justify-center gap-2">
                <UButton class="!rounded-full" :to="`/tournaments/${tournamentSlug}`">Back to details</UButton>
                <UButton variant="soft" class="!rounded-full" to="/tournaments">All tournaments</UButton>
              </div>
            </div>
          </div>

          <!-- ✅ Playable -->
          <div v-else class="h-full">
            <GamePlayer
              :key="`${tournamentSlug}-${playerMountKey}`"
              :game="game!"
              :defer="false"
              :fullscreen="true"
              @score="(e) => onScore(e.score)"
            />
          </div>
        </ClientOnly>
      </div>
    </div>
  </div>
</template>
