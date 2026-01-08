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

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

function cleanup() {
  cancelAnimationFrame(raf)
  raf = 0

  window.removeEventListener('resize', onResize)
  if (wrap.value) {
    wrap.value.removeEventListener('pointerdown', onDown)
    wrap.value.removeEventListener('pointermove', onMove)
    wrap.value.removeEventListener('pointerup', onUp)
    wrap.value.removeEventListener('pointerleave', onUp)
  }

  if (scene) {
    scene.traverse((obj: any) => {
      if (obj.geometry) obj.geometry.dispose?.()
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose?.())
        else obj.material.dispose?.()
      }
      if (obj.texture) obj.texture.dispose?.()
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

  // drag sensitivity
  targetRotY += dx * 0.006
  targetRotX += dy * 0.006
  // clamp vertical rotation a bit so it doesn't flip
  targetRotX = Math.max(-0.9, Math.min(0.9, targetRotX))
}

function onUp() {
  isDown = false
}

function onResize() {
  if (!wrap.value || !renderer || !camera) return
  const { clientWidth: w, clientHeight: h } = wrap.value
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h, false)
}

function buildOrb() {
  const group = new THREE.Group()

  // Core sphere
  const sphereGeo = new THREE.SphereGeometry(1, 128, 128)

  const coreMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#7c3aed'), // violet core
    roughness: 0.25,
    metalness: 0.2,
    clearcoat: 1,
    clearcoatRoughness: 0.15,
    transmission: 0.25, // subtle glassy feel
    thickness: 0.8,
    emissive: new THREE.Color('#22d3ee'), // cyan glow tint
    emissiveIntensity: 0.25
  })

  const core = new THREE.Mesh(sphereGeo, coreMat)
  group.add(core)

  // Soft outer glow shell (bigger sphere, additive, back-side)
  const glowGeo = new THREE.SphereGeometry(1.15, 64, 64)
  const glowMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#22d3ee'),
    transparent: true,
    opacity: 0.18,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    depthWrite: false
  })
  const glow = new THREE.Mesh(glowGeo, glowMat)
  group.add(glow)

  // A second glow layer for richness
  const glow2Geo = new THREE.SphereGeometry(1.35, 64, 64)
  const glow2Mat = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#7c3aed'),
    transparent: true,
    opacity: 0.12,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    depthWrite: false
  })
  const glow2 = new THREE.Mesh(glow2Geo, glow2Mat)
  group.add(glow2)

  // Thin ring(s) around the orb (gives it "tech magic" vibe)
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

  // smooth follow to target rotation
  orb.rotation.x += (targetRotX - orb.rotation.x) * 0.08
  orb.rotation.y += (targetRotY - orb.rotation.y) * 0.08

  // idle motion (disable if reduced motion)
  if (!prefersReducedMotion() && !isDown) {
    targetRotY += 0.0022
    // subtle breathing scale
    const t = performance.now() * 0.001
    const s = 1 + Math.sin(t * 1.2) * 0.015
    orb.scale.setScalar(s)
  }

  renderer.render(scene, camera)
  raf = requestAnimationFrame(animate)
}

onMounted(() => {
  if (!wrap.value) return

  // If WebGL fails, keep a nice fallback background (CSS in template)
  const w = wrap.value.clientWidth
  const h = wrap.value.clientHeight

  scene = new THREE.Scene()
  scene.fog = new THREE.Fog(new THREE.Color('#05060a'), 6, 18)

  camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 60)
  camera.position.set(0, 0.2, 6.2)

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setSize(w, h, false)
  renderer.setClearColor(0x000000, 0) // transparent
  wrap.value.appendChild(renderer.domElement)

  // Lights (balanced for glow)
  const ambient = new THREE.AmbientLight(new THREE.Color('#c7d2fe'), 0.55)
  scene.add(ambient)

  const key = new THREE.PointLight(new THREE.Color('#7c3aed'), 1.3, 50)
  key.position.set(3, 2.5, 6)
  scene.add(key)

  const fill = new THREE.PointLight(new THREE.Color('#22d3ee'), 1.0, 50)
  fill.position.set(-3, -1.5, 5)
  scene.add(fill)

  const rim = new THREE.DirectionalLight(new THREE.Color('#e2e8ff'), 0.6)
  rim.position.set(-2, 4, 2)
  scene.add(rim)

  // Orb
  orb = buildOrb()
  orb.position.set(0.2, 0, 0)
  scene.add(orb)

  // Start slightly angled (looks nicer than perfectly front-on)
  targetRotY = 0.6
  targetRotX = -0.15
  orb.rotation.set(targetRotX, targetRotY, 0)

  // Interactions
  wrap.value.addEventListener('pointerdown', onDown, { passive: true })
  wrap.value.addEventListener('pointermove', onMove, { passive: true })
  wrap.value.addEventListener('pointerup', onUp, { passive: true })
  wrap.value.addEventListener('pointerleave', onUp, { passive: true })

  window.addEventListener('resize', onResize, { passive: true })

  animate()
})

onBeforeUnmount(() => cleanup())
</script>

<template>
  <div
    ref="wrap"
    class="orbWrap relative h-[320px] md:h-[520px] w-full overflow-hidden"
    aria-label="Interactive 3D orb"
  >
    <!-- Fallback visual (visible behind transparent WebGL) -->
    <div class="orbFallback absolute inset-0" aria-hidden="true" />

    <!-- Soft edge glow like your old heroGlow -->
    <div class="heroGlow absolute -inset-6 -z-10 blur-2xl opacity-30" aria-hidden="true" />
  </div>
</template>

<style scoped>
.orbWrap{
  touch-action: none; /* important for mobile drag */
}

</style>
