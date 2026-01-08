<script setup lang="ts">
const colorMode = useColorMode()

type Mode = 'system' | 'light' | 'dark'
const order: Mode[] = ['system', 'light', 'dark']

function normalizeMode(v: unknown): Mode {
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
}

const pref = computed<Mode>(() => normalizeMode((colorMode as any).preference))

const icon = computed(() => {
  if (pref.value === 'light') return 'i-heroicons-sun'
  if (pref.value === 'dark') return 'i-heroicons-moon'
  return 'i-heroicons-computer-desktop'
})

const label = computed(() => {
  if (pref.value === 'light') return 'Light'
  if (pref.value === 'dark') return 'Dark'
  return 'System'
})

function cycle() {
  const i = order.indexOf(pref.value)
  const next = order[(i + 1) % order.length]
  // ✅ always a string
  ;(colorMode as any).preference = next
}
</script>

<template>
  <ClientOnly>
    <UButton
      variant="ghost"
      size="sm"
      class="rounded-full"
      :title="`Theme: ${label} (click to change)`"
      @click="cycle"
    >
      <UIcon :name="icon" class="w-5 h-5" />
    </UButton>

    <template #fallback>
      <UButton variant="ghost" size="sm" class="rounded-full" disabled>
        <UIcon name="i-heroicons-computer-desktop" class="w-5 h-5" />
      </UButton>
    </template>
  </ClientOnly>
</template>
