<template>
  <div class="space-y-0">
    <HomeHeroSection />
    <HomeServicesHighlights />
    <HomeFeaturedWorkReel />
    <HomeTestimonialsStrip />
    <HomeMiniArcadeTeaser />
  </div>
</template>

<script setup lang="ts">
useHead({
  title: 'Home',
  meta: [
    {
      name: 'description',
      content:
          'Illusion Arc — Games, AR/VR, VFX/CGI, and animation. Play our arcade games and explore our work.'
    }
  ]
})
</script>
