<script setup lang="ts">
import { GAMES } from '@/data/games'
import ArcadeGamePlayer from '@/components/arcade/GamePlayer.vue'
import TopScoresPanel from '@/components/arcade/TopScoresPanel.vue'

const route = useRoute()
const slug = computed(() => String(route.params.gameSlug || ''))

const game = computed(() => GAMES.find((g) => g.slug === slug.value))
if (!game.value) {
  throw createError({ statusCode: 404, statusMessage: 'Game not found' })
}

useHead(() => ({
  title: `${game.value!.name} — Arcade`,
  meta: [{ name: 'description', content: game.value!.shortPitch }]
}))

const { submitScore } = useLeaderboard()
const playerName = useState<string>('playerName', () => 'Player')
const lastScore = ref<number | null>(null)
const saving = ref(false)

async function onScore(score: number) {
  lastScore.value = score
  saving.value = true
  try {
    await submitScore({
      gameSlug: game.value!.slug,
      player: playerName.value,
      score,
      source: 'arcade'
    })
  } finally {
    saving.value = false
  }
}

const embedCode = computed(() => {
  const base = process.client ? window.location.origin : 'https://yourdomain.com'
  const ar = game.value!.embed.aspectRatio || '16/9'
  return `<iframe
  src="${base}/embed/${game.value!.slug}?ui=min"
  style="width:100%;max-width:1100px;aspect-ratio:${ar};border:0;border-radius:16px;overflow:hidden"
  allow="fullscreen; autoplay; gamepad"
  loading="lazy"
></iframe>`
})

async function copyEmbed() {
  await navigator.clipboard.writeText(embedCode.value)
}
</script>

<template>
  <UContainer class="py-10 md:py-14">
    <!-- Header -->
    <div class="flex flex-col gap-2">
      <div class="flex items-start justify-between gap-4">
        <div class="max-w-3xl">
          <h1 class="text-3xl md:text-5xl font-semibold tracking-tight">
            {{ game!.name }}
          </h1>
          <p class="mt-2 opacity-80">
            {{ game!.shortPitch }}
          </p>

          <div class="mt-3 flex flex-wrap gap-2 text-xs">
            <span
                v-if="game!.genre"
                class="px-2 py-1 rounded-full bg-black/30 border border-white/10"
            >
              {{ game!.genre }}
            </span>
            <span
                v-if="game!.difficulty"
                class="px-2 py-1 rounded-full bg-black/30 border border-white/10"
            >
              {{ game!.difficulty }}
            </span>
            <span
                v-if="game!.leaderboard"
                class="px-2 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/20"
            >
              Leaderboard
            </span>
            <span
                v-if="game!.embedAllowed"
                class="px-2 py-1 rounded-full bg-white/5 border border-white/10"
            >
              Embeddable
            </span>
            <span v-if="game!.estTime" class="px-2 py-1 rounded-full bg-white/5 border border-white/10">
              {{ game!.estTime }}
            </span>
          </div>
        </div>

        <div class="hidden md:flex gap-2">
          <UButton to="/arcade" variant="ghost">Back</UButton>
          <UButton v-if="game!.embedAllowed" :to="`/embed/${game!.slug}`" variant="solid" color="primary">
            Embed Page
          </UButton>
          <UButton to="/arcade/leaderboard" variant="ghost">
            Leaderboard
          </UButton>
        </div>
      </div>
    </div>

    <!-- Player -->
    <div class="mt-6">
      <ArcadeGamePlayer :game="game!" @score="(e) => onScore(e.score)" />
      <div class="mt-3 flex items-center gap-3 text-sm opacity-75">
        <p v-if="lastScore !== null">
          Last score received: <b class="opacity-100">{{ lastScore }}</b>
        </p>
        <span v-if="saving" class="text-xs opacity-60">Saving…</span>
      </div>
    </div>

    <!-- Info + Scores -->
    <div class="mt-10 grid gap-6 md:grid-cols-3">
      <div class="md:col-span-2 grid gap-6">
        <UCard class="bg-white/5 border-white/10">
          <template #header>
            <div class="text-lg font-semibold">How to play</div>
          </template>
          <ul class="space-y-2 opacity-85">
            <li v-for="(c, i) in game!.controls" :key="i">• {{ c }}</li>
          </ul>
        </UCard>

        <UCard class="bg-white/5 border-white/10">
          <template #header>
            <div class="text-lg font-semibold">Share</div>
          </template>

          <div class="flex flex-wrap gap-2">
            <UButton
                variant="solid"
                color="primary"
                @click="navigator.share?.({ title: game!.name, url: location.href })"
            >
              Share
            </UButton>
            <UButton variant="ghost" @click="navigator.clipboard.writeText(location.href)">
              Copy link
            </UButton>
          </div>
        </UCard>

        <UCard v-if="game!.embedAllowed" class="bg-white/5 border-white/10">
          <template #header>
            <div class="text-lg font-semibold">Embed this game</div>
            <div class="text-sm opacity-70">Use this snippet on partner sites.</div>
          </template>

          <pre
              class="text-xs md:text-sm whitespace-pre-wrap rounded-xl border border-white/10 bg-black/30 p-4 overflow-auto"
          >{{ embedCode }}</pre>

          <div class="mt-3">
            <UButton color="primary" variant="solid" @click="copyEmbed">
              Copy embed code
            </UButton>
          </div>
        </UCard>
      </div>

      <TopScoresPanel v-if="game!.leaderboard" :game-slug="game!.slug" :limit="10" />
    </div>

    <!-- Mobile action bar -->
    <div class="md:hidden mt-8 flex flex-wrap gap-2">
      <UButton to="/arcade" variant="ghost" block>Back</UButton>
      <UButton to="/arcade/leaderboard" variant="ghost" block>Leaderboard</UButton>
      <UButton v-if="game!.embedAllowed" :to="`/embed/${game!.slug}`" variant="solid" color="primary" block>
        Embed Page
      </UButton>
    </div>
  </UContainer>
</template>
