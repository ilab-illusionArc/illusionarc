<script setup lang="ts">
import { PLACEHOLDER_IMG } from '~/constants/media'

const route = useRoute()
const { getWorkBySlug } = useContent()

const item = computed(() => getWorkBySlug(String(route.params.slug)))

if (!item.value) {
  throw createError({ statusCode: 404, statusMessage: 'Work not found' })
}

useHead(() => ({
  title: item.value?.title || 'Work',
  meta: [{ name: 'description', content: item.value?.shortDescription || 'Work detail' }]
}))

/** Fallback any broken / missing images to PLACEHOLDER_IMG */
function srcOrPlaceholder(src?: string | null) {
  const s = String(src || '').trim()
  return s || PLACEHOLDER_IMG
}

function onImgError(e: Event) {
  const el = e.target as HTMLImageElement
  if (!el) return
  if (el.dataset.fallbackApplied === '1') return
  el.dataset.fallbackApplied = '1'
  el.src = PLACEHOLDER_IMG
}
</script>

<template>
  <div>
    <!-- Hero -->
    <section class="relative overflow-hidden">
      <GlowBackdrop />
      <UContainer class="py-12 md:py-16">
        <div class="grid gap-8 md:grid-cols-2 items-center">
          <div data-reveal>
            <h1 class="text-3xl md:text-5xl font-semibold tracking-tight">{{ item!.title }}</h1>
            <p class="mt-3 text-lg opacity-80">{{ item!.shortDescription }}</p>

            <div class="mt-5 flex flex-wrap gap-2">
              <UBadge variant="subtle">{{ item!.category }}</UBadge>
              <UBadge v-for="t in (item!.tags || [])" :key="t" variant="outline">{{ t }}</UBadge>
            </div>

            <div class="mt-6 text-sm opacity-70">
              <div><span class="opacity-60">Year:</span> {{ item!.year }}</div>
              <div><span class="opacity-60">Role:</span> {{ item!.role || '—' }}</div>
              <div class="mt-2 flex flex-wrap gap-2">
                <UBadge v-for="tool in (item!.tools || [])" :key="tool" variant="outline">{{ tool }}</UBadge>
              </div>
            </div>

            <div class="mt-8">
              <UButton class="press" color="primary" to="/contact">
                {{ item!.cta || 'Contact' }}
              </UButton>
            </div>
          </div>

          <div class="relative" data-reveal>
            <!-- If hero image missing or fails → placeholder -->
            <NuxtImg
              :src="srcOrPlaceholder(item!.hero?.src)"
              :alt="item!.hero?.alt || item!.title"
              width="1800"
              height="1200"
              sizes="(max-width: 768px) 100vw, 560px"
              class="h-[320px] md:h-[460px] w-full object-cover rounded-3xl border border-white/10 bg-white/5 shadow-2xl"
              loading="lazy"
              @error="onImgError"
            />
          </div>
        </div>
      </UContainer>
    </section>

    <!-- Highlights -->
    <UContainer class="py-12">
      <div class="grid gap-6 md:grid-cols-2">
        <UCard class="bg-white/5 border-white/10" data-reveal>
          <template #header>
            <div class="font-semibold text-lg">Highlights</div>
          </template>

          <ul v-if="(item!.highlights || []).length" class="space-y-2 opacity-80 list-disc pl-5">
            <li v-for="h in item!.highlights" :key="h">{{ h }}</li>
          </ul>

          <div v-else class="text-sm opacity-70">—</div>
        </UCard>

        <UCard class="bg-white/5 border-white/10" data-reveal>
          <template #header>
            <div class="font-semibold text-lg">Outcome</div>
          </template>
          <p class="opacity-80">{{ item!.outcome || '—' }}</p>
        </UCard>
      </div>

      <!-- Gallery -->
      <div v-if="(item!.gallery || []).length" class="mt-10" data-reveal>
        <h2 class="text-2xl font-semibold">Gallery</h2>

        <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="(m, i) in item!.gallery"
            :key="i"
            class="rounded-2xl border border-white/10 bg-white/5 overflow-hidden"
          >
            <NuxtImg
              v-if="m.type === 'image'"
              :src="srcOrPlaceholder(m.src)"
              :alt="m.alt || `${item!.title} image ${i + 1}`"
              width="720"
              height="1080"
              sizes="(max-width: 768px) 100vw, 420px"
              class="w-full aspect-[2/3] object-cover"
              loading="lazy"
              @error="onImgError"
            />

            <div v-else class="p-4 text-sm opacity-70">
              Video item (we’ll handle in later step)
            </div>
          </div>
        </div>
      </div>
    </UContainer>
  </div>
</template>
