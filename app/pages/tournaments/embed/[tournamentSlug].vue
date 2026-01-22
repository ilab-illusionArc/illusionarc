<script setup lang="ts">
import { GAMES } from '~/data/games'
import { TOURNAMENTS as FALLBACK } from '~/data/tournaments'
import { useTournaments } from '~/composables/useTournaments'
import { useTournamentLeaderboard } from '~/composables/useTournamentLeaderboard'
import GamePlayer from '~/components/arcade/GamePlayer.vue'

definePageMeta({ layout: 'embed', middleware: ['subscription-required'] })

const route = useRoute()
const router = useRouter()
const toast = useToast()

const slug = computed(() => String(route.params.tournamentSlug || '').trim())
const { bySlug } = useTournaments()
const { submitScore } = useTournamentLeaderboard()

type AnyTournament = any
const t = ref<AnyTournament | null>(null)

try {
  t.value = await bySlug(slug.value)
  if (!t.value) t.value = (FALLBACK as any).find((x: any) => x.slug === slug.value) || null
} catch {
  t.value = (FALLBACK as any).find((x: any) => x.slug === slug.value) || null
}

if (!t.value) throw createError({ statusCode: 404, statusMessage: 'Tournament not found' })

function getGameSlug(x: AnyTournament) {
  return String(x?.game_slug ?? x?.gameSlug ?? '').trim()
}
function getStartsAt(x: AnyTournament) {
  return String(x?.starts_at ?? x?.startsAt ?? '').trim()
}
function getEndsAt(x: AnyTournament) {
  return String(x?.ends_at ?? x?.endsAt ?? '').trim()
}

const now = ref(Date.now())
let timer: any = null
onMounted(() => (timer = setInterval(() => (now.value = Date.now()), 1000)))
onBeforeUnmount(() => timer && clearInterval(timer))

const inWindow = computed(() => {
  const s = new Date(getStartsAt(t.value)).getTime()
  const e = new Date(getEndsAt(t.value)).getTime()
  return now.value >= s && now.value < e
})

const game = computed(() => GAMES.find(g => g.slug === getGameSlug(t.value)) || null)
if (!game.value) throw createError({ statusCode: 404, statusMessage: 'Game not found' })

useHead(() => ({
  title: `${t.value!.title} — Play`,
  meta: [{ name: 'robots', content: 'noindex' }]
}))

// iOS detection (also iPadOS)
const isIOS = computed(() => {
  if (import.meta.server) return false
  const ua = navigator.userAgent || ''
  const iOS = /iPad|iPhone|iPod/.test(ua)
  const iPadOS = navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1
  return iOS || iPadOS
})
const showFullscreen = computed(() => !isIOS.value)

const playerRef = ref<InstanceType<typeof GamePlayer> | null>(null)
const playerKey = ref(0)
const booting = ref(true)

async function boot() {
  booting.value = true
  await nextTick()
  // small delay helps iframe/canvas settle
  await new Promise((r) => setTimeout(r, 50))
  playerRef.value?.start?.()
  booting.value = false
}

onMounted(async () => {
  await boot()
})

watch(inWindow, async (v) => {
  // if tournament ended while playing, stop
  if (!v) {
    playerRef.value?.stop?.()
    toast.add({ title: 'Tournament ended', color: 'info' })
  }
})

function requestFullscreen() {
  if (!showFullscreen.value) return
  playerRef.value?.requestFullscreen?.()
}

function goBack() {
  // try browser back; fallback to tournament page
  if (history.length > 1) router.back()
  else navigateTo(`/tournaments/${slug.value}`)
}

async function onScore(score: number) {
  if (!inWindow.value) return

  try {
    await $fetch('/api/tournaments/submit', {
      method: 'POST',
      credentials: 'include',
      body: {
        tournamentSlug: slug.value,
        score
      }
    })
  } catch (e: any) {
    toast.add({
      title: 'Score submit failed',
      description: e?.data?.message || e?.message || 'Try again',
      color: 'error'
    })
  }
}

// If something goes blank, user can tap Reload
function hardReloadPlayer() {
  playerRef.value?.stop?.()
  playerKey.value++
  boot()
}
</script>

<template>
  <div class="fixed inset-0 bg-black">
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
            Back
          </UButton>

          <div class="min-w-0">
            <div class="text-sm font-semibold truncate">{{ t!.title }}</div>
            <div class="text-xs opacity-70 truncate">{{ game!.name }}</div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <UButton v-if="showFullscreen" variant="ghost" class="!rounded-full" @click="requestFullscreen">
            <UIcon name="i-heroicons-arrows-pointing-out" class="w-5 h-5" />
            Fullscreen
          </UButton>

          <UButton variant="soft" class="!rounded-full" @click="hardReloadPlayer">
            <UIcon name="i-heroicons-arrow-path" class="w-5 h-5" />
            Reload
          </UButton>
        </div>
      </div>
    </div>

    <!-- Game area -->
    <div
      class="absolute inset-0 z-[210]"
      :style="{ paddingTop: 'calc(env(safe-area-inset-top) + 56px)', paddingBottom: 'env(safe-area-inset-bottom)' }"
    >
      <div class="h-full p-2">
        <ClientOnly>
          <div v-if="!inWindow" class="h-full grid place-items-center rounded-2xl border border-white/10 bg-white/5 p-6">
            <div class="text-center max-w-md">
              <div class="text-lg font-semibold">Tournament is not live</div>
              <p class="mt-2 text-sm opacity-80">You can’t play outside the tournament window.</p>
              <div class="mt-4">
                <UButton class="!rounded-full" :to="`/tournaments/${slug}`">Back to details</UButton>
              </div>
            </div>
          </div>

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
