<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import * as THREE from 'three'

const wrap = ref<HTMLDivElement | null>(null)

let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let orb: THREE.Group | null = null
let raf = 0

let isDown = false
let lastX = 0
let lastY = 0
let targetRotX = 0
let targetRotY = 0

let ro: ResizeObserver | null = null
let reducedMotion = false
let rotSens = 0.006 // will be recalculated from size

const size = { w: 1, h: 1, min: 1 }

function updateSensitivity() {
  // smaller container -> slightly higher sensitivity; larger -> slightly lower
  rotSens = THREE.MathUtils.clamp(2.6 / Math.max(240, size.min), 0.0045, 0.010)
}

function readReducedMotion() {
  reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

function disposeMaterial(mat: any) {
  // dispose textures on the material
  for (const k in mat) {
    const v = mat[k]
    if (v && v.isTexture) v.dispose()
  }
  mat.dispose?.()
}

function cleanup() {
  cancelAnimationFrame(raf)
  raf = 0

  ro?.disconnect()
  ro = null

  if (wrap.value) {
    wrap.value.removeEventListener('pointerdown', onDown)
    wrap.value.removeEventListener('pointermove', onMove)
    wrap.value.removeEventListener('pointerup', onUp)
    wrap.value.removeEventListener('pointerleave', onUp)
    wrap.value.removeEventListener('pointercancel', onUp)
  }

  if (scene) {
    scene.traverse((obj: any) => {
      if (obj.geometry) obj.geometry.dispose?.()
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(disposeMaterial)
        else disposeMaterial(obj.material)
      }
    })
  }

  if (renderer) {
    renderer.dispose()
    renderer.forceContextLoss?.()
    renderer.domElement?.remove()
  }

  renderer = null
  scene = null
  camera = null
  orb = null
}

function onDown(e: PointerEvent) {
  isDown = true
  lastX = e.clientX
  lastY = e.clientY
  ;(e.currentTarget as HTMLElement)?.setPointerCapture?.(e.pointerId)
}

function onMove(e: PointerEvent) {
  if (!isDown) return
  const dx = e.clientX - lastX
  const dy = e.clientY - lastY
  lastX = e.clientX
  lastY = e.clientY

  targetRotY += dx * rotSens
  targetRotX += dy * rotSens
  targetRotX = Math.max(-0.9, Math.min(0.9, targetRotX))
}

function onUp() {
  isDown = false
}

function resizeTo(w: number, h: number) {
  if (!renderer || !camera) return

  size.w = Math.max(1, w)
  size.h = Math.max(1, h)
  size.min = Math.min(size.w, size.h)

  updateSensitivity()

  camera.aspect = size.w / size.h

  // small containers: slightly wider FOV + closer camera
  camera.fov = size.min < 420 ? 42 : 38
  camera.updateProjectionMatrix()

  // cap DPR a bit more aggressively on small devices
  const dprCap = size.min < 420 ? 1.5 : 2
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap))
  renderer.setSize(size.w, size.h, false)

  if (orb) {
    // keep orb from dominating tiny layouts
    const base = THREE.MathUtils.clamp(size.min / 520, 0.72, 1.0)
    orb.scale.setScalar(base)
  }
}

function buildOrb() {
  const group = new THREE.Group()

  const sphereGeo = new THREE.SphereGeometry(1, 128, 128)
  const coreMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#7c3aed'),
    roughness: 0.22,
    metalness: 0.22,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    transmission: 0.28,
    thickness: 0.9,
    emissive: new THREE.Color('#22d3ee'),
    emissiveIntensity: 0.25
  })
  group.add(new THREE.Mesh(sphereGeo, coreMat))

  // glow shells
  const glowGeo = new THREE.SphereGeometry(1.15, 64, 64)
  const glowMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#22d3ee'),
    transparent: true,
    opacity: 0.18,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    depthWrite: false
  })
  group.add(new THREE.Mesh(glowGeo, glowMat))

  const glow2Geo = new THREE.SphereGeometry(1.35, 64, 64)
  const glow2Mat = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#7c3aed'),
    transparent: true,
    opacity: 0.12,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    depthWrite: false
  })
  group.add(new THREE.Mesh(glow2Geo, glow2Mat))

  // rings
  const ringGeo = new THREE.TorusGeometry(1.35, 0.02, 16, 160)
  const ringMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#e2e8ff'),
    emissive: new THREE.Color('#7c3aed'),
    emissiveIntensity: 0.5,
    roughness: 0.35,
    metalness: 0.65
  })

  const ring1 = new THREE.Mesh(ringGeo, ringMat)
  ring1.rotation.x = Math.PI * 0.35
  group.add(ring1)

  const ring2 = new THREE.Mesh(ringGeo, ringMat.clone())
  ring2.rotation.y = Math.PI * 0.55
  ;(ring2.material as THREE.MeshStandardMaterial).emissive = new THREE.Color('#22d3ee')
  group.add(ring2)

  return group
}

