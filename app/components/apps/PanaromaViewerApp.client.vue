<!-- components/apps/PanoramaViewerApp.client.vue -->
<script setup lang="ts">
import { ref, shallowRef, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'

/**
 * Panorama Tour (client-only)
 * - Upload 360 equirectangular images (blob:) and optional videos (A-Frame; requires CSP unsafe-eval)
 * - Create Move waypoints (Street-View style “ground arrows” path)
 * - Click waypoint/arrow => smooth rotate + ZOOM-IN and STAY zoomed (no auto zoom-back)
 * - Create Link hotspots to jump to another scene with matching camera yaw
 * - Camera pitch is always locked to EYE_PITCH (eye level; never looks down)
 */

type SceneType = 'image' | 'video'
type SceneItem = { id: string; name: string; type: SceneType; src: string; fileName: string }
type HotspotType = 'move' | 'link'

type Hotspot = {
  id: string
  sceneId: string
  type: HotspotType
  yaw: number
  pitch: number
  label: string

  // link
  targetSceneId?: string
  matchAngle?: boolean
  entryYaw?: number

  // move path length (how many arrows shown along path)
  steps?: number
}

type ArrowStep = { id: string; yaw: number; pitch: number; scale: number }

const panoEl = ref<HTMLDivElement | null>(null)
const fadeEl = ref<HTMLDivElement | null>(null)

const scenes = ref<SceneItem[]>([])
const currentSceneId = ref<string>('')

const hotspots = ref<Hotspot[]>([])
const currentScene = computed(() => scenes.value.find(s => s.id === currentSceneId.value) || null)
const currentHotspots = computed(() => hotspots.value.filter(h => h.sceneId === currentSceneId.value))

/** blob URL cleanup */
const objectUrls = new Set<string>()

/** create hotspot state */
const placing = ref(false)
const newType = ref<HotspotType>('move')

const modalOpen = ref(false)
const pendingPos = ref<{ yaw: number; pitch: number } | null>(null)
const pendingLabel = ref('Go')

// link fields
const pendingTargetSceneId = ref('')
const pendingMatchAngle = ref(true)
const pendingEntryYaw = ref('')

// move fields
const pendingSteps = ref(10) // number of path arrows

const targetOptions = computed(() => {
  const from = currentSceneId.value
  return scenes.value.filter(s => s.id !== from).map(s => ({ label: `${s.name} (${s.type})`, value: s.id }))
})

/* ===== Eye level ALWAYS ===== */
const EYE_PITCH = 0

/* ===== Camera FOV / “forward move” feel =====
   - We keep pitch fixed.
   - Move = rotate + zoom-in and STAY zoomed.
   - Each scene remembers its current zoom (fov).
*/
const FOV_BASE = Math.PI / 2
const ZOOM_FACTOR = 0.78 // smaller = stronger zoom in
const TRAVEL_MS = 900
const FADE_MS = 180

/** arrows path */
const pathArrows = ref<ArrowStep[]>([])
const arrowEls: HTMLElement[] = []

/** Marzipano runtime */
let Marzipano: any = null
const viewer = shallowRef<any>(null)
const sceneMap = new Map<string, any>()
const viewMap = new Map<string, any>()
const hotspotEls: HTMLElement[] = []

/** remember zoom per scene */
const sceneFov = new Map<string, number>()

/** travel control */
const traveling = ref(false)
let rafId: number | null = null
let travelAbort = { aborted: false }

function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`
}

/* ---------------- Lifecycle ---------------- */
onMounted(async () => {
  // A-Frame may be blocked by CSP (unsafe-eval). Images still work if CSP allows blob: in img-src.
  try { await import('aframe') } catch {}

  const mz = await import('marzipano')
  Marzipano = (mz as any).default ?? mz

  await nextTick()
  await ensureMarzipanoInit()
})

onBeforeUnmount(() => {
  try { panoEl.value?.removeEventListener('click', onPanoClick) } catch {}
  stopTravel()
  clearHotspotsDom()
  clearArrowDom()

  try { viewer.value?.destroy?.() } catch {}

  for (const url of objectUrls) {
    try { URL.revokeObjectURL(url) } catch {}
  }
  objectUrls.clear()
})

async function ensureMarzipanoInit() {
  if (!panoEl.value) await nextTick()
  if (!panoEl.value || !Marzipano) return

  if (!viewer.value) {
    viewer.value = new Marzipano.Viewer(panoEl.value, { controls: { mouseViewMode: 'drag' } })
    panoEl.value.addEventListener('click', onPanoClick)
  }

  const sc = currentScene.value
  if (sc?.type === 'image') {
    buildMarzipanoScene(sc)
    switchToMarzipano(sc.id, { keepYaw: true })
  }
}

/* ---------------- Upload ---------------- */
function onFilesPicked(e: Event) {
  const input = e.target as HTMLInputElement
  const files = input.files ? Array.from(input.files) : []
  if (!files.length) return

  for (const file of files) {
    const isVideo = file.type.startsWith('video/')
    const isImage = file.type.startsWith('image/')
    if (!isVideo && !isImage) continue

    const url = URL.createObjectURL(file)
    objectUrls.add(url)

    const item: SceneItem = {
      id: uid('scene'),
      name: file.name.replace(/\.[^.]+$/, ''),
      type: isVideo ? 'video' : 'image',
      src: url,
      fileName: file.name
    }
    scenes.value.push(item)

    if (item.type === 'image') buildMarzipanoScene(item)
  }

  if (!currentSceneId.value && scenes.value.length) currentSceneId.value = scenes.value[0].id
  input.value = ''
}

/* ---------------- Marzipano build/switch ---------------- */
function buildMarzipanoScene(item: SceneItem) {
  if (!viewer.value || !Marzipano || item.type !== 'image') return
  if (sceneMap.has(item.id)) return

  const geometry = new Marzipano.EquirectGeometry([{ width: 4000 }])
  const source = Marzipano.ImageUrlSource.fromString(item.src)
  const limiter = Marzipano.RectilinearView.limit.traditional(4096, (120 * Math.PI) / 180)

  const view = new Marzipano.RectilinearView({ yaw: 0, pitch: EYE_PITCH, fov: FOV_BASE }, limiter)
  viewMap.set(item.id, view)

  const scene = viewer.value.createScene({ source, geometry, view, pinFirstLevel: true })
  sceneMap.set(item.id, scene)

  // init remembered fov
  if (!sceneFov.has(item.id)) sceneFov.set(item.id, FOV_BASE)
}

function getActiveView() {
  return viewMap.get(currentSceneId.value) || null
}

function getCurrentYaw(): number {
  const v = getActiveView()
  const p = v?.parameters?.()
  return typeof p?.yaw === 'number' ? p.yaw : 0
}

function getCurrentFov(): number {
  const v = getActiveView()
  const p = v?.parameters?.()
  return typeof p?.fov === 'number' ? p.fov : (sceneFov.get(currentSceneId.value) ?? FOV_BASE)
}

function switchToMarzipano(sceneId: string, opts?: { keepYaw?: boolean; yaw?: number }) {
  const scene = sceneMap.get(sceneId)
  const view = viewMap.get(sceneId)
  if (!scene || !view) return

  const yawToSet =
    typeof opts?.yaw === 'number'
      ? normalizeYaw(opts.yaw)
      : opts?.keepYaw
        ? normalizeYaw(getCurrentYaw())
        : normalizeYaw(view.parameters().yaw || 0)

  const savedFov = sceneFov.get(sceneId) ?? FOV_BASE

  // enforce eye-level & use saved zoom
  view.setParameters({ yaw: yawToSet, pitch: EYE_PITCH, fov: savedFov })

  scene.switchTo({ transitionDuration: 650 })
  renderHotspotsFor(sceneId)
  // keep arrows visible if we already have a path
  renderArrowPath(sceneId)

  setTimeout(() => viewer.value?.updateSize?.(), 0)
}

watch(currentSceneId, async (id, prev) => {
  if (!id) return

  placing.value = false
  closeModal()
  stopTravel()
  clearArrowDom() // new scene => clear old path arrows

  const sc = scenes.value.find(s => s.id === id)
  if (!sc) return

  await ensureMarzipanoInit()

  if (sc.type === 'image') {
    buildMarzipanoScene(sc)
    await nextTick()

    // enter with previous yaw, but keep scene saved zoom
    const prevYaw = prev ? getYawOfScene(prev) : getCurrentYaw()
    switchToMarzipano(id, { yaw: prevYaw })
  }
})

function getYawOfScene(sceneId: string) {
  const v = viewMap.get(sceneId)
  const p = v?.parameters?.()
  return typeof p?.yaw === 'number' ? p.yaw : 0
}

/* ---------------- Place hotspot ---------------- */
function onPanoClick(ev: MouseEvent) {
  if (!placing.value) return
  if (currentScene.value?.type !== 'image') return
  if (!viewer.value || !Marzipano || !panoEl.value) return

  const mzScene = sceneMap.get(currentSceneId.value)
  const view = mzScene?.view?.()
  if (!view?.screenToCoordinates) return

  const rect = panoEl.value.getBoundingClientRect()
  const x = ev.clientX - rect.left
  const y = ev.clientY - rect.top
  const coords = view.screenToCoordinates({ x, y })
  if (!coords) return

  pendingPos.value = { yaw: coords.yaw, pitch: coords.pitch }
  pendingLabel.value =
    newType.value === 'move'
      ? `Waypoint ${currentHotspots.value.filter(h => h.type === 'move').length + 1}`
      : `Go ${currentHotspots.value.filter(h => h.type === 'link').length + 1}`

  if (newType.value === 'link') {
    pendingTargetSceneId.value = targetOptions.value[0]?.value || ''
    pendingMatchAngle.value = true
    pendingEntryYaw.value = ''
  } else {
    pendingSteps.value = 10
  }

  modalOpen.value = true
}

function closeModal() {
  modalOpen.value = false
  pendingPos.value = null
  pendingLabel.value = 'Go'
  pendingTargetSceneId.value = ''
  pendingMatchAngle.value = true
  pendingEntryYaw.value = ''
  pendingSteps.value = 10
}

function confirmHotspot() {
  if (!pendingPos.value || !currentSceneId.value) return

  const hs: Hotspot = {
    id: uid('hs'),
    sceneId: currentSceneId.value,
    type: newType.value,
    yaw: pendingPos.value.yaw,
    pitch: pendingPos.value.pitch,
    label: (pendingLabel.value || 'Go').trim() || 'Go'
  }

  if (hs.type === 'link') {
    if (!pendingTargetSceneId.value) return
    hs.targetSceneId = pendingTargetSceneId.value
    hs.matchAngle = !!pendingMatchAngle.value
    const n = Number(pendingEntryYaw.value)
    if (Number.isFinite(n)) hs.entryYaw = n
  } else {
    hs.steps = clampInt(pendingSteps.value, 4, 18)
  }

  hotspots.value.push(hs)
  closeModal()
  placing.value = false
  renderHotspotsFor(currentSceneId.value)

  // If a move hotspot created: build an initial path from current yaw to that hotspot
  if (hs.type === 'move') {
    const v = viewMap.get(hs.sceneId)
    if (v) {
      const fromYaw = v.parameters().yaw
      buildArrowPath(fromYaw, hs.yaw, hs.steps ?? 10)
      renderArrowPath(hs.sceneId)
    }
  }
}

function clampInt(v: number, min: number, max: number) {
  const n = Math.round(Number(v))
  if (!Number.isFinite(n)) return min
  return Math.max(min, Math.min(max, n))
}

/* ---------------- DOM helpers ---------------- */
function clearHotspotsDom() {
  while (hotspotEls.length) {
    const el = hotspotEls.pop()
    try { el?.remove() } catch {}
  }
}

function clearArrowDom() {
  while (arrowEls.length) {
    const el = arrowEls.pop()
    try { el?.remove() } catch {}
  }
  pathArrows.value = []
}

function renderHotspotsFor(sceneId: string) {
  const scene = sceneMap.get(sceneId)
  if (!scene) return

  clearHotspotsDom()
  // IMPORTANT: do NOT auto-clear arrows. Arrows should persist like Google Maps.

  // normal hotspots
  const hs = hotspots.value.filter(h => h.sceneId === sceneId)
  for (const h of hs) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.title = h.label
    btn.innerHTML = `<span class="dot"></span><span class="txt">${escapeHtml(h.label)}</span>`
    styleHotspotButton(btn, h.type)

    const handler = (e: Event) => {
      e.preventDefault()
      e.stopPropagation()
      if (h.type === 'move') runMove(h)
      else runLink(h)
    }

    // ✅ one-click reliable (no double click)
    btn.addEventListener('pointerdown', handler, { passive: false })
    btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation() })

    scene.hotspotContainer().createHotspot(btn, { yaw: h.yaw, pitch: h.pitch })
    hotspotEls.push(btn)
  }
}

function renderArrowPath(sceneId: string) {
  const scene = sceneMap.get(sceneId)
  if (!scene) return

  while (arrowEls.length) {
    const el = arrowEls.pop()
    try { el?.remove() } catch {}
  }

  if (!pathArrows.value.length) return

  for (const a of pathArrows.value) {
    const el = document.createElement('div')
    styleGroundArrow(el, a.scale, /* rotate arrow direction */ a.yaw)
    const onArrow = (e: Event) => {
      e.preventDefault()
      e.stopPropagation()
      runWaypointTo(sceneId, a.yaw)
    }
    el.addEventListener('pointerdown', onArrow, { passive: false })
    scene.hotspotContainer().createHotspot(el, { yaw: a.yaw, pitch: a.pitch })
    arrowEls.push(el)
  }
}

/* ---------------- Styling (inline / dark aware) ---------------- */
const isDark = computed(() => {
  if (import.meta.client) return document.documentElement.classList.contains('dark')
  return false
})

function styleHotspotButton(el: HTMLElement, kind: 'move' | 'link') {
  el.style.display = 'inline-flex'
  el.style.alignItems = 'center'
  el.style.gap = '8px'
  el.style.borderRadius = '999px'
  el.style.padding = '8px 10px'
  el.style.border = '1px solid rgba(255,255,255,.22)'
  el.style.background = 'rgba(0,0,0,.42)'
  el.style.color = 'white'
  el.style.backdropFilter = 'blur(8px)'
  ;(el.style as any).webkitBackdropFilter = 'blur(8px)'
  el.style.cursor = 'pointer'
  el.style.userSelect = 'none'
  el.style.transition = 'background .12s ease, transform .08s ease'
  el.onmouseenter = () => (el.style.background = 'rgba(0,0,0,.60)')
  el.onmouseleave = () => (el.style.background = 'rgba(0,0,0,.42)')
  el.onpointerdown = () => (el.style.transform = 'scale(.98)')
  el.onpointerup = () => (el.style.transform = 'scale(1)')

  const dot = el.querySelector('.dot') as HTMLElement | null
  if (dot) {
    dot.style.width = '10px'
    dot.style.height = '10px'
    dot.style.borderRadius = '999px'
    dot.style.background = kind === 'link' ? 'rgba(34,211,238,.95)' : 'rgba(124,58,237,.95)'
  }

  const txt = el.querySelector('.txt') as HTMLElement | null
  if (txt) {
    txt.style.fontSize = '12px'
    txt.style.fontWeight = '900'
    txt.style.letterSpacing = '.2px'
    txt.style.whiteSpace = 'nowrap'
  }
}

/**
 * Ground arrow tile (Street View style)
 * - looks like an arrow “on the ground”
 * - clickable
 * - we keep pitch locked anyway so it never looks down
 */
function styleGroundArrow(el: HTMLElement, scale: number, yaw: number) {
  // tile
  el.style.width = `${54 * scale}px`
  el.style.height = `${36 * scale}px`
  el.style.borderRadius = '999px'
  el.style.border = '1px solid rgba(255,255,255,.24)'
  el.style.background = 'rgba(0,0,0,.45)'
  el.style.backdropFilter = 'blur(8px)'
  ;(el.style as any).webkitBackdropFilter = 'blur(8px)'
  el.style.boxShadow = '0 12px 26px rgba(0,0,0,.35)'
  el.style.display = 'grid'
  el.style.placeItems = 'center'
  el.style.pointerEvents = 'auto'
  el.style.cursor = 'pointer'
  el.style.userSelect = 'none'
  el.style.transition = 'transform .14s ease, background .14s ease, box-shadow .14s ease'
  el.style.opacity = '0.98'

  // ground tilt + slight flatten
  // We also rotate the arrow glyph to face forward relative to current yaw by using CSS rotateZ.
  // The yaw rotation is subtle; the main direction is still “forward”.
  const rotateZ = 0 // keep simple and stable; change if you want dynamic direction visuals
  el.style.transform = `translate(-50%,-50%) scale(${scale}) rotateX(60deg) rotateZ(${rotateZ}deg)`
  ;(el.style as any).transformStyle = 'preserve-3d'

  el.innerHTML = `
    <div style="
      font-size:${18 * scale}px;
      font-weight:900;
      color:rgba(255,255,255,.95);
      transform: translateY(-1px);
      text-shadow: 0 10px 24px rgba(0,0,0,.55);
      line-height:1;
    ">➤</div>
  `

  el.onmouseenter = () => {
    el.style.background = 'rgba(0,0,0,.65)'
    el.style.boxShadow = '0 16px 32px rgba(0,0,0,.45)'
    el.style.transform = `translate(-50%,-50%) scale(${scale * 1.04}) rotateX(58deg) rotateZ(${rotateZ}deg)`
  }
  el.onmouseleave = () => {
    el.style.background = 'rgba(0,0,0,.45)'
    el.style.boxShadow = '0 12px 26px rgba(0,0,0,.35)'
    el.style.transform = `translate(-50%,-50%) scale(${scale}) rotateX(60deg) rotateZ(${rotateZ}deg)`
  }
}

/* ---------------- Move logic (Google Maps like) ----------------
   - A Move hotspot defines a destination yaw.
   - Clicking it builds arrows along the path and moves to destination.
   - Clicking any arrow also moves.
   - Move does: rotate + zoom-in and STAY zoomed.
*/
function stopTravel() {
  travelAbort.aborted = true
  if (rafId) cancelAnimationFrame(rafId)
  rafId = null
  traveling.value = false
}

function runMove(h: Hotspot) {
  const view = viewMap.get(h.sceneId)
  if (!view) return

  // Build a path from current yaw to hotspot yaw and render arrows (persist)
  const steps = clampInt(h.steps ?? 10, 4, 18)
  const fromYaw = view.parameters().yaw
  buildArrowPath(fromYaw, h.yaw, steps)
  renderArrowPath(h.sceneId)

  // One click => move (rotate + zoom and stay)
  runWaypointTo(h.sceneId, h.yaw)
}

function runWaypointTo(sceneId: string, targetYaw: number) {
  const view = viewMap.get(sceneId)
  if (!view) return

  stopTravel()
  travelAbort = { aborted: false }
  traveling.value = true

  pulseFade(FADE_MS)

  const start = view.parameters()
  const fromYaw = start.yaw

  // base fov is current or remembered
  const baseFov = getCurrentFov()
  const zoomFov = clamp(baseFov * ZOOM_FACTOR, Math.PI / 9, Math.PI / 1.75)

  animateYawAndFov(view, fromYaw, targetYaw, baseFov, zoomFov, TRAVEL_MS, travelAbort, () => {
    // ✅ STAY zoomed (no zoom-back)
    const p = view.parameters()
    view.setParameters({ yaw: p.yaw, pitch: EYE_PITCH, fov: zoomFov })
    sceneFov.set(sceneId, zoomFov)

    traveling.value = false
  })
}

function buildArrowPath(fromYaw: number, toYaw: number, steps: number) {
  const target = shortestYawTarget(fromYaw, toYaw)
  const arr: ArrowStep[] = []
  for (let i = 1; i <= steps; i++) {
    const t = i / (steps + 1)
    const yaw = normalizeYaw(fromYaw + (target - fromYaw) * t)
    const scale = 0.75 + 0.85 * t // 0.75 -> 1.6 (closer arrows feel bigger)
    arr.push({ id: uid('arrow'), yaw, pitch: EYE_PITCH, scale })
  }
  pathArrows.value = arr
}

function animateYawAndFov(
  view: any,
  fromYaw: number,
  toYaw: number,
  fromFov: number,
  toFov: number,
  durationMs: number,
  abort: { aborted: boolean },
  done?: () => void
) {
  const t0 = performance.now()
  const target = shortestYawTarget(fromYaw, toYaw)

  const step = (now: number) => {
    if (abort.aborted) return
    const t = Math.min(1, (now - t0) / durationMs)
    const k = easeInOutCubic(t)
    const kk = easeOutCubic(k) // zoom feels snappier

    view.setParameters({
      yaw: normalizeYaw(fromYaw + (target - fromYaw) * k),
      pitch: EYE_PITCH,                 // ✅ eye level always
      fov: fromFov + (toFov - fromFov) * kk
    })

    if (t < 1) rafId = requestAnimationFrame(step)
    else {
      rafId = null
      done?.()
    }
  }

  rafId = requestAnimationFrame(step)
}

/* ---------------- Link scenes (match angle) ---------------- */
function runLink(h: Hotspot) {
  if (!h.targetSceneId) return

  stopTravel()
  clearArrowDom()
  pulseFade(FADE_MS)

  const yaw =
    h.matchAngle === false
      ? (typeof h.entryYaw === 'number' ? h.entryYaw : getCurrentYaw())
      : getCurrentYaw()

  setTimeout(() => {
    currentSceneId.value = h.targetSceneId!
    setTimeout(() => {
      const target = scenes.value.find(s => s.id === h.targetSceneId)
      if (target?.type === 'image') {
        buildMarzipanoScene(target)
        // keep yaw matching on entry
        switchToMarzipano(h.targetSceneId!, { yaw })
      }
    }, 0)
  }, 140)
}

/* ---------------- Fade pulse ---------------- */
function pulseFade(ms = 180) {
  const el = fadeEl.value
  if (!el) return
  el.style.opacity = '0'
  el.style.transition = `opacity ${ms}ms ease`
  // force reflow
  void (el as any).offsetWidth
  el.style.opacity = '1'
  setTimeout(() => {
    if (fadeEl.value) fadeEl.value.style.opacity = '0'
  }, ms)
}

/* ---------------- Manage lists ---------------- */
function removeHotspot(id: string) {
  hotspots.value = hotspots.value.filter(h => h.id !== id)
  renderHotspotsFor(currentSceneId.value)
}

function renameScene(id: string) {
  const s = scenes.value.find(x => x.id === id)
  if (!s) return
  const next = prompt('Scene name', s.name)
  if (next && next.trim()) s.name = next.trim()
}

function deleteScene(id: string) {
  stopTravel()
  clearArrowDom()

  hotspots.value = hotspots.value.filter(h => h.sceneId !== id)
  sceneMap.delete(id)
  viewMap.delete(id)
  sceneFov.delete(id)

  if (currentSceneId.value === id) clearHotspotsDom()

  const idx = scenes.value.findIndex(s => s.id === id)
  const removed = idx >= 0 ? scenes.value.splice(idx, 1)[0] : null
  if (removed?.src) {
    try { URL.revokeObjectURL(removed.src) } catch {}
    objectUrls.delete(removed.src)
  }

  if (currentSceneId.value === id) currentSceneId.value = scenes.value[0]?.id || ''
}

/* ---------------- Utilities ---------------- */
function normalizeYaw(y: number) {
  while (y > Math.PI) y -= 2 * Math.PI
  while (y < -Math.PI) y += 2 * Math.PI
  return y
}

function shortestYawTarget(fromYaw: number, toYaw: number) {
  let d = toYaw - fromYaw
  while (d > Math.PI) d -= 2 * Math.PI
  while (d < -Math.PI) d += 2 * Math.PI
  return fromYaw + d
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}
function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function escapeHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

/* ---------------- Inline styles (computed) ---------------- */
const wrapStyle = computed(() => ({
  display: 'grid',
  gap: '14px',
  gridTemplateColumns: '360px 1fr'
}))

const panelStyle = computed(() => ({
  borderRadius: '16px',
  border: isDark.value ? '1px solid rgba(255,255,255,.12)' : '1px solid rgba(0,0,0,.10)',
  background: isDark.value ? 'rgba(8,10,18,.82)' : 'rgba(255,255,255,.70)',
  backdropFilter: 'blur(10px)',
  padding: '14px',
  color: isDark.value ? '#fff' : '#111'
}))

const cardStyle = computed(() => ({
  borderRadius: '16px',
  border: isDark.value ? '1px solid rgba(255,255,255,.12)' : '1px solid rgba(0,0,0,.10)',
  background: isDark.value ? 'rgba(8,10,18,.82)' : 'rgba(255,255,255,.70)',
  backdropFilter: 'blur(10px)',
  overflow: 'hidden',
  color: isDark.value ? '#fff' : '#111'
}))

const blockStyle = computed(() => ({
  marginTop: '14px',
  padding: '12px',
  borderRadius: '14px',
  border: isDark.value ? '1px solid rgba(255,255,255,.10)' : '1px solid rgba(0,0,0,.10)',
  background: isDark.value ? 'rgba(0,0,0,.35)' : 'rgba(255,255,255,.55)'
}))

const btnStyle = computed(() => ({
  borderRadius: '999px',
  border: isDark.value ? '1px solid rgba(255,255,255,.14)' : '1px solid rgba(0,0,0,.14)',
  background: isDark.value ? 'rgba(0,0,0,.44)' : 'rgba(255,255,255,.72)',
  padding: '10px 12px',
  fontSize: '13px',
  fontWeight: '900',
  cursor: 'pointer',
  transition: '.12s',
  color: isDark.value ? '#fff' : '#111'
}))

const smallBtnStyle = computed(() => ({
  ...btnStyle.value,
  padding: '7px 10px',
  fontSize: '12px'
}))

const inputStyle = computed(() => ({
  width: '100%',
  borderRadius: '12px',
  border: isDark.value ? '1px solid rgba(255,255,255,.14)' : '1px solid rgba(0,0,0,.14)',
  background: isDark.value ? 'rgba(255,255,255,.06)' : 'rgba(255,255,255,.85)',
  color: isDark.value ? '#fff' : '#111',
  padding: '10px 10px',
  fontSize: '13px',
  outline: 'none'
}))
</script>

<template>
  <div :style="wrapStyle">
    <!-- Left panel -->
    <aside :style="panelStyle">
      <div style="font-weight:900;font-size:16px;">Panorama Tour</div>
      <div style="margin-top:4px;font-size:13px;opacity:.75;">
        Move waypoints create “ground arrows”. Click an arrow to go ahead (rotate + zoom and stay). Pitch stays eye-level.
      </div>

      <div :style="blockStyle">
        <div style="font-size:12px;font-weight:900;opacity:.75;">Add scenes</div>
        <input style="width:100%;margin-top:8px;" type="file" multiple accept="image/*,video/*" @change="onFilesPicked" />
        <div style="margin-top:6px;font-size:12px;opacity:.65;">
          Images: equirectangular JPG/PNG • Videos: 360 MP4 (A-Frame may require CSP unsafe-eval)
        </div>
      </div>

      <div style="margin-top:14px;display:flex;justify-content:space-between;align-items:center;">
        <div style="font-size:12px;font-weight:900;opacity:.75;">Scenes</div>
        <div style="font-size:12px;opacity:.6;">{{ scenes.length }}</div>
      </div>

      <div
        v-if="!scenes.length"
        :style="{
          marginTop:'10px',
          padding:'12px',
          borderRadius:'14px',
          opacity:.75,
          border: isDark ? '1px dashed rgba(255,255,255,.18)' : '1px dashed rgba(0,0,0,.18)'
        }"
      >
        Upload a scene to start.
      </div>

      <div v-else style="margin-top:10px;display:flex;flex-direction:column;gap:10px;">
        <button
          v-for="s in scenes"
          :key="s.id"
          @click="currentSceneId = s.id"
          :style="{
            textAlign:'left',
            width:'100%',
            borderRadius:'14px',
            padding:'12px',
            cursor:'pointer',
            transition:'.12s',
            border: (s.id===currentSceneId)
              ? (isDark ? '1px solid rgba(255,255,255,.22)' : '1px solid rgba(0,0,0,.22)')
              : (isDark ? '1px solid rgba(255,255,255,.10)' : '1px solid rgba(0,0,0,.10)'),
            background: (s.id===currentSceneId)
              ? (isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)')
              : (isDark ? 'rgba(0,0,0,.30)' : 'rgba(255,255,255,.55)'),
            color: isDark ? '#fff' : '#111'
          }"
        >
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
            <div style="font-weight:900;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              {{ s.name }}
            </div>
            <div
              :style="{
                fontSize:'10px',
                fontWeight:'900',
                borderRadius:'999px',
                padding:'4px 8px',
                opacity:.85,
                border: isDark ? '1px solid rgba(255,255,255,.12)' : '1px solid rgba(0,0,0,.12)',
                background: isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)'
              }"
            >
              {{ s.type }}
            </div>
          </div>

          <div style="margin-top:6px;font-size:12px;opacity:.65;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            {{ s.fileName }}
          </div>

          <div style="margin-top:10px;display:flex;gap:8px;" @click.stop>
            <button :style="smallBtnStyle" @click="renameScene(s.id)">Rename</button>
            <button :style="smallBtnStyle" @click="deleteScene(s.id)">Delete</button>
          </div>
        </button>
      </div>

      <div :style="blockStyle">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div style="font-size:12px;font-weight:900;opacity:.75;">Hotspots</div>
          <div style="font-size:12px;opacity:.6;">{{ currentHotspots.length }}</div>
        </div>

        <div style="margin-top:10px;display:flex;gap:8px;">
          <button
            @click="newType = 'move'"
            :style="{
              ...btnStyle,
              flex:'1',
              background: newType==='move'
                ? (isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)')
                : btnStyle.background,
              border: newType==='move'
                ? (isDark ? '1px solid rgba(255,255,255,.28)' : '1px solid rgba(0,0,0,.28)')
                : btnStyle.border
            }"
          >
            Move (Waypoint)
          </button>

          <button
            @click="newType = 'link'"
            :style="{
              ...btnStyle,
              flex:'1',
              background: newType==='link'
                ? (isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)')
                : btnStyle.background,
              border: newType==='link'
                ? (isDark ? '1px solid rgba(255,255,255,.28)' : '1px solid rgba(0,0,0,.28)')
                : btnStyle.border
            }"
          >
            Link (Scene)
          </button>
        </div>

        <button
          @click="placing = !placing"
          :disabled="!currentScene || currentScene.type !== 'image' || (newType === 'link' && targetOptions.length === 0)"
          :style="{
            ...btnStyle,
            width:'100%',
            marginTop:'10px',
            opacity: (!currentScene || currentScene.type !== 'image' || (newType==='link' && targetOptions.length===0)) ? .55 : 1
          }"
        >
          {{ placing ? 'Click on panorama…' : 'Place hotspot' }}
        </button>

        <div v-if="newType==='link' && targetOptions.length===0" style="margin-top:6px;font-size:12px;opacity:.65;">
          Need at least 2 scenes for link hotspots.
        </div>

        <div v-if="currentHotspots.length" style="margin-top:10px;display:flex;flex-direction:column;gap:8px;">
          <div
            v-for="h in currentHotspots"
            :key="h.id"
            :style="{
              display:'flex',
              justifyContent:'space-between',
              gap:'10px',
              alignItems:'center',
              borderRadius:'12px',
              padding:'10px',
              border: isDark ? '1px solid rgba(255,255,255,.10)' : '1px solid rgba(0,0,0,.10)',
              background: isDark ? 'rgba(0,0,0,.35)' : 'rgba(255,255,255,.60)'
            }"
          >
            <div style="min-width:0;">
              <div style="font-weight:900;font-size:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                <span
                  :style="{
                    fontSize:'10px',
                    fontWeight:'900',
                    borderRadius:'999px',
                    padding:'3px 8px',
                    textTransform:'uppercase',
                    border: isDark ? '1px solid rgba(255,255,255,.14)' : '1px solid rgba(0,0,0,.14)',
                    background: isDark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.05)',
                    opacity:.85
                  }"
                >
                  {{ h.type }}
                </span>

                {{ h.label }}
                <span v-if="h.type==='link'" style="opacity:.75;">
                  → {{ scenes.find(s => s.id === h.targetSceneId)?.name || 'Scene' }}
                </span>
              </div>

              <div style="font-size:12px;opacity:.65;margin-top:2px;">
                yaw {{ h.yaw.toFixed(3) }} • pitch {{ h.pitch.toFixed(3) }}
              </div>
            </div>

            <button :style="smallBtnStyle" @click="removeHotspot(h.id)">Remove</button>
          </div>
        </div>

        <div v-else style="margin-top:8px;font-size:12px;opacity:.65;">No hotspots yet.</div>
      </div>
    </aside>

    <!-- Viewer -->
    <main :style="cardStyle">
      <div :style="{ padding:'12px 14px', borderBottom: isDark ? '1px solid rgba(255,255,255,.10)' : '1px solid rgba(0,0,0,.10)' }">
        <div style="font-weight:900;font-size:14px;">{{ currentScene ? currentScene.name : 'Viewer' }}</div>
        <div style="margin-top:2px;font-size:12px;opacity:.65;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          {{ currentScene ? `${currentScene.type.toUpperCase()} • ${currentScene.fileName}` : 'Upload a scene to begin' }}
        </div>
      </div>

      <div style="position:relative;height:640px;">
        <div
          ref="fadeEl"
          style="
            position:absolute;inset:0;pointer-events:none;opacity:0;
            background:radial-gradient(circle at center, rgba(0,0,0,0) 40%, rgba(0,0,0,.35) 100%);
            z-index:5;
          "
        ></div>

        <!-- Images -->
        <div v-show="currentScene?.type !== 'video'" ref="panoEl" style="position:absolute;inset:0;"></div>

        <!-- Videos (A-Frame; may require CSP unsafe-eval) -->
        <div v-show="currentScene?.type === 'video'" style="position:absolute;inset:0;">
          <a-scene v-if="currentScene?.type === 'video'" embedded vr-mode-ui="enabled: false">
            <a-assets>
              <video id="panoVideo" :src="currentScene.src" autoplay loop muted playsinline webkit-playsinline />
            </a-assets>
            <a-entity position="0 1.6 0">
              <a-camera look-controls="enabled: true" wasd-controls="enabled: false" />
            </a-entity>
            <a-videosphere src="#panoVideo" rotation="0 -90 0"></a-videosphere>
          </a-scene>
        </div>

        <div
          v-if="!currentScene"
          style="position:absolute;inset:0;display:grid;place-items:center;font-size:14px;opacity:.7;"
        >
          Upload a scene to start.
        </div>
      </div>
    </main>

    <!-- Modal -->
    <div
      v-if="modalOpen"
      @click.self="closeModal"
      style="position:fixed;inset:0;background:rgba(0,0,0,.55);display:grid;place-items:center;z-index:9999;padding:20px;"
    >
      <div style="width:min(560px,100%);border-radius:16px;border:1px solid rgba(255,255,255,.12);background:rgba(10,12,18,.94);color:white;backdrop-filter:blur(12px);padding:14px;">
        <div style="font-weight:900;font-size:14px;">Create {{ newType === 'move' ? 'Waypoint' : 'Link' }}</div>

        <div style="margin-top:12px;display:flex;flex-direction:column;gap:6px;">
          <div style="font-size:12px;font-weight:900;opacity:.75;">Label</div>
          <input v-model="pendingLabel" :style="inputStyle" type="text" placeholder="Go" />
        </div>

        <template v-if="newType === 'move'">
          <div style="margin-top:12px;display:flex;flex-direction:column;gap:6px;">
            <div style="font-size:12px;font-weight:900;opacity:.75;">Arrows along path</div>
            <input v-model.number="pendingSteps" :style="inputStyle" type="number" min="4" max="18" />
            <div style="font-size:12px;opacity:.7;">More arrows = longer path. Click any arrow to go ahead (zoom stays).</div>
          </div>
        </template>

        <template v-else>
          <div style="margin-top:12px;display:flex;flex-direction:column;gap:6px;">
            <div style="font-size:12px;font-weight:900;opacity:.75;">Target scene</div>
            <select v-model="pendingTargetSceneId" :style="inputStyle">
              <option v-for="o in targetOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
          </div>

          <div style="margin-top:12px;display:flex;gap:10px;align-items:center;font-size:13px;opacity:.9;">
            <input v-model="pendingMatchAngle" type="checkbox" style="width:16px;height:16px;" />
            <span>Match current camera angle on transition</span>
          </div>

          <div v-if="!pendingMatchAngle" style="margin-top:12px;display:flex;flex-direction:column;gap:6px;">
            <div style="font-size:12px;font-weight:900;opacity:.75;">Entry yaw (radians)</div>
            <input v-model="pendingEntryYaw" :style="inputStyle" type="text" placeholder="0, 1.57, -3.14" />
          </div>
        </template>

        <div style="margin-top:14px;display:flex;justify-content:flex-end;gap:10px;">
          <button @click="closeModal" :style="{ ...btnStyle, background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.14)', color:'#fff' }">
            Cancel
          </button>
          <button
            @click="confirmHotspot"
            :disabled="newType==='link' && !pendingTargetSceneId"
            :style="{
              ...btnStyle,
              background:'rgba(255,255,255,.16)',
              border:'1px solid rgba(255,255,255,.20)',
              color:'#fff',
              opacity: (newType==='link' && !pendingTargetSceneId) ? .45 : 1
            }"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
