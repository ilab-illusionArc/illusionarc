<script setup lang="ts">
type ServiceUI = {
  slug: string
  title: string
  valueProp: string
  timeline: string
  deliverables: string[]
}

const supabase = useSupabaseClient()

const services = ref<ServiceUI[]>([])
const loading = ref(true)

async function loadServices() {
  loading.value = true

  const { data, error } = await supabase
    .from('services')
    .select('slug, title, value_prop, timeline, deliverables')
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[ServicesHighlights] load error:', error.message)
    services.value = []
  } else {
    services.value = (data || []).map((s: any) => ({
      slug: s.slug,
      title: s.title,
      valueProp: s.value_prop,
      timeline: s.timeline || 'Flexible',
      deliverables: Array.isArray(s.deliverables) ? s.deliverables : []
    }))
  }

  loading.value = false
}

onMounted(loadServices)
</script>

<template>
  <section class="relative py-14 overflow-hidden">
    <!-- background wash -->
    <div
      class="absolute inset-0 opacity-90 pointer-events-none"
      style="
        background:
          radial-gradient(900px 600px at 15% 20%, rgba(124,58,237,.16), transparent 60%),
          radial-gradient(900px 600px at 85% 30%, rgba(34,211,238,.12), transparent 60%),
          radial-gradient(900px 700px at 55% 90%, rgba(34,197,94,.10), transparent 60%);
      "
    />

    <UContainer class="relative">
      <!-- Header -->
      <div class="flex items-end justify-between gap-4">
        <div>
          <h2 class="text-2xl md:text-3xl font-semibold text-black dark:text-white">
            Services
          </h2>
          <p class="mt-2 text-black/70 dark:text-white/70">
            Discovery → Prototype → Production → Launch.
          </p>
        </div>

        <UButton
          to="/services"
          variant="outline"
          class="hidden sm:inline-flex press"
        >
          View all
        </UButton>
      </div>

      <!-- Loading skeleton -->
      <div
        v-if="loading"
        class="mt-8 grid gap-5 md:grid-cols-2"
      >
        <div
          v-for="i in 4"
          :key="i"
          class="h-44 rounded-2xl bg-black/10 dark:bg-white/10 animate-pulse"
        />
      </div>

      <!-- Cards -->
      <div
        v-else
        class="mt-8 grid gap-5 md:grid-cols-2 items-stretch"
      >
        <NuxtLink
          v-for="s in services"
          :key="s.slug"
          :to="`/services/${s.slug}`"
          class="group block h-full"
        >
          <UCard
            class="
              press h-full
              border border-black/10 dark:border-white/10
              bg-white/70 dark:bg-white/5
              backdrop-blur
              transition hover:-translate-y-0.5
            "
            :ui="{ header: 'p-4', body: 'p-4 pt-0', footer: 'p-4 pt-0' }"
          >
            <!-- Header -->
            <template #header>
              <div class="flex items-center justify-between gap-3">
                <div class="font-semibold text-lg text-black dark:text-white">
                  {{ s.title }}
                </div>
                <UIcon
                  name="i-heroicons-arrow-right"
                  class="opacity-60 group-hover:opacity-100 transition"
                />
              </div>
            </template>

            <!-- Body -->
            <div class="flex h-full flex-col">
              <p class="text-black/70 dark:text-white/70">
                {{ s.valueProp }}
              </p>

              <!-- Deliverables (hover reveal, mobile-safe) -->
              <div
                v-if="s.deliverables.length"
                class="
                  mt-4 text-sm text-black/60 dark:text-white/60
                  max-h-0 overflow-hidden opacity-0 translate-y-1
                  transition-all duration-200
                  group-hover:max-h-32 group-hover:opacity-100 group-hover:translate-y-0
                  [@media(hover:none)]:max-h-32
                  [@media(hover:none)]:opacity-100
                  [@media(hover:none)]:translate-y-0
                "
              >
                <div class="font-medium mb-2 text-black/80 dark:text-white/80">
                  Deliverables
                </div>
                <div class="flex flex-wrap gap-2">
                  <UBadge
                    v-for="d in s.deliverables"
                    :key="d"
                    variant="outline"
                  >
                    {{ d }}
                  </UBadge>
                </div>
              </div>

              <div class="mt-auto" />
            </div>

            <!-- Footer -->
            <template #footer>
              <div class="text-sm text-black/60 dark:text-white/60">
                Timeline: {{ s.timeline }}
              </div>
            </template>
          </UCard>
        </NuxtLink>
      </div>
    </UContainer>
  </section>
</template>
