<script setup lang="ts">
useHead({ title: 'Service' })

const route = useRoute()
const supabase = useSupabaseClient()

type FaqItem = { q: string; a: string }

type ServiceRow = {
  id: number
  slug: string
  title: string
  value_prop: string
  timeline: string | null
  is_active: boolean
  deliverables: string[] | null
  faq: FaqItem[] | null
}

const slug = computed(() => String(route.params.slug || '').trim())

const loading = ref(true)
const notFound = ref(false)
const errorMsg = ref<string | null>(null)
const service = ref<ServiceRow | null>(null)

function safeTitle(s?: string) {
  return s?.trim() ? s.trim() : 'Service'
}

async function load() {
  loading.value = true
  notFound.value = false
  errorMsg.value = null
  service.value = null

  try {
    if (!slug.value) {
      notFound.value = true
      return
    }

    const { data, error } = await supabase
      .from('services')
      .select('id, slug, title, value_prop, timeline, is_active, deliverables, faq')
      .eq('slug', slug.value)
      .maybeSingle()

    if (error) throw error
    if (!data) {
      notFound.value = true
      return
    }

    // Public: hide non-active services
    if (!data.is_active) {
      notFound.value = true
      return
    }

    service.value = data as any

    useHead({
      title: `${safeTitle(data.title)} · Services`,
      meta: [
        { name: 'description', content: String(data.value_prop || '').slice(0, 160) }
      ]
    })
  } catch (e: any) {
    errorMsg.value = e?.message || 'Failed to load service.'
  } finally {
    loading.value = false
  }
}

watch(slug, load, { immediate: true })

function goBack() {
  navigateTo('/services')
}
</script>

