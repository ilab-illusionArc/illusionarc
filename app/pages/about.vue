<script setup lang="ts">
useHead({
  title: 'About — illusion Arc',
  meta: [
    {
      name: 'description',
      content:
        'Learn about Illusion Arc — our story, the way we build, and the tools & pipeline behind our interactive work.'
    }
  ]
})

const stats = [
  { label: 'Focus', value: 'Games + XR' },
  { label: 'Delivery', value: 'Fast prototypes' },
  { label: 'Quality', value: 'Polished feel' },
  { label: 'Platforms', value: 'Mobile • Web • VR' }
]

const principles = [
  {
    title: 'Beauty-first, performance-always',
    desc: 'Premium visuals with real-world constraints — smooth, fast, and responsive.'
  },
  {
    title: 'Prototype → polish pipeline',
    desc: 'We validate ideas quickly, then scale into production-ready experiences.'
  },
  {
    title: 'Systems thinking',
    desc: 'Reusable architecture, clean UI patterns, and scalable content structure.'
  }
]

// Dummy team (as spec suggests)
const team = [
  { name: 'Game Developer', role: 'Unity • Systems • Gameplay', note: 'Design-to-build execution.' },
  { name: 'XR Specialist', role: 'AR/VR • Training Sims', note: 'Immersive interaction design.' },
  { name: 'VFX Artist', role: 'CGI • Motion • Compositing', note: 'Cinematic polish & reels.' },
  { name: 'Designer', role: 'UI/UX • Brand • Motion', note: 'Neon-glass UI, micro-interactions.' }
]

const tools = [
  { title: 'Engines', items: ['Unity', 'Unreal (select projects)', 'WebGL pipelines'] },
  { title: '3D & Content', items: ['Blender', 'Substance (optional)', 'Optimized asset workflow'] },
  { title: 'Web & UI', items: ['Nuxt 4', 'Nuxt UI', 'GSAP (select pages)'] },
  { title: 'Delivery', items: ['Vercel', 'Performance budgets', 'Security headers mindset'] }
]
</script>

<template>
  <UContainer class="py-10 md:py-14">
    <!-- HERO -->
    <div class="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 md:p-10">
      <div class="pointer-events-none absolute inset-0 opacity-60">
        <div class="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
        <div class="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-fuchsia-500/10 blur-3xl" />
      </div>

      <div class="relative">
        <h1 class="text-3xl md:text-5xl font-semibold tracking-tight">About illusion Arc</h1>
        <p class="mt-3 max-w-2xl text-sm md:text-base opacity-80 leading-relaxed">
          We’re a creative tech studio building games, interactive web experiences, and AR/VR simulations —
          with a premium look, fast feel, and scalable architecture.
        </p>

        <div class="mt-5 flex flex-wrap gap-2">
          <span
            v-for="s in stats"
            :key="s.label"
            class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs"
          >
            <span class="opacity-70">{{ s.label }}:</span>
            <span class="font-semibold">{{ s.value }}</span>
          </span>
        </div>
      </div>
    </div>

    <!-- STORY + PRINCIPLES -->
    <div class="mt-8 grid gap-6 md:grid-cols-3">
      <UCard class="md:col-span-2 bg-white/5 border-white/10">
        <template #header>
          <div class="text-lg font-semibold">Our story</div>
        </template>

        <div class="space-y-4 text-sm opacity-85 leading-relaxed">
          <p>
            illusion Arc exists to make interactive experiences feel alive — from neon-fast mobile games to
            immersive XR training simulations. We care about the “feel”: responsiveness, feedback, and polish.
          </p>
          <p>
            We work in a tight loop: prototype quickly, validate the core fun, then refine into a production-ready build
            with optimized assets, clean UI, and strong performance.
          </p>
          <p class="opacity-75">
            If you want something that looks premium and still loads fast, we’re built for that.
          </p>
        </div>
      </UCard>

      <UCard class="bg-white/5 border-white/10">
        <template #header>
          <div class="text-lg font-semibold">Principles</div>
        </template>

        <div class="space-y-4">
          <div
            v-for="p in principles"
            :key="p.title"
            class="rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:bg-black/30"
          >
            <div class="font-semibold">{{ p.title }}</div>
            <div class="mt-1 text-sm opacity-75 leading-relaxed">{{ p.desc }}</div>
          </div>
        </div>
      </UCard>
    </div>

    <!-- TOOLS & PIPELINE -->
    <UCard class="mt-6 bg-white/5 border-white/10">
      <template #header>
        <div class="text-lg font-semibold">Tools & pipeline</div>
      </template>

      <div class="grid gap-4 md:grid-cols-2">
        <div
          v-for="t in tools"
          :key="t.title"
          class="rounded-2xl border border-white/10 bg-black/20 p-5 transition hover:bg-black/30"
        >
          <div class="font-semibold">{{ t.title }}</div>
          <ul class="mt-3 space-y-2 text-sm opacity-80">
            <li v-for="it in t.items" :key="it">• {{ it }}</li>
          </ul>
        </div>
      </div>
    </UCard>

    <!-- TEAM (DUMMY) -->
    <UCard class="mt-6 bg-white/5 border-white/10">
      <template #header>
        <div class="text-lg font-semibold">Team</div>
      </template>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div
          v-for="m in team"
          :key="m.name"
          class="group rounded-2xl border border-white/10 bg-black/20 p-5 transition hover:bg-black/30"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="font-semibold">{{ m.name }}</div>
              <div class="text-xs opacity-70 mt-1">{{ m.role }}</div>
            </div>
            <div class="h-10 w-10 rounded-xl border border-white/10 bg-white/5 grid place-items-center">
              <UIcon name="i-heroicons-sparkles" class="w-5 h-5 opacity-80" />
            </div>
          </div>
          <div class="mt-4 text-sm opacity-75 leading-relaxed">
            {{ m.note }}
          </div>
        </div>
      </div>
    </UCard>

    <div class="mt-8 flex flex-wrap gap-2">
      <UButton to="/work" color="primary" variant="solid">View Work</UButton>
      <UButton to="/contact" variant="soft">Contact</UButton>
    </div>
  </UContainer>
</template>
