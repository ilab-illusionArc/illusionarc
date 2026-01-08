<script setup lang="ts">
import { PLACEHOLDER_IMG } from '~/constants/media'
const { games } = useContent()
const featured = computed(() => games[0])
</script>

<template>
  <section class="relative py-14">
    <GlowBackdrop />

    <UContainer>
      <div class="grid gap-6 md:grid-cols-2 items-center">
        <div data-reveal>
          <h2 class="text-2xl md:text-3xl font-semibold text-black dark:text-white">
            Mini Arcade
          </h2>

          <p class="mt-2 text-black/70 dark:text-white/70">
            Play instantly — no signup. Selected games support leaderboards and embeds.
          </p>

          <div class="mt-6 flex flex-wrap gap-3">
            <UButton class="press" color="primary" to="/arcade">Open Arcade</UButton>
            <UButton class="press" variant="outline" to="/arcade/leaderboard">Leaderboard</UButton>
          </div>
        </div>

        <UCard
            v-if="featured"
            class="press overflow-hidden border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur"
            data-reveal
        >
          <NuxtImg
              :src="featured?.thumbnail || PLACEHOLDER_IMG"
              :alt="featured?.name || 'Game placeholder'"
              width="1600"
              height="900"
              sizes="(max-width: 768px) 100vw, 520px"
              class="h-44 w-full object-cover rounded-xl mb-3 border border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/30"
              loading="lazy"
          />

          <template #header>
            <div class="flex items-center justify-between gap-3">
              <div class="font-semibold text-black dark:text-white">
                {{ featured.name }}
              </div>
              <UBadge variant="subtle">{{ featured.category }}</UBadge>
            </div>
          </template>

          <p class="text-black/70 dark:text-white/70 text-sm">
            {{ featured.shortPitch }}
          </p>

          <div class="mt-4 flex flex-wrap gap-2 text-xs">
            <UBadge variant="outline">{{ featured.buildType }}</UBadge>
            <UBadge v-if="featured.leaderboardSupported" variant="outline">Leaderboard</UBadge>
            <UBadge v-if="featured.embedAllowed" variant="outline">Embeddable</UBadge>
          </div>

          <template #footer>
            <div class="flex justify-end">
              <UButton class="press" size="sm" color="primary" :to="`/arcade/${featured.slug}`">
                Play
              </UButton>
            </div>
          </template>
        </UCard>
      </div>
    </UContainer>
  </section>
</template>
