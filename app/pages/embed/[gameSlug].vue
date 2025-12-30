<script setup lang="ts">
import { GAMES } from '@/data/games'

definePageMeta({ layout: 'embed' })

const route = useRoute()
const slug = computed(() => String(route.params.gameSlug || ''))
const game = computed(() => GAMES.find(g => g.slug === slug.value))

if (!game.value) {
  throw createError({ statusCode: 404, statusMessage: 'Game not found' })
}

useHead(() => ({
  title: `${game.value!.name} — Embed`
}))

// Tell parent page "ready"
onMounted(() => {
  window.parent?.postMessage({ type: 'EMBED_READY', gameSlug: slug.value }, '*')
})

const { submitScore } = useLeaderboard()
const player = ref('Guest')

async function forwardScore(score: number) {
  // 1) submit to central leaderboard
  await submitScore({
    gameSlug: slug.value,
    player: player.value,
    score,
    source: 'embed'
  })

  // 2) forward to parent site (optional)
  window.parent?.postMessage({ type: 'SCORE', gameSlug: slug.value, score }, '*')
}

</script>

<template>
  <div class="p-3">
    <ArcadeGamePlayer
        :game="game!"
        :minimal-ui="true"
        @score="(e) => forwardScore(e.score)"
    />

    <!-- Optional mini footer -->
    <div class="mt-3 flex items-center justify-between text-xs opacity-75">
      <span>{{ game!.name }}</span>
      <NuxtLink :to="`/arcade/${game!.slug}`" class="hover:opacity-100 underline">
        Play on Illusion Arc
      </NuxtLink>
    </div>
  </div>
</template>
