<script setup lang="ts">
import { PLACEHOLDER_IMG } from '~/constants/media'
const { works } = useContent()
useHead({ title: 'Work' })
</script>

<template>
  <UContainer class="py-16">
    <div class="flex items-end justify-between gap-4" data-reveal>
      <div>
        <h1 class="text-3xl font-semibold">Work</h1>
        <p class="mt-2 opacity-80">Case studies across Games, AR/VR, VFX/CGI, and Animation.</p>
      </div>
    </div>

    <div class="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" data-reveal>
      <NuxtLink
          v-for="w in works"
          :key="w.slug"
          :to="`/work/${w.slug}`"
          class="block"
      >
        <UCard class="press bg-white/5 border-white/10 hover:border-white/20 transition overflow-hidden">
          <NuxtImg
              :src="w.hero?.src || PLACEHOLDER_IMG"
              :alt="w.hero?.alt || w.title"
              width="1600"
              height="900"
              sizes="(max-width: 768px) 100vw, 360px"
              class="h-44 w-full object-cover rounded-xl border border-white/10 mb-3"
              loading="lazy"
          />

          <template #header>
            <div class="flex items-center justify-between gap-3">
              <div class="font-semibold line-clamp-1">{{ w.title }}</div>
              <UBadge variant="subtle">{{ w.category }}</UBadge>
            </div>
          </template>

          <div class="text-sm opacity-80 line-clamp-2">{{ w.shortDescription }}</div>

          <div class="mt-4 flex flex-wrap gap-2">
            <UBadge v-for="t in w.tags.slice(0, 4)" :key="t" variant="outline">{{ t }}</UBadge>
          </div>

          <template #footer>
            <div class="flex items-center justify-between">
              <div class="text-sm opacity-70">{{ w.year }}</div>
              <span class="text-sm opacity-70">View →</span>
            </div>
          </template>
        </UCard>
      </NuxtLink>
    </div>
  </UContainer>
</template>
