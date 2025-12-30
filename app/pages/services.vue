<script setup lang="ts">
const { services } = useContent()
</script>

<template>
  <UContainer class="py-16">
    <h1 class="text-3xl font-semibold">Services</h1>
    <p class="mt-2 opacity-80">Discovery → Prototype → Production → Launch.</p>

    <div class="mt-10 grid gap-5 md:grid-cols-2">
      <UCard v-for="s in services" :key="s.slug" class="bg-white/5 border-white/10">
        <template #header>
          <div class="font-semibold">{{ s.title }}</div>
        </template>
        <p class="opacity-80">{{ s.valueProp }}</p>
        <div class="mt-4 text-sm opacity-70">Timeline: {{ s.timeline }}</div>
      </UCard>
    </div>
  </UContainer>
</template>
