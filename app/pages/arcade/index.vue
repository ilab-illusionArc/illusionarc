<script setup lang="ts">
import { GAMES } from '@/data/games'

useHead({ title: 'Arcade' })

const q = ref('')
const genre = ref<string>('all')
const onlyFeatured = ref(false)

const genres = computed(() => {
  const set = new Set<string>()
  GAMES.forEach(g => g.genre && set.add(g.genre))
  return ['all', ...Array.from(set)]
})

const filtered = computed(() => {
  const text = q.value.trim().toLowerCase()
  return GAMES.filter(g => {
    if (onlyFeatured.value && !g.featured) return false
    if (genre.value !== 'all' && g.genre !== genre.value) return false
    if (!text) return true
    return (
        g.name.toLowerCase().includes(text) ||
        g.shortPitch.toLowerCase().includes(text) ||
        (g.genre || '').toLowerCase().includes(text)
    )
  })
})

const featured = computed(() => GAMES.filter(g => g.featured))
</script>

<template>
  <UContainer class="py-12">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-3xl font-semibold">Arcade</h1>
        <p class="mt-2 opacity-80">Play, score, and climb the leaderboard.</p>
      </div>

      <div class="flex flex-wrap gap-2 items-center">
        <UInput v-model="q" placeholder="Search games…" class="w-60" />
        <USelect v-model="genre" :options="genres" class="w-40" />
        <UCheckbox v-model="onlyFeatured" label="Featured" />
        <UButton to="/arcade/leaderboard" variant="solid" color="primary">
          Leaderboard
        </UButton>
      </div>
    </div>

    <!-- Featured row -->
    <div v-if="featured.length" class="mt-8">
      <div class="text-sm uppercase tracking-wider opacity-60">Featured</div>
      <div class="mt-3 grid gap-4 md:grid-cols-3">
        <NuxtLink
            v-for="g in featured"
            :key="g.slug"
            :to="`/arcade/${g.slug}`"
            class="group rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition overflow-hidden"
        >
          <NuxtImg
              :src="g.thumbnail"
              :alt="g.name"
              width="1600"
              height="900"
              sizes="(max-width: 768px) 100vw, 420px"
              class="h-44 w-full object-cover"
              loading="lazy"
          />
          <div class="p-4">
            <div class="flex items-center justify-between gap-2">
              <div class="font-semibold">{{ g.name }}</div>
              <span class="text-xs opacity-70" v-if="g.estTime">{{ g.estTime }}</span>
            </div>
            <div class="mt-1 text-sm opacity-75">{{ g.shortPitch }}</div>

            <div class="mt-3 flex flex-wrap gap-2 text-xs">
              <span v-if="g.genre" class="px-2 py-1 rounded-full bg-black/30 border border-white/10">{{ g.genre }}</span>
              <span v-if="g.difficulty" class="px-2 py-1 rounded-full bg-black/30 border border-white/10">{{ g.difficulty }}</span>
              <span v-if="g.leaderboard" class="px-2 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/20">
                Leaderboard
              </span>
            </div>
          </div>
        </NuxtLink>
      </div>
    </div>

    <!-- All games -->
    <div class="mt-10">
      <div class="text-sm uppercase tracking-wider opacity-60">All Games</div>

      <div class="mt-3 grid gap-4 md:grid-cols-3">
        <NuxtLink
            v-for="g in filtered"
            :key="g.slug"
            :to="`/arcade/${g.slug}`"
            class="group rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition overflow-hidden"
        >
          <NuxtImg
              :src="g.thumbnail"
              :alt="g.name"
              width="1600"
              height="900"
              sizes="(max-width: 768px) 100vw, 420px"
              class="h-44 w-full object-cover"
              loading="lazy"
          />
          <div class="p-4">
            <div class="flex items-center justify-between gap-2">
              <div class="font-semibold">{{ g.name }}</div>
              <span class="text-xs opacity-70" v-if="g.estTime">{{ g.estTime }}</span>
            </div>
            <div class="mt-1 text-sm opacity-75">{{ g.shortPitch }}</div>

            <div class="mt-3 flex flex-wrap gap-2 text-xs">
              <span v-if="g.genre" class="px-2 py-1 rounded-full bg-black/30 border border-white/10">{{ g.genre }}</span>
              <span v-if="g.difficulty" class="px-2 py-1 rounded-full bg-black/30 border border-white/10">{{ g.difficulty }}</span>
              <span v-if="g.leaderboard" class="px-2 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/20">
                Leaderboard
              </span>
              <span v-if="g.embedAllowed" class="px-2 py-1 rounded-full bg-white/5 border border-white/10">
                Embeddable
              </span>
            </div>
          </div>
        </NuxtLink>
      </div>

      <div v-if="filtered.length === 0" class="mt-10 text-center opacity-70">
        No games match your filters.
      </div>
    </div>
  </UContainer>
</template>
