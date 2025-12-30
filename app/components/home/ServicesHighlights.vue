<script setup lang="ts">
const { services } = useContent()
</script>

<template>
  <section class="relative py-14">
    <UContainer>
      <div class="flex items-end justify-between gap-4" data-reveal>
        <div>
          <h2 class="text-2xl md:text-3xl font-semibold">Services</h2>
          <p class="mt-2 opacity-80">Discovery → Prototype → Production → Launch.</p>
        </div>
        <UButton class="press hidden sm:inline-flex" variant="outline" to="/services">View All</UButton>
      </div>

      <div class="mt-8 grid gap-5 md:grid-cols-2" data-reveal>
        <NuxtLink
            v-for="s in services"
            :key="s.slug"
            :to="`/services#${s.slug}`"
            class="group block"
        >
          <UCard class="svc bg-white/5 border-white/10 press">
            <template #header>
              <div class="flex items-center justify-between gap-3">
                <div class="font-semibold text-lg">{{ s.title }}</div>
                <UIcon name="i-heroicons-arrow-right" class="opacity-60 group-hover:opacity-100 transition" />
              </div>
            </template>

            <p class="opacity-80">{{ s.valueProp }}</p>

            <div class="more mt-4 text-sm opacity-70">
              <div class="font-medium opacity-90 mb-2">Deliverables</div>
              <div class="flex flex-wrap gap-2">
                <UBadge v-for="d in s.deliverables" :key="d" variant="outline">{{ d }}</UBadge>
              </div>
            </div>

            <template #footer>
              <div class="text-sm opacity-70">Timeline: {{ s.timeline }}</div>
            </template>
          </UCard>
        </NuxtLink>
      </div>
    </UContainer>
  </section>
</template>

<style scoped>
/* Expand-on-hover: reveal extra content without heavy animation */
.svc .more{
  max-height: 0;
  overflow: hidden;
  transition: max-height .22s ease;
}
.svc:hover .more{
  max-height: 140px;
}
</style>