function animate() {
  if (!renderer || !scene || !camera || !orb) return

  // smooth follow
  orb.rotation.x += (targetRotX - orb.rotation.x) * 0.08
  orb.rotation.y += (targetRotY - orb.rotation.y) * 0.08

  if (!reducedMotion && !isDown) {
    targetRotY += 0.0022

    // subtle breathing but scaled by container size to avoid “too big” on tiny screens
    const t = performance.now() * 0.001
    const breathe = 1 + Math.sin(t * 1.2) * 0.015
    const base = THREE.MathUtils.clamp(size.min / 520, 0.72, 1.0)
    orb.scale.setScalar(base * breathe)
  }

  renderer.render(scene, camera)
  raf = requestAnimationFrame(animate)
}

onMounted(() => {
  if (!wrap.value) return

  readReducedMotion()

  scene = new THREE.Scene()
  scene.fog = new THREE.Fog(new THREE.Color('#05060a'), 6, 18)

  camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60)
  camera.position.set(0, 0.2, 6.2)

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  })
  renderer.setClearColor(0x000000, 0)

  // make canvas “layout-safe”
  renderer.domElement.style.position = 'absolute'
  renderer.domElement.style.inset = '0'
  renderer.domElement.style.width = '100%'
  renderer.domElement.style.height = '100%'
  renderer.domElement.style.display = 'block'

  wrap.value.appendChild(renderer.domElement)

  // lights
  scene.add(new THREE.AmbientLight(new THREE.Color('#c7d2fe'), 0.55))

  const key = new THREE.PointLight(new THREE.Color('#7c3aed'), 1.3, 50)
  key.position.set(3, 2.5, 6)
  scene.add(key)

  const fill = new THREE.PointLight(new THREE.Color('#22d3ee'), 1.0, 50)
  fill.position.set(-3, -1.5, 5)
  scene.add(fill)

  const rim = new THREE.DirectionalLight(new THREE.Color('#e2e8ff'), 0.6)
  rim.position.set(-2, 4, 2)
  scene.add(rim)

  orb = buildOrb()
  orb.position.set(0.2, 0, 0)
  scene.add(orb)

  targetRotY = 0.6
  targetRotX = -0.15
  orb.rotation.set(targetRotX, targetRotY, 0)

  // interactions
  wrap.value.addEventListener('pointerdown', onDown, { passive: true })
  wrap.value.addEventListener('pointermove', onMove, { passive: true })
  wrap.value.addEventListener('pointerup', onUp, { passive: true })
  wrap.value.addEventListener('pointerleave', onUp, { passive: true })
  wrap.value.addEventListener('pointercancel', onUp, { passive: true })

  // ResizeObserver handles: viewport resize, layout shifts, parent size changes
  ro = new ResizeObserver((entries) => {
    const cr = entries[0]?.contentRect
    if (!cr) return
    resizeTo(cr.width, cr.height)
  })
  ro.observe(wrap.value)

  // initial
  const w = wrap.value.clientWidth
  const h = wrap.value.clientHeight
  resizeTo(w, h)

  animate()
})

onBeforeUnmount(() => cleanup())
</script>

<template>
  <div
    ref="wrap"
    class="orbWrap relative w-full overflow-hidden"
    aria-label="Interactive 3D orb"
  >
    <!-- Fallback visual (visible behind transparent WebGL) -->
    <div class="orbFallback absolute inset-0" aria-hidden="true" />
  </div>
</template>

<style scoped>
/* KEY FIX: stop fixed heights from breaking short devices */
.orbWrap {
  touch-action: none;
  height: clamp(220px, 52vw, 520px);
  max-height: 70vh; /* prevents overflow on short screens */
}

/* super short screens (landscape phones) */
@media (max-height: 560px) {
  .orbWrap {
    height: min(46vh, 340px);
    max-height: 46vh;
  }
}

.heroGlow{
  background:
    radial-gradient(circle at 30% 30%, rgba(124,58,237,.6), transparent 55%),
    radial-gradient(circle at 70% 40%, rgba(34,211,238,.5), transparent 55%);
}
</style>