<template>
  <section class="relative overflow-hidden">
    <!-- background wash -->
    <div
      class="absolute inset-0 opacity-90"
      style="
        background:
          radial-gradient(900px 600px at 15% 20%, rgba(124,58,237,.16), transparent 60%),
          radial-gradient(900px 600px at 85% 30%, rgba(34,211,238,.12), transparent 60%),
          radial-gradient(900px 700px at 55% 90%, rgba(34,197,94,.10), transparent 60%),
          linear-gradient(to bottom, rgba(255,255,255,.06), transparent 35%, rgba(255,255,255,.03));
      "
      aria-hidden="true"
    />

    <UContainer class="relative py-10 md:py-14">
      <!-- Top bar -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition backdrop-blur"
          @click="goBack"
        >
          <UIcon name="i-heroicons-arrow-left" class="h-4 w-4" />
          Back to Services
        </button>

        <NuxtLink
          to="/contact"
          class="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm font-semibold hover:opacity-90 transition"
        >
          <UIcon name="i-heroicons-paper-airplane" class="h-4 w-4" />
          Start a project
        </NuxtLink>
      </div>

      <!-- Loading skeleton -->
      <div
        v-if="loading"
        class="mt-6 rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-5 md:p-7 backdrop-blur"
      >
        <div class="h-7 w-2/3 rounded-xl bg-black/10 dark:bg-white/10 animate-pulse" />
        <div class="mt-3 h-4 w-full rounded-xl bg-black/10 dark:bg-white/10 animate-pulse" />
        <div class="mt-2 h-4 w-5/6 rounded-xl bg-black/10 dark:bg-white/10 animate-pulse" />

        <div class="mt-6 grid gap-3 md:grid-cols-2">
          <div class="h-24 rounded-2xl bg-black/10 dark:bg-white/10 animate-pulse" />
          <div class="h-24 rounded-2xl bg-black/10 dark:bg-white/10 animate-pulse" />
        </div>
      </div>

      <!-- Error -->
      <div
        v-else-if="errorMsg"
        class="mt-6 rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-5 backdrop-blur"
      >
        <div class="text-sm text-black dark:text-white">❌ {{ errorMsg }}</div>
        <div class="mt-3">
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-4 py-2.5 text-sm hover:bg-black/10 dark:hover:bg-white/10 transition"
            @click="load"
          >
            <UIcon name="i-heroicons-arrow-path" class="h-5 w-5 opacity-80" />
            Retry
          </button>
        </div>
      </div>

      <!-- Not found -->
      <div
        v-else-if="notFound || !service"
        class="mt-6 rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-6 backdrop-blur"
      >
        <div class="text-xl font-semibold text-black dark:text-white">Service not found</div>
        <p class="mt-2 text-sm text-black/70 dark:text-white/70">
          This service may be unavailable or hidden.
        </p>
        <div class="mt-4">
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-4 py-2.5 text-sm hover:bg-black/10 dark:hover:bg-white/10 transition"
            @click="goBack"
          >
            <UIcon name="i-heroicons-arrow-left" class="h-5 w-5 opacity-80" />
            Back
          </button>
        </div>
      </div>

      <!-- Content -->
      <div v-else class="mt-6 grid gap-5 lg:grid-cols-[1.2fr_.8fr] items-start">
        <!-- Main -->
        <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-5 md:p-7 backdrop-blur">
          <div class="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-1.5 text-xs text-black/60 dark:text-white/60">
            <UIcon name="i-heroicons-sparkles" class="h-4 w-4" />
            Service Details
          </div>

          <h1 class="mt-3 text-3xl md:text-4xl font-extrabold tracking-tight text-black dark:text-white">
            {{ service.title }}
          </h1>

          <p class="mt-3 text-sm md:text-base text-black/70 dark:text-white/70 leading-relaxed">
            {{ service.value_prop }}
          </p>

          <!-- Deliverables -->
          <div class="mt-6">
            <div class="text-sm font-semibold text-black dark:text-white">Deliverables</div>

            <div v-if="(service.deliverables || []).length" class="mt-3 flex flex-wrap gap-2">
              <span
                v-for="d in (service.deliverables || [])"
                :key="d"
                class="inline-flex items-center rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-1.5 text-xs text-black/70 dark:text-white/70"
              >
                {{ d }}
              </span>
            </div>

            <div v-else class="mt-2 text-sm text-black/60 dark:text-white/60">
              No deliverables listed yet.
            </div>
          </div>

          <!-- FAQ -->
          <div class="mt-7">
            <div class="text-sm font-semibold text-black dark:text-white">FAQ</div>

            <div v-if="(service.faq || []).length" class="mt-3 grid gap-2">
              <div
                v-for="(f, i) in (service.faq || [])"
                :key="i"
                class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-4"
              >
                <div class="font-semibold text-black dark:text-white text-sm">
                  {{ f.q }}
                </div>
                <div class="mt-1 text-sm text-black/70 dark:text-white/70">
                  {{ f.a }}
                </div>
              </div>
            </div>

            <div v-else class="mt-2 text-sm text-black/60 dark:text-white/60">
              No FAQ added yet.
            </div>
          </div>
        </div>

        <!-- Side card -->
        <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-5 backdrop-blur">
          <div class="text-sm font-semibold text-black dark:text-white">
            Quick Info
          </div>

          <div class="mt-3 grid gap-3">
            <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-4">
              <div class="text-xs text-black/60 dark:text-white/60">Timeline</div>
              <div class="mt-1 text-sm font-semibold text-black dark:text-white">
                {{ service.timeline || '—' }}
              </div>
            </div>

            <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-4">
              <div class="text-xs text-black/60 dark:text-white/60">Slug</div>
              <div class="mt-1 text-sm font-mono text-black dark:text-white">
                {{ service.slug }}
              </div>
            </div>
          </div>

          <div class="mt-4 grid gap-2">
            <NuxtLink
              to="/contact"
              class="inline-flex items-center justify-center gap-2 rounded-2xl bg-black text-white dark:bg-white dark:text-black px-4 py-3 text-sm font-semibold hover:opacity-90 transition"
            >
              <UIcon name="i-heroicons-paper-airplane" class="h-5 w-5" />
              Contact about this
            </NuxtLink>

            <NuxtLink
              to="/services"
              class="inline-flex items-center justify-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-4 py-3 text-sm hover:bg-black/10 dark:hover:bg-white/10 transition"
            >
              <UIcon name="i-heroicons-squares-2x2" class="h-5 w-5 opacity-80" />
              Browse all services
            </NuxtLink>
          </div>
        </div>
      </div>
    </UContainer>
  </section>
</template>
