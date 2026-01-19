<script setup lang="ts">
useHead({ title: 'Calculator' })
import CalculatorApp from '~/components/apps/CalculatorApp.vue';
</script>

<template>
  <UContainer class="py-12">
    <div class="flex items-end justify-between gap-4" data-reveal>
      <div>
        <h1 class="text-3xl font-semibold">Calculator</h1>
        <p class="mt-2 text-black/60 dark:text-white/60">
          General and Scientific modes.
        </p>
      </div>

      <UButton to="/apps" variant="soft" icon="i-heroicons-arrow-left">
        Back to Apps
      </UButton>
    </div>

    <div class="mt-8">
      <CalculatorApp />
    </div>
  </UContainer>
</template>
