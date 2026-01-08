<script setup lang="ts">
import { PLACEHOLDER_IMG } from '~/constants/media'

const stats = [
  { k: '60fps feel', v: 'Micro-interactions' },
  { k: 'Web → VR', v: 'Cross-platform builds' },
  { k: 'Embeddable', v: 'Game portal system' }
]
</script>

<template>
  <section class="relative overflow-hidden">
    <GlowBackdrop />

    <!-- Animated gradient wash -->
    <div class="wash" aria-hidden="true" />

    <!-- Particles -->
    <div class="particles" aria-hidden="true">
      <span v-for="i in 18" :key="i" class="p" :style="{ '--i': i }" />
    </div>

    <UContainer class="py-16 md:py-24">
      <!-- mobile: orb on top, then text | md+: 2-column layout (text left, orb right) -->
      <div class="flex flex-col gap-10 md:grid md:grid-cols-2 md:items-center">
        <!-- ORB: top on mobile, right on md+ -->
        <div class="relative order-1 md:order-2 min-w-0" data-reveal>
          <ClientOnly>
            <HeroOrb />
          </ClientOnly>

          <!-- Glow edge -->
          <div class="heroGlow absolute -inset-6 -z-10 blur-2xl opacity-30" aria-hidden="true" />
        </div>

        <!-- TEXT: below orb on mobile, left on md+ -->
        <div class="max-w-xl order-2 md:order-1 min-w-0" data-reveal>
          <h1 class="text-4xl md:text-6xl font-semibold tracking-tight">
            We build games & immersive realities.
          </h1>
          <p class="mt-4 text-lg md:text-xl opacity-80">
            From web to VR — interactive experiences that feel alive.
          </p>

          <div class="mt-8 flex flex-wrap gap-3">
            <UButton class="press" color="primary" to="/contact">Start a Project</UButton>
            <UButton class="press" variant="outline" to="/work">View Work</UButton>
            <UButton class="press" variant="ghost" to="/arcade">Play Games</UButton>
          </div>

          <div class="mt-10 grid gap-3 sm:grid-cols-3">
            <UCard
              v-for="s in stats"
              :key="s.k"
              class="bg-white/5 border-white/10 press"
            >
              <div class="text-sm opacity-70">{{ s.v }}</div>
              <div class="mt-1 font-semibold">{{ s.k }}</div>
            </UCard>
          </div>
        </div>
      </div>
    </UContainer>
  </section>
</template>

<style scoped>
.wash {
  position: absolute;
  inset: -40%;
  background:
    radial-gradient(600px 320px at 30% 20%, rgba(124,58,237,.35), transparent 60%),
    radial-gradient(520px 300px at 70% 30%, rgba(34,211,238,.22), transparent 60%),
    radial-gradient(520px 320px at 50% 80%, rgba(34,197,94,.18), transparent 60%);
  animation: drift 10s ease-in-out infinite alternate;
  filter: blur(14px);
  opacity: .55;
  pointer-events: none;
}

@keyframes drift {
  from { transform: translate3d(-1%, -1%, 0) scale(1.02); }
  to   { transform: translate3d( 1%,  1%, 0) scale(1.06); }
}

.particles {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.p {
  position: absolute;
  left: calc((var(--i) * 7%) - 10%);
  top: calc((var(--i) * 5%) - 20%);
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: rgba(231,238,252,.35);
  opacity: .18;
  filter: blur(.4px);
  animation: float 6s ease-in-out infinite;
  animation-delay: calc(var(--i) * -120ms);
}

@keyframes float {
  0%   { transform: translateY(0) translateX(0) scale(1); }
  50%  { transform: translateY(-18px) translateX(10px) scale(1.15); opacity: .28; }
  100% { transform: translateY(0) translateX(0) scale(1); }
}

.heroGlow {
  background:
    radial-gradient(circle at 30% 30%, rgba(124,58,237,.6), transparent 55%),
    radial-gradient(circle at 70% 40%, rgba(34,211,238,.5), transparent 55%);
}
</style>
