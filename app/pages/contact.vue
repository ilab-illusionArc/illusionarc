<script setup lang="ts">
useHead({
  title: 'Contact — Illusion Arc',
  meta: [
    {
      name: 'description',
      content: 'Contact Illusion Arc for game development, AR/VR, VFX, animation, and interactive web projects.'
    }
  ]
})

type FormState = {
  name: string
  email: string
  projectType: 'Game Development' | 'AR/VR' | 'VFX/CGI' | 'Animation' | 'Interactive Web' | 'Other'
  budget: 'Under $500' | '$500–$2k' | '$2k–$5k' | '$5k–$10k' | '$10k+'
  message: string
  website: string // honeypot (should stay empty)
}

const toast = useToast()
const loading = ref(false)

const state = reactive<FormState>({
  name: '',
  email: '',
  projectType: 'Game Development',
  budget: '$500–$2k',
  message: '',
  website: ''
})

const projectTypeOptions = [
  'Game Development',
  'AR/VR',
  'VFX/CGI',
  'Animation',
  'Interactive Web',
  'Other'
] as const

const budgetOptions = ['Under $500', '$500–$2k', '$2k–$5k', '$5k–$10k', '$10k+'] as const

function isEmailValid(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

function validate(): string | null {
  if (!state.name.trim()) return 'Please enter your name.'
  if (!state.email.trim() || !isEmailValid(state.email)) return 'Please enter a valid email.'
  if (!state.message.trim() || state.message.trim().length < 10) return 'Please write a short project message (10+ chars).'
  return null
}

async function submit() {
  const err = validate()
  if (err) {
    toast.add({ title: 'Check the form', description: err, color: 'warning' })
    return
  }

  loading.value = true
  try {
    await $fetch('/api/contact', {
      method: 'POST',
      body: {
        name: state.name,
        email: state.email,
        projectType: state.projectType,
        budget: state.budget,
        message: state.message,
        website: state.website
      }
    })

    toast.add({
      title: 'Sent!',
      description: 'We received your message. We’ll reply soon.',
      color: 'success'
    })

    state.name = ''
    state.email = ''
    state.projectType = 'Game Development'
    state.budget = '$500–$2k'
    state.message = ''
    state.website = ''
  } catch (e: any) {
    toast.add({
      title: 'Failed to send',
      description: e?.data?.message || e?.message || 'Please try again in a moment.',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UContainer class="py-10 md:py-14">
    <!-- HERO -->
    <div class="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 md:p-10">
      <div class="pointer-events-none absolute inset-0 opacity-60">
        <div class="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
        <div class="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-fuchsia-500/10 blur-3xl" />
      </div>

      <div class="relative">
        <h1 class="text-3xl md:text-5xl font-semibold tracking-tight">Contact</h1>
        <p class="mt-3 max-w-2xl text-sm md:text-base opacity-80 leading-relaxed">
          Tell us what you want to build — game, XR, VFX, animation, or interactive web.
          We’ll respond with next steps and a clear plan.
        </p>

        <!-- Quick contact buttons -->
        <div class="mt-5 flex flex-wrap gap-2">
          <UButton variant="soft" icon="i-heroicons-envelope" to="mailto:hello@illusionarc.com">
            Email
          </UButton>

          <!-- Replace with your WhatsApp number -->
          <UButton
            variant="soft"
            icon="i-heroicons-chat-bubble-left-right"
            to="https://wa.me/8801XXXXXXXXX"
            target="_blank"
          >
            WhatsApp
          </UButton>

          <UButton variant="ghost" icon="i-heroicons-briefcase" to="/work">
            View Work
          </UButton>
        </div>
      </div>
    </div>

    <div class="mt-8 grid gap-6 lg:grid-cols-3">
      <!-- FORM -->
      <UCard class="lg:col-span-2 bg-white/5 border-white/10">
        <template #header>
          <div class="text-lg font-semibold">Project inquiry</div>
        </template>

        <div class="grid gap-4 md:grid-cols-2">
          <UFormGroup label="Name" required>
            <UInput v-model="state.name" placeholder="Your name" />
          </UFormGroup>

          <UFormGroup label="Email" required>
            <UInput v-model="state.email" placeholder="you@email.com" />
          </UFormGroup>

          <UFormGroup label="Project type" required>
            <USelect v-model="state.projectType" :options="projectTypeOptions" />
          </UFormGroup>

          <UFormGroup label="Budget range" required>
            <USelect v-model="state.budget" :options="budgetOptions" />
          </UFormGroup>

          <div class="md:col-span-2">
            <UFormGroup label="Message" required>
              <UTextarea
                v-model="state.message"
                :rows="6"
                placeholder="What are you building? Target platform? Timeline? Any references?"
              />
            </UFormGroup>
          </div>

          <!-- honeypot (hidden) -->
          <input v-model="state.website" class="hidden" tabindex="-1" autocomplete="off" />
        </div>

        <div class="mt-5 flex items-center justify-between gap-3">
          <div class="text-xs opacity-70">
            We’ll never share your details. (Add a privacy page later if needed.)
          </div>

          <UButton color="primary" variant="solid" :loading="loading">
            Send message
          </UButton>
        </div>
      </UCard>

      <!-- OPTIONAL INFO PANEL -->
      <UCard class="bg-white/5 border-white/10">
        <template #header>
          <div class="text-lg font-semibold">Details</div>
        </template>

        <div class="space-y-4 text-sm opacity-80 leading-relaxed">
          <div class="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div class="font-semibold opacity-100">Typical response</div>
            <div class="mt-1 opacity-75">Within 24–48 hours</div>
          </div>

          <div class="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div class="font-semibold opacity-100">What helps</div>
            <ul class="mt-2 space-y-1 opacity-75">
              <li>• Platform (Mobile/Web/VR)</li>
              <li>• Reference links</li>
              <li>• Deadline + scope</li>
            </ul>
          </div>

          <!-- Map placeholder (optional) -->
          <div class="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div class="font-semibold opacity-100">Map (optional)</div>
            <div class="mt-2 text-xs opacity-70">
              Add a map embed here later (Google Maps / OpenStreetMap).
            </div>
          </div>
        </div>
      </UCard>
    </div>
  </UContainer>
</template>
