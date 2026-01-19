<script setup lang="ts">
import { PLACEHOLDER_IMG } from '~/constants/media'

const route = useRoute()
const supabase = useSupabaseClient()

const slug = computed(() => String(route.params.slug || '').trim())

type MediaRow = {
  id: string
  kind: 'hero' | 'gallery'
  path: string
  alt: string | null
  sort_order: number
}

type WorkDbRow = {
  id: string
  title: string
  slug: string
  category: string
  short_description: string | null
  year: number | null
  role: string | null
  tools: string[] | null
  tags: string[] | null
  highlights: string[] | null
  outcome: string | null
  cta: string | null
  is_active: boolean
  sort_order: number
  work_media: MediaRow[] | null
}

function getPublicUrl(path: string) {
  if (!path) return ''
  const { data } = supabase.storage.from('works').getPublicUrl(path)
  return data?.publicUrl || ''
}

function safeArr(v: any): string[] {
  return Array.isArray(v) ? v.map(String).map(s => s.trim()).filter(Boolean) : []
}

const { data: item, error } = await useAsyncData(
  () => `work:${slug.value}`,
  async () => {
    if (!slug.value) return null

    const { data, error } = await supabase
      .from('works')
      .select(
        `
        id, title, slug, category,
        short_description, year, role,
        tools, tags, highlights,
        outcome, cta,
        is_active, sort_order,
        work_media ( id, kind, path, alt, sort_order, created_at )
      `
      )
      .eq('slug', slug.value)
      .eq('is_active', true)
      .maybeSingle()

    if (error) throw error
    if (!data) return null

    const row = data as unknown as WorkDbRow

    const media = (row.work_media || []).slice()
    const hero = media.find(m => m.kind === 'hero') || null
    const gallery = media
      .filter(m => m.kind === 'gallery')
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

    // Shape it to match your existing UI expectation (camelCase fields)
    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      category: row.category,
      shortDescription: row.short_description || '',
      year: row.year,
      role: row.role,
      tools: safeArr(row.tools),
      tags: safeArr(row.tags),
      highlights: safeArr(row.highlights),
      outcome: row.outcome,
      cta: row.cta,

      hero: {
        type: 'image',
        src: hero?.path ? getPublicUrl(hero.path) : PLACEHOLDER_IMG,
        alt: hero?.alt || row.title
      },

      gallery: gallery.map((m, i) => ({
        type: 'image',
        src: m.path ? getPublicUrl(m.path) : PLACEHOLDER_IMG,
        alt: m.alt || `${row.title} image ${i + 1}`
      }))
    }
  },
  {
    // SSR-safe: ensures first render has data
    server: true,
    lazy: false
  }
)

if (error.value) {
  // optional: keep it as 404 if you want
  throw createError({ statusCode: 404, statusMessage: 'Work not found' })
}
if (!item.value) {
  throw createError({ statusCode: 404, statusMessage: 'Work not found' })
}

useHead(() => ({
  title: item.value?.title || 'Work',
  meta: [{ name: 'description', content: item.value?.shortDescription || 'Work detail' }]
}))
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
              <div v-if="item!.year"><span class="opacity-60">Year:</span> {{ item!.year }}</div>
              <div v-if="item!.role"><span class="opacity-60">Role:</span> {{ item!.role }}</div>
              <div v-if="(item!.tools || []).length" class="mt-2 flex flex-wrap gap-2">
                <UBadge v-for="tool in item!.tools" :key="tool" variant="outline">{{ tool }}</UBadge>
              </div>
            </div>

            <div class="mt-8">
              <UButton class="press" color="primary" to="/contact">
                {{ item!.cta || 'Contact' }}
              </UButton>
            </div>
          </div>

          <div class="relative" data-reveal>
            <NuxtImg
              :src="item!.hero?.src || PLACEHOLDER_IMG"
              :alt="item!.hero?.alt || item!.title"
              width="1800"
              height="1200"
              sizes="(max-width: 768px) 100vw, 560px"
              class="h-[320px] md:h-[460px] w-full object-cover rounded-3xl border border-white/10 bg-white/5 shadow-2xl"
              loading="lazy"
            />
          </div>
        </div>
      </UContainer>
    </section>

    <!-- Highlights + Outcome -->
    <UContainer class="py-12">
      <div class="grid gap-6 md:grid-cols-2">
        <UCard class="bg-white/5 border-white/10" data-reveal>
          <template #header>
            <div class="font-semibold text-lg">Highlights</div>
          </template>
          <ul v-if="(item!.highlights || []).length" class="space-y-2 opacity-80 list-disc pl-5">
            <li v-for="h in item!.highlights" :key="h">{{ h }}</li>
          </ul>
          <div v-else class="opacity-70 text-sm">—</div>
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
              :src="m.src || PLACEHOLDER_IMG"
              :alt="m.alt || `${item!.title} image ${i + 1}`"
              width="720"
              height="1080"
              sizes="(max-width: 768px) 100vw, 420px"
              class="w-full aspect-[2/3] object-cover"
              loading="lazy"
            />
          </div>
        </div>
      </div>
    </UContainer>
  </div>
</template>
