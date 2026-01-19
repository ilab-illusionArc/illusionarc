<script setup lang="ts">
import ToDoApp from '~/components/apps/ToDoApp.vue';

useHead({ title: 'To-Do' })
</script>

<template>
  <UContainer class="py-12">
    <div class="flex items-end justify-between gap-4" data-reveal>
      <div>
        <h1 class="text-3xl font-semibold">To-Do</h1>
        <p class="mt-2 text-black/60 dark:text-white/60">
          Tasks, priorities, due dates — lightweight and offline-first.
        </p>
      </div>

      <UButton to="/apps" variant="soft" icon="i-heroicons-arrow-left">
        Back to Apps
      </UButton>
    </div>

    <div class="mt-8">
      <ToDoApp />
    </div>
  </UContainer>
</template>
