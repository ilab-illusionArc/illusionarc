import { ref, onMounted, onBeforeUnmount } from 'vue'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export function usePwaInstall() {
  const canInstall = ref(false)
  const isStandalone = ref(false)
  const deferredPrompt = ref<BeforeInstallPromptEvent | null>(null)

  const updateStandalone = () => {
    if (import.meta.server) return
    // display-mode + iOS standalone flag
    isStandalone.value =
      window.matchMedia?.('(display-mode: standalone)')?.matches === true ||
      // @ts-ignore - iOS Safari
      (window.navigator as any).standalone === true
  }

  const onBeforeInstallPrompt = (e: Event) => {
    // Prevent the mini-infobar so we can show our own button
    e.preventDefault?.()
    deferredPrompt.value = e as BeforeInstallPromptEvent
    canInstall.value = true
  }

  const install = async () => {
    if (!deferredPrompt.value) return false
    await deferredPrompt.value.prompt()
    const choice = await deferredPrompt.value.userChoice
    deferredPrompt.value = null
    canInstall.value = false
    return choice.outcome === 'accepted'
  }

  onMounted(() => {
    updateStandalone()
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', updateStandalone)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.removeEventListener('appinstalled', updateStandalone)
  })

  return { canInstall, isStandalone, install }
}
