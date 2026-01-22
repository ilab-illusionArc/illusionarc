<script setup lang="ts">
useHead({ title: 'Apps' })

type AppCategory =
  | 'Productivity'
  | 'Utilities'
  | 'Documents'
  | 'Finance'
  | 'Time'
  | 'Communication'
  | 'Health'
  | 'Other'

type AppItem = {
  title: string
  slug: string
  description: string
  icon?: string
  category: AppCategory
  badge?: string
  comingSoon?: boolean
}

const apps = ref<AppItem[]>([
  {
    title: 'Panorama Viewer',
    slug: 'panorama',
    description: 'View 360° panoramas smoothly in browser.',
    icon: 'i-heroicons-globe-alt',
    category: 'Utilities'
  },
  {
    title: 'To-Do',
    slug: 'todo',
    description: 'Create tasks, set priorities, stay on track.',
    icon: 'i-heroicons-check-circle',
    category: 'Productivity'
  },
  {
    title: 'Notes',
    slug: 'notes',
    description: 'Quick notes with search and pinning.',
    icon: 'i-heroicons-pencil-square',
    category: 'Productivity',
    badge: 'Popular'
  },
  {
    title: 'Calculator',
    slug: 'calculator',
    description: 'Fast daily calculations.',
    icon: 'i-heroicons-calculator',
    category: 'Utilities'
  },
  {
    title: 'Unit Converter',
    slug: 'unit-converter',
    description: 'Length, weight, temperature, currency (optional).',
    icon: 'i-heroicons-arrows-right-left',
    category: 'Utilities',
  },
  {
    title: 'Meeting Timer',
    slug: 'meeting-timer',
    description: 'Keep meetings on schedule with simple presets.',
    icon: 'i-heroicons-clock',
    category: 'Time'
  },
  {
    title: 'Invoice Maker',
    slug: 'invoice',
    description: 'Generate clean invoices and export as PDF.',
    icon: 'i-heroicons-document-text',
    category: 'Finance',
    comingSoon: true
  }
])

const query = ref('')
const category = ref<AppCategory | 'All'>('All')

const categories = computed<(AppCategory | 'All')[]>(() => {
  const set = new Set<AppCategory>()
  for (const a of apps.value) set.add(a.category)
  return ['All', ...Array.from(set)]
})

const categoryOptions = computed(() =>
  categories.value.map((c) => ({ label: c, value: c }))
)

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return apps.value
    .filter((a) => (category.value === 'All' ? true : a.category === category.value))
    .filter((a) => {
      if (!q) return true
      const hay = `${a.title} ${a.description} ${a.category}`.toLowerCase()
      return hay.includes(q)
    })
    .sort((a, b) => Number(!!a.comingSoon) - Number(!!b.comingSoon))
})

function appHref(a: AppItem) {
  return `/apps/${a.slug}`
}
</script>

<template>
  <UContainer class="py-12">
    <div class="flex flex-col gap-2 md:flex-row md:items-end md:justify-between" data-reveal>
      <div>
        <h1 class="text-3xl font-semibold">Apps</h1>
        <p class="mt-2 text-black/60 dark:text-white/60">
          Daily-use tools built into illusion Arc.
        </p>
      </div>

      <div class="mt-4 flex w-full flex-col gap-2 md:mt-0 md:w-auto md:flex-row md:items-center">
        <UInput
          v-model="query"
          icon="i-heroicons-magnifying-glass"
          placeholder="Search apps…"
          class="md:w-64"
        />
        <USelect
          v-model="category"
          :options="categoryOptions"
          class="md:w-44"
        />
      </div>
    </div>

    <div class="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <NuxtLink
        v-for="a in filtered"
        :key="a.slug"
        :to="a.comingSoon ? undefined : appHref(a)"
        class="group block rounded-2xl border border-black/10 bg-white/60 p-5 shadow-sm backdrop-blur
               transition hover:-translate-y-0.5 hover:border-black/15 hover:bg-white/70
               dark:border-white/10 dark:bg-black/20 dark:hover:border-white/15 dark:hover:bg-black/25"
        :class="a.comingSoon ? 'pointer-events-none opacity-60' : ''"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-center gap-3">
            <div
              class="grid h-10 w-10 place-items-center rounded-xl
                     bg-black/5 text-black/80
                     dark:bg-white/5 dark:text-white"
            >
              <UIcon :name="a.icon || 'i-heroicons-squares-2x2'" class="h-5 w-5" />
            </div>

            <div class="leading-tight">
              <div class="flex items-center gap-2">
                <div class="font-semibold">{{ a.title }}</div>
                <UBadge v-if="a.badge" variant="soft" size="xs">{{ a.badge }}</UBadge>
                <UBadge v-if="a.comingSoon" variant="soft" size="xs">Coming soon</UBadge>
              </div>
              <div class="text-xs text-black/55 dark:text-white/55">{{ a.category }}</div>
            </div>
          </div>

          <UIcon
            name="i-heroicons-arrow-right"
            class="h-5 w-5 text-black/30 transition group-hover:translate-x-0.5 group-hover:text-black/60
                   dark:text-white/30 dark:group-hover:text-white/70"
          />
        </div>

        <p class="mt-3 text-sm text-black/70 dark:text-white/70">
          {{ a.description }}
        </p>
      </NuxtLink>
    </div>

    <div v-if="filtered.length === 0" class="mt-10 rounded-2xl border border-black/10 bg-white/50 p-6 text-sm text-black/60 dark:border-white/10 dark:bg-black/15 dark:text-white/60">
      No apps found. Try a different keyword or category.
    </div>
  </UContainer>
</template>
