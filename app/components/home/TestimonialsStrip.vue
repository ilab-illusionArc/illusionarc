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
        <h2 class="text-2xl md:text-3xl font-semibold">Testimonials</h2>
        <p class="mt-2 opacity-80">Dummy for now — we’ll replace with real quotes.</p>
      </div>

      <div class="mt-8 grid gap-5 md:grid-cols-3" data-reveal>
        <UCard v-for="t in items" :key="t.name" class="bg-white/5 border-white/10 press">
          <p class="opacity-80">“{{ t.text }}”</p>
          <div class="mt-4 text-sm opacity-70">— {{ t.name }}</div>
        </UCard>
      </div>
    </UContainer>
  </section>
</template>
