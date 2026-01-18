<!-- app/pages/admin/services.vue -->
<script setup lang="ts">
import { useSortable } from '@vueuse/integrations/useSortable'

definePageMeta({
  layout: 'admin',
  middleware: ['admin']
})

useHead({ title: 'Admin — Services' })

const supabase = useSupabaseClient()
const toast = useToast()

/* ---------------- Types ---------------- */
type FaqItem = { q: string; a: string }

type ServiceRow = {
  id: string // uuid
  slug: string
  title: string
  value_prop: string
  timeline: string | null
  is_active: boolean
  deliverables: string[] | null
  process_steps: string[] | null
  faq: FaqItem[] | null
  sort_order: number
  created_at?: string
  updated_at?: string
}

type ServiceUpsert = {
  slug: string
  title: string
  value_prop: string
  timeline: string | null
  is_active: boolean
  deliverables: string[]
  process_steps: string[]
  faq: FaqItem[]
  sort_order: number
  updated_at: string
}

/* ---------------- State ---------------- */
const loading = ref(true)
const saving = ref(false)

const services = ref<ServiceRow[]>([])

const showForm = ref(false)
const isEditing = ref(false)

const showDelete = ref(false)
const deleting = ref(false)
const deleteTarget = ref<ServiceRow | null>(null)

const form = reactive<ServiceRow>({
  id: '',
  slug: '',
  title: '',
  value_prop: '',
  timeline: null,
  is_active: true,
  deliverables: [],
  process_steps: [],
  faq: [],
  sort_order: 100
})

/* Drag state */
const tbodyEl = ref<HTMLElement | null>(null)
const isReordering = ref(false)

/* Tabs (Right side) */
type TabKey = 'deliverables' | 'steps' | 'faq'
const activeTab = ref<TabKey>('deliverables')

/* ---------------- Helpers ---------------- */
function safeArr(v: any): string[] {
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean)
  return []
}

function safeFaq(v: any): FaqItem[] {
  if (!Array.isArray(v)) return []
  return v
    .map((x) => ({
      q: String(x?.q || '').trim(),
      a: String(x?.a || '').trim()
    }))
    .filter((x) => x.q || x.a)
}

