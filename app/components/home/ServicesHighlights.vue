<script setup lang="ts">
const { services } = useContent()
</script>

<template>
  <section class="relative py-14">
    <UContainer>
      <div class="flex items-end justify-between gap-4" data-reveal>
        <div>
          <h2 class="text-2xl md:text-3xl font-semibold text-black dark:text-white">Services</h2>
          <p class="mt-2 text-black/70 dark:text-white/70">
            Discovery → Prototype → Production → Launch.
          </p>
        </div>
        <UButton class="press hidden sm:inline-flex" variant="outline" to="/services">View All</UButton>
      </div>

      <div class="mt-8 grid gap-5 md:grid-cols-2 items-stretch" data-reveal>
        <NuxtLink
            v-for="s in services"
            :key="s.slug"
            :to="`/services#${s.slug}`"
            class="group block h-full"
        >
          <!-- Card -->
          <UCard
              class="press h-full border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur
                   transition hover:-translate-y-0.5"
              :ui="{ header: 'p-4', body: 'p-4 pt-0', footer: 'p-4 pt-0' }"
          >
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

            <!-- body wrapper to align footer area visually -->
            <div class="flex h-full flex-col">
              <p class="text-black/70 dark:text-white/70">
                {{ s.valueProp }}
              </p>

              <!-- Deliverables (reveal on hover without custom CSS) -->
              <div
                  class="mt-4 text-sm text-black/60 dark:text-white/60
                       max-h-0 overflow-hidden opacity-0 translate-y-1
                       transition-all duration-200
                       group-hover:max-h-28 group-hover:opacity-100 group-hover:translate-y-0
                       md:group-hover:max-h-32
                       [@media(hover:none)]:max-h-32 [@media(hover:none)]:opacity-100 [@media(hover:none)]:translate-y-0"
              >
                <div class="font-medium text-black/80 dark:text-white/80 mb-2">Deliverables</div>
                <div class="flex flex-wrap gap-2">
                  <UBadge v-for="d in s.deliverables" :key="d" variant="outline">{{ d }}</UBadge>
                </div>
              </div>

              <!-- Footer text (kept in card footer below, but this keeps spacing consistent) -->
              <div class="mt-auto" />
            </div>

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
