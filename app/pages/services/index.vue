<script setup lang="ts">
useHead({ title: 'Services' })

type ServiceRow = {
  id: number
  slug: string
  title: string
  value_prop: string
  deliverables: string[] | null
  process_steps: string[] | null
  timeline: string | null
}

const supabase = useSupabaseClient()

const services = ref<ServiceRow[]>([])
const loading = ref(true)
const errorMsg = ref<string | null>(null)

/* ---------------- Load services ---------------- */
onMounted(async () => {
  loading.value = true
  errorMsg.value = null

  const { data, error } = await supabase
    .from('services')
    .select('id, slug, title, value_prop, deliverables, process_steps, timeline')
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (error) {
    errorMsg.value = error.message
  } else {
    services.value = (data || []).map((s: any) => ({
      ...s,
      deliverables: Array.isArray(s.deliverables) ? s.deliverables : [],
      process_steps: Array.isArray(s.process_steps) ? s.process_steps : []
    }))
  }

  loading.value = false
})
</script>

<template>
  <section class="relative py-16">
    <UContainer>
      <!-- Header -->
      <div class="max-w-2xl">
        <h1 class="text-3xl md:text-4xl font-semibold text-black dark:text-white">
          Services
        </h1>
        <p class="mt-2 text-black/70 dark:text-white/70">
          Discovery → Prototype → Production → Launch.
        </p>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="mt-10 grid gap-5 md:grid-cols-2">
        <div
          v-for="i in 4"
          :key="i"
          class="h-40 rounded-3xl border border-black/10 dark:border-white/10
                 bg-black/5 dark:bg-white/5 animate-pulse"
        />
      </div>

      <!-- Error -->
      <div
        v-else-if="errorMsg"
        class="mt-10 rounded-3xl border border-black/10 dark:border-white/10
               bg-white/70 dark:bg-white/5 p-6"
      >
        <div class="text-sm text-black dark:text-white">
          ❌ {{ errorMsg }}
        </div>
      </div>

      <!-- Empty -->
      <div
        v-else-if="services.length === 0"
        class="mt-10 rounded-3xl border border-black/10 dark:border-white/10
               bg-white/70 dark:bg-white/5 p-8 text-center"
      >
        <div class="text-lg font-semibold">No services available</div>
        <p class="mt-2 text-sm opacity-70">
          Services will appear here once they are published.
        </p>
      </div>

      <!-- Services grid -->
      <div
        v-else
        class="mt-10 grid gap-5 md:grid-cols-2 items-stretch"
      >
        <NuxtLink
          v-for="s in services"
          :key="s.id"
          :to="`/services/${s.slug}`"
          class="group block h-full"
        >
          <UCard
            class="h-full border border-black/10 dark:border-white/10
                   bg-white/70 dark:bg-white/5 backdrop-blur
                   transition hover:-translate-y-0.5"
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
                {{ s.value_prop }}
              </p>

              <!-- Deliverables preview -->
              <div
                v-if="s.deliverables?.length"
                class="mt-4 text-sm text-black/60 dark:text-white/60
                       max-h-0 overflow-hidden opacity-0 translate-y-1
                       transition-all duration-200
                       group-hover:max-h-28 group-hover:opacity-100 group-hover:translate-y-0
                       [@media(hover:none)]:max-h-28 [@media(hover:none)]:opacity-100"
              >
                <div class="font-medium mb-2 text-black/80 dark:text-white/80">
                  Deliverables
                </div>
                <div class="flex flex-wrap gap-2">
                  <UBadge
                    v-for="d in s.deliverables.slice(0, 4)"
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
                Timeline: {{ s.timeline || '—' }}
              </div>
            </template>
          </UCard>
        </NuxtLink>
      </div>
    </UContainer>
  </section>
</template>