function baseSlugFromTitle(title: string) {
  return String(title || '')
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function arrayMove<T>(arr: T[], from: number, to: number) {
  const next = arr.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/** Generate DB-unique slug like "game-development-2" */
async function generateUniqueSlug(title: string, excludeId?: string): Promise<string> {
  const base = baseSlugFromTitle(title)
  if (!base) throw new Error('Title is required.')

  const { data, error } = await supabase.from('services').select('id, slug').ilike('slug', `${base}%`)
  if (error) throw error

  const existing = (data || []).filter((r: any) => (excludeId ? r.id !== excludeId : true))
  if (!existing.some((r: any) => r.slug === base)) return base

  let max = 1
  for (const r of existing) {
    const m = String(r.slug).match(new RegExp(`^${base}-(\\d+)$`))
    if (m) {
      const n = Number(m[1])
      if (Number.isFinite(n) && n >= max) max = n + 1
    }
  }
  return `${base}-${max}`
}

/* ---------------- Load ---------------- */
async function loadServices() {
  loading.value = true

  const { data, error } = await supabase
    .from('services')
    .select(
      'id, slug, title, value_prop, timeline, is_active, deliverables, process_steps, faq, sort_order, created_at, updated_at'
    )
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    toast.add({ title: 'Failed to load services', description: error.message, color: 'error' })
    services.value = []
  } else {
    const list = (data || []) as any[]
    services.value = list.map((r) => ({
      id: String(r.id),
      slug: String(r.slug || ''),
      title: String(r.title || ''),
      value_prop: String(r.value_prop || ''),
      timeline: r.timeline ? String(r.timeline) : null,
      is_active: !!r.is_active,
      deliverables: safeArr(r.deliverables),
      process_steps: safeArr(r.process_steps),
      faq: safeFaq(r.faq),
      sort_order: Number(r.sort_order ?? 100),
      created_at: r.created_at,
      updated_at: r.updated_at
    }))
  }

  loading.value = false
}

/* ---------------- Persist order via server API ---------------- */
async function persistOrder() {
  const ids = services.value.map((s) => s.id)

  // IMPORTANT: this endpoint must do the DB update (cookie-auth or service role)
  await $fetch('/api/admin/services/reorder', {
    method: 'POST',
    body: { ids }
  })
}

/* ---------------- Drag setup (FIXED: sync Vue array) ---------------- */
function setupDrag() {
  if (!tbodyEl.value) return

  useSortable(tbodyEl, services, {
    animation: 150,
    handle: '.drag-handle',
    ghostClass: 'sortable-ghost',
    chosenClass: 'sortable-chosen',

    // table stability
    forceFallback: true,
    fallbackOnBody: true,

    onStart() {
      isReordering.value = true
    },

    async onEnd(evt: any) {
      try {
        const oldIndex = evt?.oldIndex
        const newIndex = evt?.newIndex

        if (typeof oldIndex !== 'number' || typeof newIndex !== 'number' || oldIndex === newIndex) {
          return
        }

        // ✅ Key fix: update Vue state so it doesn't snap back
        services.value = arrayMove(services.value, oldIndex, newIndex)

        // persist new order
        await persistOrder()

        // reload from DB (ensures what you see matches DB)
        await loadServices()

        toast.add({ title: 'Order saved', description: 'Service order updated.', color: 'success' })
      } catch (e: any) {
        toast.add({
          title: 'Reorder failed',
          description: e?.message || 'Could not save order.',
          color: 'error'
        })
        await loadServices()
      } finally {
        isReordering.value = false
      }
    }
  })
}

onMounted(async () => {
  await loadServices()
  setupDrag()
})

/* ---------------- Create ---------------- */
function openCreate() {
  isEditing.value = false
  showForm.value = true
  activeTab.value = 'deliverables'

  const maxOrder = Math.max(0, ...services.value.map((s) => Number(s.sort_order || 0)))

  Object.assign(form, {
    id: '',
    slug: '',
    title: '',
    value_prop: '',
    timeline: null,
    is_active: true,
    deliverables: [],
    process_steps: ['Discovery', 'Prototype', 'Production', 'Launch'],
    faq: [],
    sort_order: maxOrder + 10
  })
}

/* ---------------- Edit ---------------- */
function openEdit(s: ServiceRow) {
  isEditing.value = true
  showForm.value = true
  activeTab.value = 'deliverables'

  Object.assign(form, {
    id: s.id,
    slug: s.slug,
    title: s.title,
    value_prop: s.value_prop,
    timeline: s.timeline,
    is_active: s.is_active,
    deliverables: safeArr(s.deliverables),
    process_steps: safeArr(s.process_steps),
    faq: safeFaq(s.faq),
    sort_order: Number(s.sort_order ?? 100)
  })
}

/* ---------------- Delete modal ---------------- */
function openDelete(s: ServiceRow) {
  deleteTarget.value = s
  showDelete.value = true
}
function closeDelete() {
  showDelete.value = false
  deleteTarget.value = null
}

/* ---------------- Editors ---------------- */
const newDeliverable = ref('')
function addDeliverable() {
  const v = newDeliverable.value.trim()
  if (!v) return
  const list = safeArr(form.deliverables)
  list.push(v)
  form.deliverables = list
  newDeliverable.value = ''
}
function removeDeliverable(i: number) {
  const list = safeArr(form.deliverables)
  list.splice(i, 1)
  form.deliverables = list
}

const newStep = ref('')
function addStep() {
  const v = newStep.value.trim()
  if (!v) return
  const list = safeArr(form.process_steps)
  list.push(v)
  form.process_steps = list
  newStep.value = ''
}
function removeStep(i: number) {
  const list = safeArr(form.process_steps)
  list.splice(i, 1)
  form.process_steps = list
}

function addFaq() {
  const list = safeFaq(form.faq)
  list.push({ q: '', a: '' })
  form.faq = list
}
function removeFaq(i: number) {
  const list = safeFaq(form.faq)
  list.splice(i, 1)
  form.faq = list
}

/* ---------------- Save ---------------- */
async function saveService() {
  const title = String(form.title || '').trim()
  const valueProp = String(form.value_prop || '').trim()

  if (!title) {
    toast.add({ title: 'Title required', description: 'Please enter a service title.', color: 'warning' })
    return
  }
  if (!valueProp) {
    toast.add({
      title: 'Value proposition required',
      description: 'Please write a short value prop.',
      color: 'warning'
    })
    return
  }

  const base = baseSlugFromTitle(title)
  if (!base) {
    toast.add({
      title: 'Invalid title',
      description: 'Title must contain letters/numbers to generate a slug.',
      color: 'warning'
    })
    return
  }

  saving.value = true
  try {
    const slug = await generateUniqueSlug(title, isEditing.value ? form.id : undefined)
    if (!slug || !slug.trim()) throw new Error('Slug generation failed.')

    const payload: ServiceUpsert = {
      slug,
      title,
      value_prop: valueProp,
      timeline: form.timeline ? String(form.timeline).trim() || null : null,
      is_active: !!form.is_active,
      deliverables: safeArr(form.deliverables),
      process_steps: safeArr(form.process_steps),
      faq: safeFaq(form.faq),
      sort_order: Number(form.sort_order ?? 100),
      updated_at: new Date().toISOString()
    }

    let error: any = null

    if (isEditing.value) {
      ;({ error } = await supabase.from('services').update(payload as any).eq('id', form.id).select())
    } else {
      ;({ error } = await supabase.from('services').insert(payload as any).select())
    }

    if (error) throw error

    toast.add({ title: 'Saved', description: `Slug: ${slug}`, color: 'success' })
    showForm.value = false
    await loadServices()
  } catch (e: any) {
    toast.add({ title: 'Save failed', description: e?.message || 'Unable to save service.', color: 'error' })
  } finally {
    saving.value = false
  }
}

/* ---------------- Confirm Delete ---------------- */
async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    const { error } = await supabase.from('services').delete().eq('id', deleteTarget.value.id)
    if (error) throw error
    toast.add({ title: 'Deleted', description: 'Service removed.', color: 'success' })
    closeDelete()
    await loadServices()
  } catch (e: any) {
    toast.add({ title: 'Delete failed', description: e?.message || 'Unable to delete.', color: 'error' })
  } finally {
    deleting.value = false
  }
}

