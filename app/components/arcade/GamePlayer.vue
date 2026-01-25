<script setup lang="ts">
import type { ArcadeGame } from '@/data/games'

const props = withDefaults(
  defineProps<{
    game: ArcadeGame
    defer?: boolean
    fullscreen?: boolean
    /** change this to force iframe src + remount */
    cacheKey?: string
  }>(),
  {
    defer: false,
    fullscreen: false,
    cacheKey: ''
  }
)

const route = useRoute()

const iframeRef = ref<HTMLIFrameElement | null>(null)
const wrapRef = ref<HTMLElement | null>(null)

const aspect = computed(() => props.game.embed.aspectRatio || '16/9')
const minHeight = computed(() => props.game.embed.minHeight ?? 520)

const started = ref(false)
const frameKey = ref(0)

function start() {
  started.value = true
}
function stop() {
  started.value = false
}
function reload() {
  // forces iframe remount
  started.value = true
  frameKey.value++
}

// Auto-start rules
const shouldAutoStart = computed(() => {
  if (!props.defer) return true
  if (props.fullscreen) return true
  if (String(route.query.play || '') === '1') return true
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

function send(payload: any) {
  iframeRef.value?.contentWindow?.postMessage(payload, '*')
}

function requestFullscreen() {
  const el = wrapRef.value as any
  if (!el) return
  if (el.requestFullscreen) el.requestFullscreen()
  else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen()
}

// SCORE bridge
const emit = defineEmits<{
  (e: 'score', payload: { score: number; raw?: any }): void
}>()

function onMessage(e: MessageEvent) {
  if (e.origin !== window.location.origin) return
  const data = e.data
  if (!data || typeof data !== 'object') return
  if ((data as any).type === 'SCORE' && typeof (data as any).score === 'number') {
    emit('score', { score: (data as any).score, raw: data })
  }
}

onMounted(() => window.addEventListener('message', onMessage))
onBeforeUnmount(() => window.removeEventListener('message', onMessage))

// iframe src with cache-bust that changes when cacheKey changes
const src = computed(() => {
  const autostart =
    route.query.autostart != null
      ? String(route.query.autostart)
      : props.fullscreen
        ? '1'
        : '0'

  const qs = new URLSearchParams()
  qs.set('autostart', autostart)

  // IMPORTANT: make src unique per navigation / click
  const v = props.cacheKey || `${Date.now()}-${frameKey.value}`
  qs.set('v', v)

  const base = props.game.sourceUrl
  return `${base}${base.includes('?') ? '&' : '?'}${qs.toString()}`
})

defineExpose({ start, stop, reload, send, requestFullscreen })
</script>

<template>
  <div class="relative" :class="props.fullscreen ? 'h-full' : ''">
    <div
      ref="wrapRef"
      class="w-full overflow-hidden rounded-2xl border border-white/10 bg-black/30 shadow-2xl"
      :class="props.fullscreen ? 'h-full' : ''"
      :style="props.fullscreen ? { height: '100%', minHeight: '100%' } : { minHeight: minHeight + 'px' }"
    >
      <div class="relative w-full" :style="props.fullscreen ? { height: '100%' } : { aspectRatio: aspect }">
        <iframe
          v-if="started"
          :key="frameKey"
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
