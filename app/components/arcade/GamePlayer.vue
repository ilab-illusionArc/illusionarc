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

const aspect = computed(() => props.game.embed?.aspectRatio || '16/9')
const minHeight = computed(() => props.game.embed?.minHeight ?? 520)

/* ---------------- START / STOP ----------------
defer=true => show "Ready to play" until start()
but fullscreen or query flags can auto-start
------------------------------------------------ */
const started = ref(false)

function start() {
  started.value = true
}
function stop() {
  started.value = false
  // fully reset iframe
  iframeSrc.value = ''
  iframeKey.value++
}

/* Auto-start rules */
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

/* ---------------- SRC ----------------
We keep a separate iframeSrc ref.
Why:
- We only assign it AFTER layout is ready (prevents 0x0 Unity boot)
- We can force one safe remount when needed
------------------------------------------------ */
const computedSrc = computed(() => {
  const autostart =
    route.query.autostart != null
      ? `autostart=${encodeURIComponent(String(route.query.autostart))}`
      : `autostart=${props.fullscreen ? '1' : '0'}`

  const qs = [autostart].filter(Boolean).join('&')
  return qs
    ? `${props.game.sourceUrl}${props.game.sourceUrl.includes('?') ? '&' : '?'}${qs}`
    : props.game.sourceUrl
})

const iframeSrc = ref('')
const iframeKey = ref(0)

/* ---------------- WAIT FOR LAYOUT ----------------
Unity WebGL can boot blank if iframe is mounted while height/width is 0.
We wait until wrapper has real size, then mount iframe.
------------------------------------------------ */
async function nextFrame() {
  await new Promise<void>((r) => requestAnimationFrame(() => r()))
}
async function delay(ms: number) {
  await new Promise<void>((r) => setTimeout(r, ms))
}

async function waitForNonZeroBox(timeoutMs = 1200) {
  const startT = Date.now()
  while (Date.now() - startT < timeoutMs) {
    const el = wrapRef.value
    const w = el?.clientWidth || 0
    const h = el?.clientHeight || 0
    if (w > 50 && h > 50) return true
    await nextFrame()
  }
  return false
}

/* ---------------- BOOT STRATEGY ----------------
1) Wait for layout
2) Mount iframe (set src + bump key)
3) After load, dispatch resize inside iframe window (same-origin) + one extra remount if still blank-ish
------------------------------------------------ */
const booting = ref(false)
const bootedOnce = ref(false)

function dispatchResizeIntoIframe() {
  try {
    const win = iframeRef.value?.contentWindow
    if (!win) return
    // Same-origin path means this works.
    win.dispatchEvent(new Event('resize'))
    // Also try a second resize soon after.
    setTimeout(() => win.dispatchEvent(new Event('resize')), 120)
  } catch {
    // ignore
  }
}

function isIframeProbablyBlank() {
  const el = iframeRef.value
  if (!el) return false
  // If iframe has no contentDocument body size yet, it’s often blank/failed boot.
  try {
    const doc = el.contentDocument
    if (!doc) return true
    const body = doc.body
    if (!body) return true
    const rect = body.getBoundingClientRect()
    // if body is 0 height, likely not booted
    return rect.height < 10
  } catch {
    // if cross-origin (shouldn't be), we can't detect—assume ok
    return false
  }
}

async function mountIframe(forceCacheBust = false) {
  booting.value = true
  try {
    // wait for layout to stabilize
    await nextFrame()
    await nextFrame()

    const ok = await waitForNonZeroBox(1400)
    // even if not ok, still mount, but we tried
    const base = computedSrc.value

    // optional cache bust on first mount only (helps some Unity loader edge cases)
    const src =
      forceCacheBust
        ? `${base}${base.includes('?') ? '&' : '?'}_boot=${Date.now()}`
        : base

    iframeSrc.value = src
    iframeKey.value++
    await nextFrame()
  } finally {
    booting.value = false
  }
}

async function bootIfNeeded() {
  if (!started.value) return
  // always mount after started=true
  await mountIframe(false)
}

/* When started flips true -> boot */
watch(started, async (v) => {
  if (!v) return
  await bootIfNeeded()
})

/* If route changes (SPA nav), remount once */
watch(
  () => route.fullPath,
  async () => {
    if (!started.value) return
    bootedOnce.value = false
    await mountIframe(false)
  }
)

/* If game changes, remount */
watch(
  () => props.game?.sourceUrl,
  async () => {
    if (!started.value) return
    bootedOnce.value = false
    await mountIframe(false)
  }
)

/* ResizeObserver: whenever wrapper changes size, poke iframe resize */
let ro: ResizeObserver | null = null
onMounted(() => {
  if (wrapRef.value && typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => {
      if (started.value) dispatchResizeIntoIframe()
    })
    ro.observe(wrapRef.value)
  }
})
onBeforeUnmount(() => {
  ro?.disconnect()
  ro = null
})

/* ---------------- MESSAGING ---------------- */
function send(payload: any) {
  iframeRef.value?.contentWindow?.postMessage(payload, window.location.origin)
}

function requestFullscreen() {
  const el = wrapRef.value
  if (!el) return
  const anyEl = el as any
  if (anyEl.requestFullscreen) anyEl.requestFullscreen()
  else if (anyEl.webkitRequestFullscreen) anyEl.webkitRequestFullscreen()
}

/* ---------------- SCORE BRIDGE ---------------- */
const emit = defineEmits<{
  (e: 'score', payload: { score: number; raw?: any }): void
}>()

function onMessage(e: MessageEvent) {
  // accept only same-origin (your games are on same origin)
  if (e.origin !== window.location.origin) return
  const data = e.data
  if (!data || typeof data !== 'object') return

  if ((data as any).type === 'SCORE' && typeof (data as any).score === 'number') {
    emit('score', { score: (data as any).score, raw: data })
  }
}

onMounted(() => window.addEventListener('message', onMessage))
onBeforeUnmount(() => window.removeEventListener('message', onMessage))

/* ---------------- IFRAME LOAD HANDLER ----------------
After iframe load:
- trigger resize
- if still blank-ish once, remount with cache bust
------------------------------------------------------- */
async function onIframeLoad() {
  dispatchResizeIntoIframe()

  // One-time safety remount (fixes “blank until refresh” on some Unity builds)
  if (!bootedOnce.value) {
    bootedOnce.value = true
    await delay(200)
    if (isIframeProbablyBlank()) {
      await mountIframe(true) // cache bust
      await delay(120)
      dispatchResizeIntoIframe()
    }
  }
}

/* Expose API for embed page */
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
        <!-- ✅ IMPORTANT: iframe only mounts AFTER layout is ready and iframeSrc is set -->
        <iframe
          v-if="started && iframeSrc"
          :key="iframeKey"
          ref="iframeRef"
          class="absolute inset-0 h-full w-full"
          :src="iframeSrc"
          title="Game"
          allow="autoplay; fullscreen; gamepad"
          allowfullscreen
          loading="eager"
          sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-forms"
          @load="onIframeLoad"
        />

        <div v-else class="absolute inset-0 grid place-items-center text-sm opacity-70">
          <div class="text-center">
            <div v-if="booting">Loading game…</div>
            <div v-else>Ready to play</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
