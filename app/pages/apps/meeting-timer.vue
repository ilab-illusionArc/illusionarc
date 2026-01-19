<script setup lang="ts">
useHead({ title: 'Meeting Timer' })
import MeetingTimerApp from '~/components/apps/MeetingTimerApp.vue'
</script>

<template>
  <UContainer class="py-12">
    <div class="flex items-end justify-between gap-4" data-reveal>
      <div>
        <h1 class="text-3xl font-semibold">Meeting Timer</h1>
        <p class="mt-2 text-black/60 dark:text-white/60">
          Keep meetings on schedule with presets and segment timing.
        </p>
      </div>

      <UButton to="/apps" variant="soft" icon="i-heroicons-arrow-left">
        Back to Apps
      </UButton>
    </div>

    <div class="mt-8">
      <MeetingTimerApp />
    </div>
  </UContainer>
</template>