/* ---------------- Preview ---------------- */
const previewSlug = computed(() => baseSlugFromTitle(form.title || ''))
const previewPath = computed(() => (previewSlug.value ? `/services/${previewSlug.value}` : '/services/...'))

/* Tab badges */
const deliverablesCount = computed(() => safeArr(form.deliverables).length)
const stepsCount = computed(() => safeArr(form.process_steps).length)
const faqCount = computed(() => safeFaq(form.faq).length)

function setTab(t: TabKey) {
  activeTab.value = t
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold text-black dark:text-white">Services</h1>
        <p class="mt-1 text-sm text-black/60 dark:text-white/60">
          Manage your public Services page content (CRUD). Drag rows to reorder.
        </p>
      </div>

      <button
        type="button"
        class="btn px-4 py-2.5 rounded-2xl border border-black/10 dark:border-white/10 bg-black text-white dark:bg-white dark:text-black hover:opacity-90 transition"
        @click="openCreate"
      >
        + New Service
      </button>
    </div>

    <!-- Table -->
    <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur overflow-hidden">
      <div v-if="loading" class="p-4 text-sm text-black/60 dark:text-white/60">
        Loading services…
      </div>

      <div v-else class="overflow-auto">
        <table class="w-full text-sm">
          <thead class="text-left text-black/60 dark:text-white/60">
            <tr class="border-b border-black/10 dark:border-white/10">
              <th class="px-4 py-3 w-12"></th>
              <th class="px-4 py-3">Title</th>
              <th class="px-4 py-3 hidden md:table-cell">Timeline</th>
              <th class="px-4 py-3 hidden lg:table-cell">Slug</th>
              <th class="px-4 py-3">Status</th>
              <th class="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>

          <tbody ref="tbodyEl">
            <tr
              v-for="s in services"
              :key="s.id"
              :data-id="s.id"
              class="border-b border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5 transition"
            >
              <td class="px-4 py-3">
                <button
                  type="button"
                  class="drag-handle inline-flex items-center justify-center w-9 h-9 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition"
                  title="Drag to reorder"
                  :disabled="isReordering"
                >
                  ⠿
                </button>
              </td>

              <td class="px-4 py-3">
                <div class="font-semibold text-black dark:text-white">{{ s.title }}</div>
                <div class="text-xs text-black/60 dark:text-white/60 mt-1 line-clamp-2">
                  {{ s.value_prop }}
                </div>
              </td>

              <td class="px-4 py-3 hidden md:table-cell text-black/70 dark:text-white/70">
                {{ s.timeline || '—' }}
              </td>

              <td class="px-4 py-3 hidden lg:table-cell">
                <span class="font-mono text-xs text-black/60 dark:text-white/60">
                  {{ s.slug }}
                </span>
              </td>

              <td class="px-4 py-3">
                <span
                  class="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs"
                  :class="s.is_active
                    ? 'border-green-500/25 bg-green-500/10 text-green-700 dark:text-green-300'
                    : 'border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300'"
                >
                  <span class="h-2 w-2 rounded-full" :class="s.is_active ? 'bg-green-500' : 'bg-red-500'" />
                  {{ s.is_active ? 'Active' : 'Hidden' }}
                </span>
              </td>

              <td class="px-4 py-3 text-right whitespace-nowrap">
                <button
                  type="button"
                  class="btn px-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition"
                  @click="openEdit(s)"
                >
                  Edit
                </button>

                <button
                  type="button"
                  class="btn px-3 py-2 rounded-xl border border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300 hover:bg-red-500/15 transition ml-2"
                  @click="openDelete(s)"
                >
                  Delete
                </button>
              </td>
            </tr>

            <tr v-if="services.length === 0">
              <td colspan="6" class="px-4 py-10 text-center text-black/60 dark:text-white/60">
                No services found.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ===== Create/Edit Modal (Tabbed Right Side) ===== -->
    <div v-if="showForm" class="modalOverlay" @keydown.esc.prevent="showForm = false" tabindex="0">
      <div class="modalShell" role="dialog" aria-modal="true">
        <!-- Header -->
        <div class="modalHeader">
          <div class="min-w-0">
            <div class="text-lg font-semibold text-black dark:text-white">
              {{ isEditing ? 'Edit Service' : 'Create Service' }}
            </div>
            <div class="mt-1 text-xs text-black/60 dark:text-white/60">
              Preview: <span class="font-mono">{{ previewPath }}</span>
            </div>
          </div>

          <button type="button" class="modalClose" @click="showForm = false" aria-label="Close modal">
            ✕
          </button>
        </div>

        <!-- Body (scrollable) -->
        <div class="modalBody">
          <!-- Top row -->
          <div class="modalTopRow">
            <span
              class="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs"
              :class="form.is_active
                ? 'border-green-500/25 bg-green-500/10 text-green-700 dark:text-green-300'
                : 'border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300'"
            >
              <span class="h-2 w-2 rounded-full" :class="form.is_active ? 'bg-green-500' : 'bg-red-500'" />
              {{ form.is_active ? 'Active' : 'Hidden' }}
            </span>

            <label class="inline-flex items-center gap-2 text-xs text-black/70 dark:text-white/70">
              <input type="checkbox" v-model="form.is_active" class="checkbox" />
              Show on site
            </label>
          </div>

          <div class="modalGrid">
            <!-- Left: Main -->
            <div class="space-y-4">
              <div class="grid gap-2">
                <label class="text-xs font-semibold text-black/70 dark:text-white/70">Title</label>
                <input v-model="form.title" class="input" placeholder="e.g. Game Development" />
              </div>

              <div class="grid gap-2">
                <label class="text-xs font-semibold text-black/70 dark:text-white/70">Slug (auto)</label>
                <input :value="previewSlug || ''" class="input readOnly" readonly tabindex="-1" />
                <div class="text-[11px] text-black/60 dark:text-white/60">
                  Will save as: <span class="font-mono">{{ previewSlug || '...' }}</span> (auto adds -2/-3 if needed)
                </div>
              </div>

              <div class="grid gap-2">
                <label class="text-xs font-semibold text-black/70 dark:text-white/70">Value proposition</label>
                <textarea v-model="form.value_prop" class="input" rows="4" placeholder="Short description shown on Services list" />
              </div>

              <div class="grid gap-2">
                <label class="text-xs font-semibold text-black/70 dark:text-white/70">Timeline (optional)</label>
                <input v-model="form.timeline" class="input" placeholder="e.g. 2–8 weeks" />
              </div>

              <div class="grid gap-2">
                <label class="text-xs font-semibold text-black/70 dark:text-white/70">Sort order</label>
                <input v-model.number="form.sort_order" type="number" class="input" placeholder="e.g. 10, 20, 30" />
                <div class="text-[11px] text-black/60 dark:text-white/60">
                  Dragging in table updates order automatically.
                </div>
              </div>
            </div>

            <!-- Right: Tabs -->
            <div class="tabWrap">
              <div class="tabBar">
                <button type="button" class="tabBtn" :class="{ active: activeTab === 'deliverables' }" @click="setTab('deliverables')">
                  Deliverables <span class="tabPill">{{ deliverablesCount }}</span>
                </button>

                <button type="button" class="tabBtn" :class="{ active: activeTab === 'steps' }" @click="setTab('steps')">
                  Steps <span class="tabPill">{{ stepsCount }}</span>
                </button>

                <button type="button" class="tabBtn" :class="{ active: activeTab === 'faq' }" @click="setTab('faq')">
                  FAQ <span class="tabPill">{{ faqCount }}</span>
                </button>
              </div>

              <div class="tabPanel">
                <!-- Deliverables -->
                <div v-if="activeTab === 'deliverables'" class="space-y-4">
                  <div class="panel">
                    <div class="panelHead">
                      <div class="font-semibold text-black dark:text-white">Deliverables</div>
                      <div class="text-xs text-black/60 dark:text-white/60">Add key outputs you’ll deliver.</div>
                    </div>

                    <div class="panelBody space-y-2">
                      <div class="flex gap-2">
                        <input v-model="newDeliverable" class="input flex-1" placeholder="Add deliverable (Enter)" @keydown.enter.prevent="addDeliverable" />
                        <button type="button" class="btnSmall" @click="addDeliverable">Add</button>
                      </div>

                      <div class="flex flex-wrap gap-2">
                        <span v-for="(d, i) in (form.deliverables || [])" :key="d + i" class="chip">
                          {{ d }}
                          <button type="button" class="chipX" @click="removeDeliverable(i)">×</button>
                        </span>

                        <div v-if="(form.deliverables || []).length === 0" class="text-xs text-black/50 dark:text-white/50">
                          No deliverables yet.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Steps -->
                <div v-else-if="activeTab === 'steps'" class="space-y-4">
                  <div class="panel">
                    <div class="panelHead">
                      <div class="font-semibold text-black dark:text-white">Process steps</div>
                      <div class="text-xs text-black/60 dark:text-white/60">Your workflow stages shown publicly.</div>
                    </div>

                    <div class="panelBody space-y-2">
                      <div class="flex gap-2">
                        <input v-model="newStep" class="input flex-1" placeholder="Add step (Enter)" @keydown.enter.prevent="addStep" />
                        <button type="button" class="btnSmall" @click="addStep">Add</button>
                      </div>

                      <div class="flex flex-wrap gap-2">
                        <span v-for="(st, i) in (form.process_steps || [])" :key="st + i" class="chip soft">
                          {{ st }}
                          <button type="button" class="chipX" @click="removeStep(i)">×</button>
                        </span>

                        <div v-if="(form.process_steps || []).length === 0" class="text-xs text-black/50 dark:text-white/50">
                          No steps yet.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- FAQ -->
                <div v-else class="space-y-4">
                  <div class="panel">
                    <div class="panelHead">
                      <div class="font-semibold text-black dark:text-white">FAQ</div>
                      <div class="text-xs text-black/60 dark:text-white/60">Short Q/A for the service detail page.</div>
                    </div>

                    <div class="panelBody space-y-3">
                      <button type="button" class="btnSmall w-full" @click="addFaq">+ Add FAQ</button>

                      <div v-if="(form.faq || []).length === 0" class="text-xs text-black/50 dark:text-white/50">
                        No FAQ items.
                      </div>

                      <div
                        v-for="(f, i) in (form.faq || [])"
                        :key="i"
                        class="rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-3"
                      >
                        <div class="flex items-center justify-between gap-2 mb-2">
                          <div class="text-xs font-semibold text-black/70 dark:text-white/70">FAQ {{ i + 1 }}</div>
                          <button type="button" class="btnDangerMini" @click="removeFaq(i)">Remove</button>
                        </div>

                        <div class="grid gap-2">
                          <input v-model="f.q" class="input" placeholder="Question" />
                          <textarea v-model="f.a" class="input" rows="2" placeholder="Answer" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <!-- /FAQ -->
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="modalFooter">
          <button type="button" class="btn px-4 py-2.5 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition" @click="showForm = false">
            Cancel
          </button>

          <button type="button" class="btn px-4 py-2.5 rounded-2xl bg-black text-white dark:bg-white dark:text-black hover:opacity-90 transition" :disabled="saving" @click="saveService">
            <span v-if="!saving">{{ isEditing ? 'Save changes' : 'Create service' }}</span>
            <span v-else>Saving…</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ===== Custom Delete Modal ===== -->
    <div v-if="showDelete" class="fixed inset-0 z-[9999] grid place-items-center bg-black/55 p-4">
      <div class="w-full max-w-md rounded-3xl border border-red-500/20 bg-white dark:bg-[#0b0f1a] shadow-[0_40px_120px_rgba(0,0,0,.35)] overflow-hidden">
        <div class="p-5 border-b border-black/10 dark:border-white/10 bg-red-500/5">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="text-lg font-semibold text-black dark:text-white">Delete service?</div>
              <div class="text-xs text-black/60 dark:text-white/60 mt-1">This action cannot be undone.</div>
            </div>
            <button class="btn px-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5" @click="closeDelete">
              ✕
            </button>
          </div>
        </div>

        <div class="p-5">
          <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-3">
            <div class="text-sm font-semibold text-black dark:text-white">{{ deleteTarget?.title }}</div>
            <div class="mt-1 text-xs text-black/60 dark:text-white/60 font-mono">{{ deleteTarget?.slug }}</div>
          </div>
        </div>

        <div class="p-5 border-t border-black/10 dark:border-white/10 flex justify-end gap-2">
          <button class="btn px-4 py-2.5 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5" @click="closeDelete">
            Cancel
          </button>
          <button
            class="btn px-4 py-2.5 rounded-2xl border border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300 hover:bg-red-500/15 transition"
            :disabled="deleting"
            @click="confirmDelete"
          >
            <span v-if="!deleting">Delete</span>
            <span v-else>Deleting…</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
/* Inputs */
.input{
  width:100%;
  padding:10px 12px;
  border-radius:14px;
  border:1px solid rgba(0,0,0,.12);
  background: rgba(255,255,255,.65);
  color: rgba(0,0,0,.9);
  outline:none;
}
.dark .input{
  border-color: rgba(255,255,255,.14);
  background: rgba(255,255,255,.06);
  color: rgba(255,255,255,.92);
}
.input::placeholder{ color: rgba(0,0,0,.45); }
.dark .input::placeholder{ color: rgba(255,255,255,.45); }

.readOnly{ opacity:.75; cursor:not-allowed; }

/* Checkbox */
.checkbox{ width:18px;height:18px;border-radius:6px;border:1px solid rgba(0,0,0,.2); }
.dark .checkbox{ border-color: rgba(255,255,255,.2); }

/* Drag */
.drag-handle{ cursor: grab; }
.drag-handle:active{ cursor: grabbing; }
.sortable-ghost{ opacity: .55; }
.sortable-chosen{ transform: scale(1.01); }

/* Small buttons */
.btnSmall{
  padding:10px 12px;
  border-radius:14px;
  border:1px solid rgba(0,0,0,.12);
  background: rgba(0,0,0,.05);
  color: rgba(0,0,0,.85);
  transition: .15s;
}
.dark .btnSmall{
  border-color: rgba(255,255,255,.14);
  background: rgba(255,255,255,.06);
  color: rgba(255,255,255,.9);
}
.btnSmall:hover{ transform: translateY(-1px); }

.btnDangerMini{
  padding:6px 10px;
  border-radius:12px;
  border:1px solid rgba(239,68,68,.25);
  background: rgba(239,68,68,.10);
  color: rgba(185,28,28,.95);
  font-size: 12px;
}
.dark .btnDangerMini{ color: rgba(252,165,165,.95); }

/* Panels */
.panel{
  border-radius: 22px;
  border: 1px solid rgba(0,0,0,.10);
  background: rgba(255,255,255,.65);
  overflow:hidden;
}
.dark .panel{
  border-color: rgba(255,255,255,.12);
  background: rgba(255,255,255,.05);
}
.panelHead{
  padding: 12px 14px;
  border-bottom: 1px solid rgba(0,0,0,.08);
  background: rgba(0,0,0,.03);
}
.dark .panelHead{
  border-bottom-color: rgba(255,255,255,.10);
  background: rgba(255,255,255,.04);
}
.panelBody{ padding: 12px 14px; }

/* Chips */
.chip{
  display:inline-flex;
  align-items:center;
  gap:8px;
  padding: 6px 10px;
  border-radius:999px;
  border:1px solid rgba(0,0,0,.12);
  background: rgba(0,0,0,.04);
  font-size: 12px;
  color: rgba(0,0,0,.85);
}
.dark .chip{
  border-color: rgba(255,255,255,.14);
  background: rgba(255,255,255,.06);
  color: rgba(255,255,255,.9);
}
.chip.soft{ background: rgba(124,58,237,.08); border-color: rgba(124,58,237,.18); }
.dark .chip.soft{ background: rgba(124,58,237,.12); border-color: rgba(124,58,237,.24); }

.chipX{
  width:20px;height:20px;
  border-radius:999px;
  border:1px solid rgba(0,0,0,.14);
  background: rgba(0,0,0,.06);
  line-height: 18px;
}
.dark .chipX{
  border-color: rgba(255,255,255,.18);
  background: rgba(255,255,255,.08);
  color: rgba(255,255,255,.9);
}

/* ===== Modal (scrollable) ===== */
.modalOverlay{
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: grid;
  place-items: center;
  background: rgba(0,0,0,.55);
  padding: 16px;
}

.modalShell{
  width: 100%;
  max-width: 980px;
  max-height: calc(100vh - 32px);
  display: flex;
  flex-direction: column;
  border-radius: 28px;
  overflow: hidden;
  border: 1px solid rgba(0,0,0,.10);
  background: rgba(255,255,255,.92);
  box-shadow: 0 40px 120px rgba(0,0,0,.35);
}
.dark .modalShell{
  border-color: rgba(255,255,255,.12);
  background: rgba(11,15,26,.92);
}

.modalHeader{
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid rgba(0,0,0,.10);
  background: rgba(255,255,255,.86);
  backdrop-filter: blur(10px);
}
.dark .modalHeader{
  border-bottom-color: rgba(255,255,255,.10);
  background: rgba(11,15,26,.75);
}

.modalClose{
  width: 40px;
  height: 40px;
  border-radius: 14px;
  border: 1px solid rgba(0,0,0,.12);
  background: rgba(0,0,0,.05);
  transition: .15s;
}
.dark .modalClose{
  border-color: rgba(255,255,255,.14);
  background: rgba(255,255,255,.06);
  color: rgba(255,255,255,.92);
}
.modalClose:hover{ transform: translateY(-1px); }

.modalBody{
  padding: 16px;
  overflow: auto;
  flex: 1;
}

.modalFooter{
  position: sticky;
  bottom: 0;
  z-index: 2;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 16px;
  border-top: 1px solid rgba(0,0,0,.10);
  background: rgba(255,255,255,.86);
  backdrop-filter: blur(10px);
}
.dark .modalFooter{
  border-top-color: rgba(255,255,255,.10);
  background: rgba(11,15,26,.75);
}

.modalTopRow{
  display:flex;
  align-items:center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.modalGrid{
  display: grid;
  gap: 18px;
}
@media (min-width: 1024px){
  .modalGrid{
    grid-template-columns: 1fr 1fr;
    align-items: start;
  }
}

/* ===== Tabs ===== */
.tabWrap{
  border-radius: 22px;
  border: 1px solid rgba(0,0,0,.10);
  background: rgba(255,255,255,.65);
  overflow: hidden;
}
.dark .tabWrap{
  border-color: rgba(255,255,255,.12);
  background: rgba(255,255,255,.05);
}

.tabBar{
  display: flex;
  gap: 8px;
  padding: 10px;
  border-bottom: 1px solid rgba(0,0,0,.08);
  background: rgba(0,0,0,.03);
}
.dark .tabBar{
  border-bottom-color: rgba(255,255,255,.10);
  background: rgba(255,255,255,.04);
}

.tabBtn{
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 10px;
  border-radius: 14px;
  border: 1px solid rgba(0,0,0,.10);
  background: rgba(255,255,255,.7);
  color: rgba(0,0,0,.75);
  font-size: 12px;
  font-weight: 600;
  transition: .15s;
}
.dark .tabBtn{
  border-color: rgba(255,255,255,.12);
  background: rgba(255,255,255,.06);
  color: rgba(255,255,255,.75);
}
.tabBtn:hover{ transform: translateY(-1px); }
.tabBtn.active{
  border-color: rgba(124,58,237,.35);
  background: rgba(124,58,237,.12);
  color: rgba(0,0,0,.9);
}
.dark .tabBtn.active{
  color: rgba(255,255,255,.92);
  background: rgba(124,58,237,.18);
  border-color: rgba(124,58,237,.40);
}

.tabPill{
  min-width: 22px;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(0,0,0,.12);
  background: rgba(0,0,0,.05);
  color: rgba(0,0,0,.75);
  font-size: 11px;
}
.dark .tabPill{
  border-color: rgba(255,255,255,.14);
  background: rgba(255,255,255,.08);
  color: rgba(255,255,255,.75);
}

.tabPanel{
  padding: 12px;
}
</style>
