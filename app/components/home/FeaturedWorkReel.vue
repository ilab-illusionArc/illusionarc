<script setup lang="ts">
import { PLACEHOLDER_IMG } from '~/constants/media'
const { works } = useContent()
const featured = computed(() => works.slice(0, 8))
</script>

<template>
  <section class="relative py-14">
    <UContainer>
      <div class="flex items-end justify-between gap-4" data-reveal>
        <div>
          <h2 class="text-2xl md:text-3xl font-semibold">Featured Work</h2>
          <p class="mt-2 opacity-80">A quick reel of case studies.</p>
        </div>
        <UButton class="press hidden sm:inline-flex" variant="outline" to="/work">View All</UButton>
      </div>

      <div class="mt-8 reel" data-reveal>
        <NuxtLink
            v-for="w in featured"
            :key="w.slug"
            :to="`/work/${w.slug}`"
            class="tile press"
        >
          <NuxtImg
              :src="w.hero?.src || PLACEHOLDER_IMG"
              :alt="w.hero?.alt || w.title"
              width="1600"
              height="900"
              sizes="(max-width: 768px) 78vw, 360px"
              class="thumb"
              loading="lazy"
          />

          <div class="top">
            <div class="font-semibold line-clamp-1">{{ w.title }}</div>
            <UBadge variant="subtle">{{ w.category }}</UBadge>
          </div>

          <div class="mt-2 text-sm opacity-80 line-clamp-2">{{ w.shortDescription }}</div>

          <div class="mt-4 flex flex-wrap gap-2">
            <UBadge v-for="t in w.tags.slice(0, 3)" :key="t" variant="outline">{{ t }}</UBadge>
          </div>

          <div class="mt-6 text-sm opacity-60">{{ w.year }} • {{ w.role }}</div>
        </NuxtLink>
      </div>
    </UContainer>
  </section>
</template>

<style scoped>
.reel{
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(280px, 1fr);
  gap: 14px;
  overflow-x: auto;
  padding-bottom: 10px;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
}
.tile{
  scroll-snap-align: start;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.04);
  border-radius: 18px;
  padding: 14px;
  transition: border-color .18s ease, background .18s ease;
}
.tile:hover{
  border-color: rgba(255,255,255,.20);
  background: rgba(255,255,255,.06);
}
.thumb{
  height: 172px;
  width: 100%;
  object-fit: cover;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.05);
}
.top{
  margin-top: 12px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
}
</style>
