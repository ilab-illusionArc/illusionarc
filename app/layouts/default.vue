<template>
  <div class="min-h-dvh flex flex-col">
    <!-- Header -->
    <header class="sticky top-0 z-50 backdrop-blur border-b border-white/5 bg-black/20">
      <UContainer class="py-3 flex items-center justify-between gap-3">
        <NuxtLink to="/" class="flex items-center gap-2">
          <UIcon name="i-heroicons-sparkles" class="text-xl" />
          <span class="font-semibold tracking-wide">Illusion Arc</span>
        </NuxtLink>

        <nav class="hidden md:flex items-center gap-1">
          <UButton variant="ghost" to="/work">Work</UButton>
          <UButton variant="ghost" to="/services">Services</UButton>
          <UButton variant="ghost" to="/arcade">Arcade</UButton>
          <UButton variant="ghost" to="/about">About</UButton>
        </nav>

        <div class="flex items-center gap-2">
          <UButton class="hidden md:inline-flex" color="primary" to="/contact">
            Contact
          </UButton>

          <!-- Mobile menu (simple for Step 1; we’ll animate it later) -->
          <UButton class="md:hidden" variant="ghost" @click="open = true">
            <UIcon name="i-heroicons-bars-3" />
          </UButton>
        </div>
      </UContainer>
    </header>

    <!-- Mobile drawer -->
    <USlideover v-model:open="open">
      <template #body>
        <div class="p-4 flex flex-col gap-2">
          <UButton variant="ghost" to="/work" @click="open=false">Work</UButton>
          <UButton variant="ghost" to="/services" @click="open=false">Services</UButton>
          <UButton variant="ghost" to="/arcade" @click="open=false">Arcade</UButton>
          <UButton variant="ghost" to="/about" @click="open=false">About</UButton>
          <UButton color="primary" to="/contact" @click="open=false">Contact</UButton>
        </div>
      </template>
    </USlideover>


    <!-- Page -->
    <main class="flex-1">
      <slot />
    </main>

    <!-- Footer -->
    <footer class="border-t border-white/5 bg-black/10">
      <UContainer class="py-10 grid gap-6 md:grid-cols-3">
        <div>
          <div class="font-semibold">Illusion Arc</div>
          <div class="text-sm opacity-70 mt-2">
            Games • AR/VR • VFX/CGI • Animation
          </div>
        </div>

        <div class="text-sm">
          <div class="opacity-60 mb-2">Links</div>
          <div class="flex flex-col gap-1">
            <NuxtLink to="/work" class="opacity-80 hover:opacity-100">Work</NuxtLink>
            <NuxtLink to="/arcade" class="opacity-80 hover:opacity-100">Arcade</NuxtLink>
            <NuxtLink to="/contact" class="opacity-80 hover:opacity-100">Contact</NuxtLink>
          </div>
        </div>

        <div class="text-sm">
          <div class="opacity-60 mb-2">Legal</div>
          <div class="flex flex-col gap-1">
            <NuxtLink to="/privacy" class="opacity-80 hover:opacity-100">Privacy</NuxtLink>
            <NuxtLink to="/terms" class="opacity-80 hover:opacity-100">Terms</NuxtLink>
          </div>
        </div>
      </UContainer>
    </footer>
  </div>
</template>

<script setup lang="ts">
const open = ref(false)
</script>
