<script setup lang="ts">
useHead({ title: 'Notes' })
import NotesApp from '~/components/apps/NotesApp.vue';
</script>

<template>
  <UContainer class="py-12">
    <div class="flex items-end justify-between gap-4" data-reveal>
      <div>
        <h1 class="text-3xl font-semibold">Notes</h1>
        <p class="mt-2 text-black/60 dark:text-white/60">
          Quick notes with folders, tags, and markdown preview.
        </p>
      </div>

      <UButton to="/apps" variant="soft" icon="i-heroicons-arrow-left">
        Back to Apps
      </UButton>
    </div>

    <div class="mt-8">
      <NotesApp />
    </div>
  </UContainer>
</template>
