<script setup lang="ts">
const items = [
  { name: 'Client A', text: 'Polished delivery and great iteration speed.' },
  { name: 'Client B', text: 'The experience feels premium and fast.' },
  { name: 'Client C', text: 'Strong UI/UX + clean build pipeline.' }
]
</script>

<template>
  <section class="relative py-14">
    <UContainer>
      <div data-reveal>
        <h2 class="text-2xl md:text-3xl font-semibold text-black dark:text-white">
          Testimonials
        </h2>
        <p class="mt-2 text-black/70 dark:text-white/70">
          Dummy for now — we’ll replace with real quotes.
        </p>
      </div>

      <div class="mt-8 grid gap-5 md:grid-cols-3 items-stretch" data-reveal>
        <UCard
            v-for="t in items"
            :key="t.name"
            class="press h-full border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur
                 transition hover:-translate-y-0.5"
            :ui="{ body: 'p-5' }"
        >
          <p class="text-black/70 dark:text-white/70 leading-relaxed">
            “{{ t.text }}”
          </p>
          <div class="mt-4 text-sm text-black/60 dark:text-white/60">
            — {{ t.name }}
          </div>
        </UCard>
      </div>
    </UContainer>
  </section>
</template>
