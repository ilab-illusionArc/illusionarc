<script setup lang="ts">
import { GAMES } from '@/data/games'
import GamePlayer from '@/components/arcade/GamePlayer.vue'
import TopScoresPanel from '@/components/arcade/TopScoresPanel.vue'

const route = useRoute()
const slug = computed(() => String(route.params.gameSlug || ''))
const game = computed(() => GAMES.find((g) => g.slug === slug.value))
if (!game.value) throw createError({ statusCode: 404, statusMessage: 'Game not found' })

useHead(() => ({
  title: `${game.value!.name} — Arcade`,
  meta: [{ name: 'description', content: game.value!.shortPitch }]
}))

// Leaderboard
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

// Like/Favourite local
const liked = ref(false)
const fav = ref(false)

onMounted(() => {
  liked.value = localStorage.getItem(`like_${game.value!.slug}`) === '1'
  fav.value = localStorage.getItem(`fav_${game.value!.slug}`) === '1'
})

watch(liked, v => localStorage.setItem(`like_${game.value!.slug}`, v ? '1' : '0'))
watch(fav, v => localStorage.setItem(`fav_${game.value!.slug}`, v ? '1' : '0'))

// Controls modal
const showControls = ref(false)

// Play overlay
const playing = ref(false)
const playerRef = ref<any>(null)

function openPlay() {
  playing.value = true
  nextTick(() => {
    // ✅ start loading Unity only now
    playerRef.value?.start?.()
    // request fullscreen if available
    playerRef.value?.requestFullscreen?.()
  })
}

function closePlay() {
  playing.value = false
}

const ratingValue = computed(() => game.value?.rating?.value ?? 0)
const ratingCount = computed(() => game.value?.rating?.count ?? 0)
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
              <b class="opacity-100">{{ ratingValue.toFixed(1) }}</b>
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

    <!-- Fullscreen Play Overlay -->
    <Teleport to="body">
      <div v-if="playing" class="fixed inset-0 z-[200] bg-black">
        <div class="h-14 px-3 flex items-center justify-between border-b border-white/10 bg-black/60 backdrop-blur">
          <div class="flex items-center gap-2">
            <span class="font-semibold">{{ game!.name }}</span>
            <span class="text-xs opacity-70">Play</span>
          </div>
          <UButton variant="ghost" @click="closePlay">
            <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
            Close
          </UButton>
        </div>

        <div class="p-2 h-[calc(100vh-56px)]">
          <!-- ✅ defer loading until play -->
          <GamePlayer
              ref="playerRef"
              :game="game!"
              :defer="true"
              :minimal-ui="true"
              :fullscreen="true"
              @score="(e) => onScore(e.score)"
          />
        </div>
      </div>
    </Teleport>
  </UContainer>
</template>
