<script setup lang="ts">
import type { ArcadeGame } from '@/data/games'

const props = defineProps<{
  game: ArcadeGame
  defer?: boolean
  fullscreen?: boolean
}>()

const route = useRoute()

const iframeRef = ref<HTMLIFrameElement | null>(null)
const wrapRef = ref<HTMLElement | null>(null)

const aspect = computed(() => props.game.embed.aspectRatio || '16/9')
const minHeight = computed(() => props.game.embed.minHeight ?? 520)

// --- START / STOP -----------------------------------------------------------
// If defer=true => show "Ready to play" until start().
// But if we're in fullscreen OR URL is ?play=1 => auto start.
const started = ref(false)

function start() {
  started.value = true
}
function stop() {
  started.value = false
}

// Auto-start rules (fixes refresh / direct link ?play=1)
const shouldAutoStart = computed(() => {
  if (!props.defer) return true
  if (props.fullscreen) return true
  // direct entry support
  if (String(route.query.play || '') === '1') return true
  // if someone explicitly passes autostart=1
  if (String(route.query.autostart || '') === '1') return true
  return false
})

watch(
  shouldAutoStart,
  (v) => {
    if (v) started.value = true
  },
  { immediate: true }
)

// --- MESSAGING --------------------------------------------------------------
function send(payload: any) {
  iframeRef.value?.contentWindow?.postMessage(payload, '*')
}

// Best-effort fullscreen (iOS Safari may ignore it)
function requestFullscreen() {
  const el = wrapRef.value
  if (!el) return
  const anyEl = el as any
  if (anyEl.requestFullscreen) anyEl.requestFullscreen()
  else if (anyEl.webkitRequestFullscreen) anyEl.webkitRequestFullscreen()
}

// --- SCORE EVENT BRIDGE -----------------------------------------------------
const emit = defineEmits<{
  (e: 'score', payload: { score: number; raw?: any }): void
}>()

function onMessage(e: MessageEvent) {
  // accept only same-origin
  if (e.origin !== window.location.origin) return
  const data = e.data
  if (!data || typeof data !== 'object') return

  if ((data as any).type === 'SCORE' && typeof (data as any).score === 'number') {
    emit('score', { score: (data as any).score, raw: data })
  }
}

onMounted(() => window.addEventListener('message', onMessage))
onBeforeUnmount(() => window.removeEventListener('message', onMessage))

// --- SRC --------------------------------------------------------------------
// Important: default autostart depends on mode.
// fullscreen => autostart=1
// normal/lobby => autostart=0
const src = computed(() => {
  const autostart =
    route.query.autostart != null
      ? `autostart=${encodeURIComponent(String(route.query.autostart))}`
      : `autostart=${props.fullscreen ? '1' : '0'}`

  const qs = [autostart].filter(Boolean).join('&')

  return qs
    ? `${props.game.sourceUrl}${props.game.sourceUrl.includes('?') ? '&' : '?'}${qs}`
    : props.game.sourceUrl
})

defineExpose({ start, stop, send, requestFullscreen })
</script>

<template>
  <div class="relative" :class="fullscreen ? 'h-full' : ''">
    <div
      ref="wrapRef"
      class="w-full overflow-hidden rounded-2xl border border-white/10 bg-black/30 shadow-2xl"
      :class="fullscreen ? 'h-full' : ''"
      :style="fullscreen ? { height: '100%', minHeight: '100%' } : { minHeight: minHeight + 'px' }"
    >
      <div class="relative w-full" :style="fullscreen ? { height: '100%' } : { aspectRatio: aspect }">
        <iframe
          v-if="started"
          ref="iframeRef"
          class="absolute inset-0 h-full w-full"
          :src="src"
          title="Game"
          allow="autoplay; fullscreen; gamepad"
          allowfullscreen
          loading="eager"
          sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-forms"
        />

        <div v-else class="absolute inset-0 grid place-items-center text-sm opacity-70">
          Ready to play
        </div>
      </div>
    </div>
  </div>
</template>
