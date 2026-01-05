<script setup lang="ts">
import { usePwaInstall } from '~/composables/usePwaInstall'
const { canInstall, isStandalone, install } = usePwaInstall()

const installing = ref(false)

const onInstall = async () => {
  if (installing.value) return
  installing.value = true
  try {
    await install()
  } finally {
    installing.value = false
  }
}
</script>

<template>
  <UButton
    v-if="!isStandalone && canInstall"
    class="fixed bottom-4 right-4 z-[60] shadow-lg"
    color="primary"
    size="lg"
    :loading="installing"
    @click="onInstall"
  >
    <UIcon name="i-heroicons-arrow-down-tray" class="text-lg" />
    <span class="ml-2">Install App</span>
  </UButton>
</template>
