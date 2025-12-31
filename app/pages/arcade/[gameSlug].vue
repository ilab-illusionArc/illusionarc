<script setup lang="ts">
import { GAMES } from '@/data/games'
import GamePlayer from '@/components/arcade/GamePlayer.vue'
import TopScoresPanel from '@/components/arcade/TopScoresPanel.vue'

const route = useRoute()
const router = useRouter()

const slug = computed(() => String(route.params.gameSlug || ''))
const game = computed(() => GAMES.find((g) => g.slug === slug.value))
if (!game.value) throw createError({ statusCode: 404, statusMessage: 'Game not found' })

useHead(() => ({
  title: `${game.value!.name} — Arcade`,
  meta: [{ name: 'description', content: game.value!.shortPitch }]
}))

// ---- iOS detection (covers iPadOS too) ----
const isIOS = computed(() => {
  if (import.meta.server) return false
  const ua = navigator.userAgent || ''
  const iOS = /iPad|iPhone|iPod/.test(ua)
  const iPadOS = navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1
  return iOS || iPadOS
})
const showFullscreen = computed(() => !isIOS.value)

// ---- leaderboard ----
const { submitScore } = useLeaderboard()
const playerName = useState<string>('playerName', () => 'Player')
const lastScore = ref<number | null>(null)
const saving = ref(false)

async function onScore(score: number) {
  lastScore.value = score
  saving.value = true
  try {
    await submitScore({ gameSlug: game.value!.slug, player: playerName.value, score, source: 'arcade' })
  } finally {
    saving.value = false
  }
}

// ---- lobby actions ----
const liked = ref(false)
const fav = ref(false)
const showControls = ref(false)

onMounted(() => {
  liked.value = localStorage.getItem(`like_${game.value!.slug}`) === '1'
  fav.value = localStorage.getItem(`fav_${game.value!.slug}`) === '1'
})
watch(liked, (v) => localStorage.setItem(`like_${game.value!.slug}`, v ? '1' : '0'))
watch(fav, (v) => localStorage.setItem(`fav_${game.value!.slug}`, v ? '1' : '0'))

// ---- play state in URL: ?play=1 ----
const playing = computed(() => route.query.play === '1')

// Force remount to kill audio + iframe state
const playerKey = ref(0)
const playerRef = ref<InstanceType<typeof GamePlayer> | null>(null)

function openPlay() {
  router.push({ query: { ...route.query, play: '1' } })
}

function closePlay() {
  const q: Record<string, any> = { ...route.query }
  delete q.play
  router.replace({ query: q })
}

function requestFullscreen() {
  if (!showFullscreen.value) return
  playerRef.value?.requestFullscreen?.()
}

function hardStop() {
  playerRef.value?.stop?.()
  playerKey.value++
}

watch(
    playing,
    async (v) => {
      if (v) {
        await nextTick()
        playerRef.value?.start?.()
      } else {
        hardStop()
      }
    },
    { immediate: true }
)

// ---- focus/visibility behavior ----
// If it was stopped, resume when visible again.
function onVisibilityChange() {
  if (!playing.value) return
  if (document.visibilityState === 'visible') {
    playerRef.value?.start?.()
  }
}

// iOS BFCache / pagehide: stop iframe to prevent "black page + sound"
function onPageHide() {
  hardStop()
}

onMounted(() => {
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('pagehide', onPageHide)
})
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibilityChange)
  window.removeEventListener('pagehide', onPageHide)
})

// ---- ratings (optional) ----
const ratingValue = computed(() => (game.value as any)?.rating?.value ?? 0)
const ratingCount = computed(() => (game.value as any)?.rating?.count ?? 0)
const fullStars = computed(() => Math.floor(ratingValue.value))
</script>

