<template>
  <UContainer class="py-10">
    <PanoramaViewerApp />
  </UContainer>
</template>

<script setup lang="ts">
useHead({ title: 'Panorama Viewer' })
import PanoramaViewerApp from '~/components/apps/PanaromaViewerApp.client.vue'
</script>
