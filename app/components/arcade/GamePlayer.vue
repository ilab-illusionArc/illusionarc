<script setup lang="ts">
import type { ArcadeGame } from '@/data/games'

const props = defineProps<{
  game: ArcadeGame
  minimalUi?: boolean
}>()

const route = useRoute()
const iframeRef = ref<HTMLIFrameElement | null>(null)

const ui = computed(() => String(route.query.ui || '').toLowerCase()) // "min"
const minimal = computed(() => props.minimalUi || ui.value === 'min')

const aspect = computed(() => props.game.embed.aspectRatio || '16/9')
const minHeight = computed(() => props.game.embed.minHeight ?? 520)

function requestFullscreen() {
  const el = iframeRef.value
  if (!el) return
  // Fullscreen on iframe element
  const anyEl = el as any
  if (anyEl.requestFullscreen) anyEl.requestFullscreen()
  else if (anyEl.webkitRequestFullscreen) anyEl.webkitRequestFullscreen()
}

const soundOn = ref(true)
function toggleSound() {
  soundOn.value = !soundOn.value
  // Optional: tell the game
  iframeRef.value?.contentWindow?.postMessage(
      { type: 'SOUND', on: soundOn.value },
      '*'
  )
}

const emit = defineEmits<{
  (e: 'score', payload: { score: number; raw?: any }): void
}>()

function onMessage(e: MessageEvent) {
  // Only accept messages from our own origin (safe default).
  // If later you host games on another domain, you can extend allowlist.
  const sameOrigin = e.origin === window.location.origin
  if (!sameOrigin) return

  const data = e.data
  if (!data || typeof data !== 'object') return

  if (data.type === 'SCORE' && typeof data.score === 'number') {
    emit('score', { score: data.score, raw: data })
  }
}

onMounted(() => window.addEventListener('message', onMessage))
onBeforeUnmount(() => window.removeEventListener('message', onMessage))

const src = computed(() => {
  // pass optional params down to game
  const theme = route.query.theme ? `theme=${encodeURIComponent(String(route.query.theme))}` : ''
  const autostart = route.query.autostart ? `autostart=${encodeURIComponent(String(route.query.autostart))}` : ''
  const qs = [theme, autostart].filter(Boolean).join('&')
  return qs ? `${props.game.sourceUrl}${props.game.sourceUrl.includes('?') ? '&' : '?'}${qs}` : props.game.sourceUrl
})
</script>

<template>
  <div class="relative">
    <!-- Optional mini UI (embed page uses this) -->
    <div v-if="minimal" class="absolute z-10 right-3 top-3 flex gap-2">
      <UButton size="xs" variant="solid" color="gray" @click="toggleSound">
        <span class="opacity-80">{{ soundOn ? 'Sound' : 'Muted' }}</span>
      </UButton>
      <UButton size="xs" variant="solid" color="primary" @click="requestFullscreen">
        Fullscreen
      </UButton>
    </div>

    <div
        class="w-full overflow-hidden rounded-2xl border border-white/10 bg-black/30 shadow-2xl"
        :style="{
        minHeight: minHeight + 'px'
      }"
    >
      <!-- Responsive aspect ratio wrapper -->
      <div class="relative w-full" :style="{ aspectRatio: aspect }">
        <iframe
            ref="iframeRef"
            class="absolute inset-0 h-full w-full"
            :src="src"
            title="Game"
            allow="autoplay; fullscreen; gamepad"
            allowfullscreen
            loading="eager"
            sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-forms"
        />
      </div>
    </div>
  </div>
</template>