<template>
  <UContainer class="py-10 md:py-14">
    <div class="flex flex-col gap-2">
      <h1 class="text-3xl md:text-5xl font-semibold tracking-tight">{{ game!.name }}</h1>
      <p class="opacity-80 max-w-2xl">{{ game!.shortPitch }}</p>

      <div class="mt-2 flex flex-wrap gap-2 text-xs">
        <span v-if="game!.genre" class="px-2 py-1 rounded-full bg-black/30 border border-white/10">{{ game!.genre }}</span>
        <span v-if="game!.difficulty" class="px-2 py-1 rounded-full bg-black/30 border border-white/10">{{ game!.difficulty }}</span>
        <span v-if="game!.leaderboard" class="px-2 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/20">Leaderboard</span>
        <span v-if="game!.embedAllowed" class="px-2 py-1 rounded-full bg-white/5 border border-white/10">Embeddable</span>
        <span v-if="game!.estTime" class="px-2 py-1 rounded-full bg-white/5 border border-white/10">{{ game!.estTime }}</span>
      </div>
    </div>

    <!-- Lobby Card -->
    <UCard class="mt-6 bg-white/5 border-white/10 overflow-hidden">
      <div class="grid gap-4 md:grid-cols-2">
        <div class="rounded-2xl overflow-hidden border border-white/10 bg-black/20">
          <NuxtImg
              :src="game!.thumbnail"
              format="webp"
              width="1200"
              height="675"
              sizes="(max-width: 768px) 100vw, 520px"
              class="w-full h-48 md:h-full object-cover"
              loading="eager"
              fetchpriority="high"
              alt="Game preview"
          />
        </div>

        <div class="flex flex-col justify-between gap-4">
          <!-- Rating -->
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-1">
              <UIcon
                  v-for="i in 5"
                  :key="i"
                  :name="i <= fullStars ? 'i-heroicons-star-solid' : 'i-heroicons-star'"
                  class="w-5 h-5 opacity-90"
              />
            </div>
            <div class="text-sm opacity-80">
              <b class="opacity-100">{{ Number(ratingValue).toFixed(1) }}</b>
              <span class="opacity-70">({{ ratingCount }} ratings)</span>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex flex-wrap gap-2">
            <UButton color="primary" variant="solid" size="lg" @click="openPlay">
              <UIcon name="i-heroicons-play-solid" class="w-5 h-5" />
              Play
            </UButton>

            <UButton variant="soft" size="lg" @click="liked = !liked" :aria-pressed="liked">
              <UIcon :name="liked ? 'i-heroicons-heart-solid' : 'i-heroicons-heart'" class="w-5 h-5" />
              Like
            </UButton>

            <UButton variant="soft" size="lg" @click="fav = !fav" :aria-pressed="fav">
              <UIcon :name="fav ? 'i-heroicons-bookmark-solid' : 'i-heroicons-bookmark'" class="w-5 h-5" />
              Favourite
            </UButton>

            <UButton variant="ghost" size="lg" @click="showControls = true">
              <UIcon name="i-heroicons-information-circle" class="w-5 h-5" />
              Controls
            </UButton>
          </div>

          <div class="text-sm opacity-70" v-if="lastScore !== null">
            Last score: <b class="opacity-100">{{ lastScore }}</b>
            <span v-if="saving" class="ml-2 opacity-60">Saving…</span>
          </div>
        </div>
      </div>
    </UCard>

    <!-- Info + Leaderboard -->
    <div class="mt-10 grid gap-6 md:grid-cols-3">
      <div class="md:col-span-2 grid gap-6">
        <UCard class="bg-white/5 border-white/10">
          <template #header><div class="text-lg font-semibold">How to play</div></template>
          <ul class="space-y-2 opacity-85">
            <li v-for="(c, i) in game!.controls" :key="i">• {{ c }}</li>
          </ul>
        </UCard>
      </div>

      <TopScoresPanel v-if="game!.leaderboard" :game-slug="game!.slug" :limit="10" />
    </div>

    <!-- Controls Modal -->
    <UModal v-model="showControls">
      <UCard class="bg-white/5 border-white/10">
        <template #header><div class="text-lg font-semibold">Controls</div></template>
        <ul class="space-y-2 opacity-85">
          <li v-for="(c, i) in game!.controls" :key="i">• {{ c }}</li>
        </ul>
        <div class="mt-4 flex justify-end">
          <UButton color="primary" variant="solid" @click="showControls = false">Close</UButton>
        </div>
      </UCard>
    </UModal>

    <!-- Fullscreen Overlay -->
    <Teleport to="body">
      <div v-if="playing" class="fixed inset-0 z-[200] bg-black">
        <!-- Header -->
        <div
            class="absolute left-0 right-0 top-0 z-[220] pointer-events-auto border-b border-white/10 bg-black/70 backdrop-blur"
            :style="{ paddingTop: 'env(safe-area-inset-top)' }"
        >
          <div class="h-14 px-3 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="font-semibold">{{ game!.name }}</span>
              <span class="text-xs opacity-70">Play</span>
            </div>

            <div class="flex items-center gap-2">
              <!-- Fullscreen: only non-iOS -->
              <UButton v-if="showFullscreen" variant="ghost" @click="requestFullscreen">
                <UIcon name="i-heroicons-arrows-pointing-out" class="w-5 h-5" />
                Fullscreen
              </UButton>

              <UButton variant="ghost" @click="closePlay">
                <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
                Close
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
            <GamePlayer
                :key="playerKey"
                ref="playerRef"
                :game="game!"
                :defer="true"
                :fullscreen="true"
                @score="(e) => onScore(e.score)"
            />
          </div>
        </div>
      </div>
    </Teleport>
  </UContainer>
</template>
