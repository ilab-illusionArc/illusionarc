<!-- app/pages/admin/works.vue -->
<script setup lang="ts">
import { useSortable } from '@vueuse/integrations/useSortable'

definePageMeta({
  layout: 'admin',
  middleware: ['admin']
})

useHead({ title: 'Admin — Works' })

const supabase = useSupabaseClient()
const toast = useToast()

/* ---------------- Constants ---------------- */
const CATEGORIES = ['games', 'ar-vr', 'vfx', 'animation', 'interactive-web'] as const
type WorkCategory = (typeof CATEGORIES)[number]

/* ---------------- Types ---------------- */
type WorkMedia = {
  id: string
  kind: 'hero' | 'gallery'
  path: string
  alt: string | null
  sort_order: number
}

type WorkRow = {
  id: string
  title: string
  slug: string
  category: WorkCategory

  short_description: string | null
  year: number | null
  role: string | null

  tools: string[]
  tags: string[]
  highlights: string[]

  outcome: string | null
  cta: string | null

  is_active: boolean
  sort_order: number

  created_at?: string
  updated_at?: string

  work_media?: WorkMedia[] | null
}

/* ---------------- State ---------------- */
const loading = ref(true)
const saving = ref(false)
const uploadingHero = ref(false)
const uploadingGallery = ref(false)
const refreshingMedia = ref(false)

const works = ref<WorkRow[]>([])

const showForm = ref(false)
const isEditing = ref(false)

const showDelete = ref(false)
const deleting = ref(false)
const deleteTarget = ref<WorkRow | null>(null)

/** Success modal (after create only) */
const showCreated = ref(false)
const createdSummary = reactive<{ title: string; slug: string; category: string }>({
  title: '',
  slug: '',
  category: ''
})

const form = reactive<WorkRow>({
  id: '',
  title: '',
  slug: '',
  category: 'games',
  short_description: null,
  year: null,
  role: null,
  tools: [],
  tags: [],
  highlights: [],
  outcome: null,
  cta: null,
  is_active: true,
  sort_order: 100,
  work_media: []
})

/* Drag state (works list) */
const tbodyEl = ref<HTMLElement | null>(null)
const isReordering = ref(false)
const sortableReady = ref(false)

/* Modal Tabs */
type TabKey = 'details' | 'media'
const activeTab = ref<TabKey>('details')

/* ------------- Option A: Draft temp uploads (hidden in UI) ------------- */
const draftId = ref<string>('') // unique per modal open
const tmpPrefix = computed(() => (draftId.value ? `_tmp/${draftId.value}` : '_tmp'))

type PendingMedia = { kind: 'hero' | 'gallery'; path: string }
const pending = reactive<{ hero: PendingMedia | null; gallery: PendingMedia[] }>({
  hero: null,
  gallery: []
})

/* ---------------- Helpers ---------------- */
function safeArr(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean)
  if (typeof v === 'string') return v.split(',').map((s) => s.trim()).filter(Boolean)
  return []
}
function safeText(v: unknown): string | null {
  const s = String(v ?? '').trim()
  return s ? s : null
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

function getPublicUrl(path: string) {
  if (!path) return ''
  const { data } = supabase.storage.from('works').getPublicUrl(path)
  return data?.publicUrl || ''
}
function extFromFile(file: File) {
  const name = file.name || ''
  const dot = name.lastIndexOf('.')
  const raw = dot >= 0 ? name.slice(dot + 1) : ''
  const ext = raw.toLowerCase().replace(/[^a-z0-9]/g, '')
  return ext || 'png'
}
function pad3(n: number) {
  return String(n).padStart(3, '0')
}
function nextTmpGalleryIndex() {
  let max = 0
  for (const p of pending.gallery) {
    const m = p.path.match(/gallery-(\d{3})\./)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return max + 1
}

function autoAlt(kind: 'hero' | 'gallery', index?: number) {
  const title = String(form.title || '').trim()
  const nice = title || 'Work'
  if (kind === 'hero') return `${nice} hero`
  const i = typeof index === 'number' ? index : 1
  return `${nice} screenshot ${String(i).padStart(2, '0')}`
}

const previewSlug = computed(() => baseSlugFromTitle(form.title || ''))
const previewPath = computed(() => (previewSlug.value ? `/work/${previewSlug.value}` : '/work/...'))

function nextSortOrderForNew() {
  const maxOrder = Math.max(0, ...works.value.map((w) => Number(w.sort_order || 0)))
  return maxOrder + 10
}

function isValidCategory(v: string): v is WorkCategory {
  return (CATEGORIES as readonly string[]).includes(v)
}

/* ---------------- Load ---------------- */
async function loadWorks() {
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('works')
      .select(
        `
        id, title, slug, category,
        short_description, year, role,
        tools, tags, highlights,
        outcome, cta,
        is_active, sort_order,
        created_at, updated_at,
        work_media ( id, kind, path, alt, sort_order, created_at )
      `
      )
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) throw error

    const list = (data || []) as any[]
    works.value = list.map((r) => ({
      id: String(r.id),
      title: String(r.title || ''),
      slug: String(r.slug || ''),
      category: (isValidCategory(String(r.category || 'games')) ? (String(r.category) as WorkCategory) : 'games') as WorkCategory,
      short_description: r.short_description ? String(r.short_description) : null,
      year: r.year != null ? Number(r.year) : null,
      role: r.role ? String(r.role) : null,
      tools: safeArr(r.tools),
      tags: safeArr(r.tags),
      highlights: safeArr(r.highlights),
      outcome: r.outcome ? String(r.outcome) : null,
      cta: r.cta ? String(r.cta) : null,
      is_active: !!r.is_active,
      sort_order: Number(r.sort_order ?? 100),
      created_at: r.created_at,
      updated_at: r.updated_at,
      work_media: Array.isArray(r.work_media)
        ? r.work_media.map((m: any) => ({
            id: String(m.id),
            kind: String(m.kind) as any,
            path: String(m.path || ''),
            alt: m.alt ? String(m.alt) : null,
            sort_order: Number(m.sort_order ?? 100)
          }))
        : []
    }))
  } catch (e: any) {
    toast.add({ title: 'Failed to load works', description: e?.message || 'Unknown error', color: 'error' })
    works.value = []
  } finally {
    loading.value = false
  }
}

/* ---------------- Persist order (works list) ---------------- */
async function persistWorksOrder() {
  const updates = works.value.map((w, i) => ({ id: w.id, sort_order: (i + 1) * 10 }))
  const { error } = await supabase.from('works').upsert(updates as any, { onConflict: 'id' })
  if (error) throw error
}

/* ---------------- Drag setup (works list) ---------------- */
function setupDragWorks() {
  if (!tbodyEl.value || sortableReady.value) return

  useSortable(tbodyEl, works, {
    animation: 150,
    handle: '.drag-handle',
    ghostClass: 'sortable-ghost',
    chosenClass: 'sortable-chosen',
    forceFallback: true,
    fallbackOnBody: true,
    onStart() {
      isReordering.value = true
    },
    async onEnd(evt: any) {
      try {
        const oldIndex = evt?.oldIndex
        const newIndex = evt?.newIndex
        if (typeof oldIndex !== 'number' || typeof newIndex !== 'number' || oldIndex === newIndex) return

        works.value = arrayMove(works.value, oldIndex, newIndex)
        await persistWorksOrder()
        await loadWorks()
        toast.add({ title: 'Order saved', description: 'Works order updated.', color: 'success' })
      } catch (e: any) {
        toast.add({ title: 'Reorder failed', description: e?.message || 'Could not save order.', color: 'error' })
        await loadWorks()
      } finally {
        isReordering.value = false
      }
    }
  })

  sortableReady.value = true
}

onMounted(async () => {
  await loadWorks()
  await nextTick()
  setupDragWorks()
})

watch(tbodyEl, async (el) => {
  if (!el) return
  await nextTick()
  setupDragWorks()
})

/* ---------------- Open Create/Edit ---------------- */
function newDraft() {
  draftId.value = globalThis.crypto?.randomUUID?.() || String(Date.now())
  pending.hero = null
  pending.gallery = []
}

function openCreate() {
  isEditing.value = false
  showForm.value = true
  activeTab.value = 'details'
  newDraft()

  Object.assign(form, {
    id: '',
    title: '',
    slug: '',
    category: 'games',
    short_description: null,
    year: null,
    role: null,
    tools: [],
    tags: [],
    highlights: [],
    outcome: null,
    cta: null,
    is_active: true,
    sort_order: nextSortOrderForNew(),
    work_media: []
  })
}

function openEdit(w: WorkRow) {
  isEditing.value = true
  showForm.value = true
  activeTab.value = 'details'
  newDraft()

  Object.assign(form, {
    id: w.id,
    title: w.title,
    slug: w.slug,
    category: (w.category || 'games') as WorkCategory,
    short_description: w.short_description ?? null,
    year: w.year ?? null,
    role: w.role ?? null,
    tools: safeArr(w.tools),
    tags: safeArr(w.tags),
    highlights: safeArr(w.highlights),
    outcome: w.outcome ?? null,
    cta: w.cta ?? null,
    is_active: !!w.is_active,
    sort_order: Number(w.sort_order ?? 100),
    work_media: Array.isArray(w.work_media) ? w.work_media.slice() : []
  })
}

/* ---------------- Close modal safely (cleanup hidden temp) ---------------- */
async function cleanupTmpFolder() {
  if (!draftId.value) return
  try {
    const prefix = tmpPrefix.value
    const { data } = await supabase.storage.from('works').list(prefix, { limit: 200 })
    if (data?.length) {
      const paths = data.map((o: any) => `${prefix}/${o.name}`)
      await supabase.storage.from('works').remove(paths)
    }
  } catch {
    // non-fatal
  }
}

async function closeModal() {
  showForm.value = false
  await cleanupTmpFolder()
}

onBeforeUnmount(async () => {
  if (showForm.value) await cleanupTmpFolder()
})

/* ---------------- Delete work ---------------- */
function openDelete(w: WorkRow) {
  deleteTarget.value = w
  showDelete.value = true
}
function closeDelete() {
  showDelete.value = false
  deleteTarget.value = null
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    const target = deleteTarget.value

    const { error } = await supabase.from('works').delete().eq('id', target.id)
    if (error) throw error

    // Best-effort: delete storage folder <slug>/*
    try {
      const { data: objects } = await supabase.storage.from('works').list(target.slug, { limit: 200 })
      if (objects?.length) {
        const paths = objects.map((o: any) => `${target.slug}/${o.name}`)
        await supabase.storage.from('works').remove(paths)
      }
    } catch {}

    toast.add({ title: 'Deleted', description: 'Work removed.', color: 'success' })
    closeDelete()
    await loadWorks()
  } catch (e: any) {
    toast.add({ title: 'Delete failed', description: e?.message || 'Unable to delete work.', color: 'error' })
  } finally {
    deleting.value = false
  }
}

/* ---------------- Media: auto-upload on choose ---------------- */
const heroInputEl = ref<HTMLInputElement | null>(null)
const galleryInputEl = ref<HTMLInputElement | null>(null)

async function onHeroPickedAuto(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0] ?? null

  if (!file) return
  if (!draftId.value) newDraft()

  uploadingHero.value = true
  const ext = extFromFile(file)
  const path = `${tmpPrefix.value}/hero.${ext}`

  try {
    const { error } = await supabase.storage.from('works').upload(path, file, {
      upsert: true,
      contentType: file.type
    })
    if (error) throw error

    // remove previous pending hero if different path
    if (pending.hero?.path && pending.hero.path !== path) {
      try {
        await supabase.storage.from('works').remove([pending.hero.path])
      } catch {}
    }

    pending.hero = { kind: 'hero', path }

    toast.add({ title: 'Hero uploaded', description: 'Hero image ready.', color: 'success' })
  } catch (err: any) {
    toast.add({ title: 'Upload failed', description: err?.message || 'Could not upload hero.', color: 'error' })
  } finally {
    uploadingHero.value = false
    // reset input so selecting the same file again triggers change
    if (heroInputEl.value) heroInputEl.value.value = ''
  }
}

async function onGalleryPickedAuto(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files || [])
  if (!files.length) return
  if (!draftId.value) newDraft()

  uploadingGallery.value = true
  try {
    let idx = nextTmpGalleryIndex()
    for (const file of files) {
      const ext = extFromFile(file)
      const path = `${tmpPrefix.value}/gallery-${pad3(idx)}.${ext}`
      idx += 1

      const { error } = await supabase.storage.from('works').upload(path, file, {
        upsert: false,
        contentType: file.type
      })
      if (error) throw error

      pending.gallery.push({ kind: 'gallery', path })
    }

    toast.add({ title: 'Gallery uploaded', description: 'Images added.', color: 'success' })
  } catch (err: any) {
    toast.add({ title: 'Upload failed', description: err?.message || 'Could not upload gallery.', color: 'error' })
  } finally {
    uploadingGallery.value = false
    if (galleryInputEl.value) galleryInputEl.value.value = ''
  }
}

async function removePending(p: PendingMedia) {
  try {
    await supabase.storage.from('works').remove([p.path])
  } catch {}
  if (p.kind === 'hero') pending.hero = null
  else pending.gallery = pending.gallery.filter((x) => x.path !== p.path)
}

/* Pending gallery reorder (local only) */
const pendingGalleryEl = ref<HTMLElement | null>(null)
const isReorderPending = ref(false)
const pendingSortableReady = ref(false)

function setupPendingGalleryDrag() {
  if (!pendingGalleryEl.value || pendingSortableReady.value) return
  useSortable(pendingGalleryEl, pending.gallery as any, {
    animation: 150,
    handle: '.drag-handle',
    ghostClass: 'sortable-ghost',
    chosenClass: 'sortable-chosen',
    forceFallback: true,
    fallbackOnBody: true,
    onStart() {
      isReorderPending.value = true
    },
    onEnd(evt: any) {
      const oldIndex = evt?.oldIndex
      const newIndex = evt?.newIndex
      if (typeof oldIndex !== 'number' || typeof newIndex !== 'number' || oldIndex === newIndex) {
        isReorderPending.value = false
        return
      }
      pending.gallery = arrayMove(pending.gallery, oldIndex, newIndex) as any
      isReorderPending.value = false
    }
  })
  pendingSortableReady.value = true
}

/* Saved media helpers */
const heroSaved = computed(() => (form.work_media || []).find((m) => m.kind === 'hero') || null)
const gallerySaved = computed(() =>
  (form.work_media || []).filter((m) => m.kind === 'gallery').slice().sort((a, b) => a.sort_order - b.sort_order)
)

async function refreshFormMedia() {
  if (!form.id) return
  refreshingMedia.value = true
  try {
    const { data, error } = await supabase
      .from('work_media')
      .select('id, kind, path, alt, sort_order, created_at')
      .eq('work_id', form.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (!error) {
      form.work_media = (data || []).map((m: any) => ({
        id: String(m.id),
        kind: String(m.kind) as any,
        path: String(m.path || ''),
        alt: m.alt ? String(m.alt) : null,
        sort_order: Number(m.sort_order ?? 100)
      })) as any
    }
  } finally {
    refreshingMedia.value = false
  }
}

/* Remove saved media (DB + storage best-effort) */
async function removeSavedMedia(m: WorkMedia) {
  if (!form.id || !m?.id) return
  try {
    const { error } = await supabase.from('work_media').delete().eq('id', m.id)
    if (error) throw error
    try {
      if (m.path) await supabase.storage.from('works').remove([m.path])
    } catch {}
    toast.add({ title: 'Removed', description: 'Media deleted.', color: 'success' })
    await refreshFormMedia()
  } catch (e: any) {
    toast.add({ title: 'Remove failed', description: e?.message || 'Could not delete media.', color: 'error' })
  }
}

/* ---------------- Save (finalize media & upsert work) ---------------- */
async function saveWorkFinalize() {
  const title = String(form.title || '').trim()
  const category = String(form.category || '').trim()

  if (!title) {
    toast.add({ title: 'Title required', description: 'Please enter a work title.', color: 'warning' })
    return
  }
  if (!category) {
    toast.add({ title: 'Category required', description: 'Please choose a category.', color: 'warning' })
    return
  }

  const wasCreate = !form.id
  saving.value = true
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token

    // Auto alt generation for server save
    const computedHeroAlt = autoAlt('hero')
    const computedGalleryAlts = pending.gallery.map((_, i) => autoAlt('gallery', i + 1))

    const body = {
      id: form.id || null,
      draftId: draftId.value,

      title,
      category,
      short_description: safeText(form.short_description),
      year: form.year != null ? Number(form.year) : null,
      role: safeText(form.role),
      tools: safeArr(form.tools),
      tags: safeArr(form.tags),
      highlights: safeArr(form.highlights),
      outcome: safeText(form.outcome),
      cta: safeText(form.cta),
      is_active: !!form.is_active,

      // auto (still stored in db); input removed from UI
      sort_order: Number(form.sort_order ?? 100),

      pendingHeroPath: pending.hero?.path || null,
      pendingGalleryPaths: pending.gallery.map((x) => x.path),

      heroAlt: computedHeroAlt,
      galleryAlts: computedGalleryAlts
    }

    const saved = await $fetch('/api/admin/works/save', {
      method: 'POST',
      body,
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })

    const row = saved as any
    form.id = String(row.id)
    form.slug = String(row.slug)

    await loadWorks()

    // Clear pending (server finalizes)
    pending.hero = null
    pending.gallery = []
    pendingSortableReady.value = false

    if (wasCreate) {
      const t = String(row.title || title)
      const s = String(row.slug || form.slug)
      const c = String(row.category || category)

      await closeModal()

      createdSummary.title = t
      createdSummary.slug = s
      createdSummary.category = c
      showCreated.value = true
    } else {
      await refreshFormMedia()
      toast.add({ title: 'Saved', description: 'Changes updated.', color: 'success' })
      newDraft()
    }
  } catch (e: any) {
    toast.add({ title: 'Save failed', description: e?.message || 'Unable to save work.', color: 'error' })
  } finally {
    saving.value = false
  }
}

/* ---------------- Created modal actions ---------------- */
function closeCreated() {
  showCreated.value = false
  createdSummary.title = ''
  createdSummary.slug = ''
  createdSummary.category = ''
}
function createAnother() {
  closeCreated()
  openCreate()
}

/* ---------------- Tag/Tools/Highlights editors ---------------- */
const newTool = ref('')
function addTool() {
  const v = newTool.value.trim()
  if (!v) return
  form.tools = [...safeArr(form.tools), v]
  newTool.value = ''
}
function removeTool(i: number) {
  const list = safeArr(form.tools)
  list.splice(i, 1)
  form.tools = list
}

const newTag = ref('')
function addTag() {
  const v = newTag.value.trim()
  if (!v) return
  form.tags = [...safeArr(form.tags), v]
  newTag.value = ''
}
function removeTag(i: number) {
  const list = safeArr(form.tags)
  list.splice(i, 1)
  form.tags = list
}

const newHighlight = ref('')
function addHighlight() {
  const v = newHighlight.value.trim()
  if (!v) return
  form.highlights = [...safeArr(form.highlights), v]
  newHighlight.value = ''
}
function removeHighlight(i: number) {
  const list = safeArr(form.highlights)
  list.splice(i, 1)
  form.highlights = list
}

/* ---------------- UI helpers ---------------- */
function setTab(t: TabKey) {
  activeTab.value = t
  if (t === 'media') nextTick(() => setupPendingGalleryDrag())
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold text-black dark:text-white">Works</h1>
        <p class="mt-1 text-sm text-black/60 dark:text-white/60">
          Manage portfolio projects (CRUD). Drag rows to reorder.
        </p>
      </div>

      <button
        type="button"
        class="btn px-4 py-2.5 rounded-2xl border border-black/10 dark:border-white/10 bg-black text-white dark:bg-white dark:text-black hover:opacity-90 transition"
        @click="openCreate"
      >
        + New Work
      </button>
    </div>

    <!-- Table -->
    <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur overflow-hidden">
      <div v-if="loading" class="p-6">
        <div class="animate-pulse space-y-3">
          <div class="h-4 w-40 rounded bg-black/10 dark:bg-white/10" />
          <div class="h-3 w-72 rounded bg-black/10 dark:bg-white/10" />
          <div class="h-3 w-full rounded bg-black/10 dark:bg-white/10" />
          <div class="h-3 w-full rounded bg-black/10 dark:bg-white/10" />
          <div class="h-3 w-5/6 rounded bg-black/10 dark:bg-white/10" />
        </div>
      </div>

      <div v-else class="overflow-auto">
        <table class="w-full text-sm">
          <thead class="text-left text-black/60 dark:text-white/60">
            <tr class="border-b border-black/10 dark:border-white/10">
              <th class="px-4 py-3 w-12"></th>
              <th class="px-4 py-3">Title</th>
              <th class="px-4 py-3 hidden md:table-cell">Category</th>
              <th class="px-4 py-3 hidden lg:table-cell">Slug</th>
              <th class="px-4 py-3 hidden md:table-cell">Year</th>
              <th class="px-4 py-3">Status</th>
              <th class="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>

          <tbody ref="tbodyEl">
            <tr
              v-for="w in works"
              :key="w.id"
              :data-id="w.id"
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
                <div class="font-semibold text-black dark:text-white">{{ w.title }}</div>
                <div class="text-xs text-black/60 dark:text-white/60 mt-1 line-clamp-2">
                  {{ w.short_description || '—' }}
                </div>
              </td>

              <td class="px-4 py-3 hidden md:table-cell text-black/70 dark:text-white/70">{{ w.category || '—' }}</td>

              <td class="px-4 py-3 hidden lg:table-cell">
                <span class="font-mono text-xs text-black/60 dark:text-white/60">{{ w.slug }}</span>
              </td>

              <td class="px-4 py-3 hidden md:table-cell text-black/70 dark:text-white/70">{{ w.year ?? '—' }}</td>

              <td class="px-4 py-3">
                <span
                  class="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs"
                  :class="w.is_active
                    ? 'border-green-500/25 bg-green-500/10 text-green-700 dark:text-green-300'
                    : 'border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300'"
                >
                  <span class="h-2 w-2 rounded-full" :class="w.is_active ? 'bg-green-500' : 'bg-red-500'" />
                  {{ w.is_active ? 'Active' : 'Hidden' }}
                </span>
              </td>

              <td class="px-4 py-3 text-right whitespace-nowrap">
                <button
                  type="button"
                  class="btn px-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition"
                  @click="openEdit(w)"
                >
                  Edit
                </button>

                <button
                  type="button"
                  class="btn px-3 py-2 rounded-xl border border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300 hover:bg-red-500/15 transition ml-2"
                  @click="openDelete(w)"
                >
                  Delete
                </button>
              </td>
            </tr>

            <tr v-if="works.length === 0">
              <td colspan="7" class="px-4 py-10 text-center text-black/60 dark:text-white/60">No works found.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ===== Create/Edit Modal ===== -->
    <div v-if="showForm" class="modalOverlay" @keydown.esc.prevent="closeModal" tabindex="0">
      <div class="modalShell" role="dialog" aria-modal="true">
        <div class="modalHeader">
          <div class="min-w-0">
            <div class="text-lg font-semibold text-black dark:text-white">
              {{ isEditing ? 'Edit Work' : 'Create Work' }}
            </div>
            <div class="mt-1 text-xs text-black/60 dark:text-white/60">
              Preview: <span class="font-mono">{{ previewPath }}</span>
            </div>
          </div>

          <button type="button" class="modalClose" @click="closeModal" aria-label="Close modal">✕</button>
        </div>

        <div class="modalBody">
          <!-- Local loading overlay inside modal (save/upload/media refresh) -->
          <div v-if="saving || uploadingHero || uploadingGallery || refreshingMedia" class="loadingOverlay">
            <div class="loadingCard">
              <div class="spinner" />
              <div class="mt-2 text-sm font-semibold text-black dark:text-white">
                <span v-if="saving">Saving…</span>
                <span v-else-if="uploadingHero">Uploading hero…</span>
                <span v-else-if="uploadingGallery">Uploading gallery…</span>
                <span v-else>Refreshing…</span>
              </div>
              <div class="mt-1 text-xs text-black/60 dark:text-white/60">Please don’t close the modal.</div>
            </div>
          </div>

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

          <div class="tabWrap">
            <div class="tabBar">
              <button type="button" class="tabBtn" :class="{ active: activeTab === 'details' }" @click="setTab('details')">
                Details
              </button>
              <button type="button" class="tabBtn" :class="{ active: activeTab === 'media' }" @click="setTab('media')">
                Media
              </button>
            </div>

            <div class="tabPanel">
              <!-- DETAILS TAB -->
              <div v-if="activeTab === 'details'" class="space-y-4">
                <div class="grid gap-2">
                  <label class="text-xs font-semibold text-black/70 dark:text-white/70">Title</label>
                  <input v-model="form.title" class="input" placeholder="e.g. Boss Rush" />
                </div>

                <div class="grid gap-2">
                  <label class="text-xs font-semibold text-black/70 dark:text-white/70">Slug (estimated)</label>
                  <input :value="previewSlug || ''" class="input readOnly" readonly tabindex="-1" />
                  <div class="text-[11px] text-black/60 dark:text-white/60">
                    Final slug is generated on Save (auto adds <span class="font-mono">-2/-3</span> if needed).
                    <span v-if="form.slug" class="ml-2">
                      Current: <span class="font-mono">{{ form.slug }}</span>
                    </span>
                  </div>
                </div>

                <div class="grid gap-2">
                  <label class="text-xs font-semibold text-black/70 dark:text-white/70">Category</label>
                  <select v-model="form.category" class="input">
                    <option v-for="c in CATEGORIES" :key="c" :value="c">{{ c }}</option>
                  </select>
                </div>

                <div class="grid gap-2 md:grid-cols-2">
                  <div class="grid gap-2">
                    <label class="text-xs font-semibold text-black/70 dark:text-white/70">Year</label>
                    <input v-model.number="form.year" type="number" class="input" placeholder="2025" />
                  </div>

                  <div class="grid gap-2">
                    <label class="text-xs font-semibold text-black/70 dark:text-white/70">Role (optional)</label>
                    <input v-model="form.role" class="input" placeholder="e.g. Game Design + Unity Dev" />
                  </div>
                </div>

                <div class="grid gap-2">
                  <label class="text-xs font-semibold text-black/70 dark:text-white/70">Short description</label>
                  <textarea v-model="form.short_description" class="input" rows="3" placeholder="1–2 lines shown on Work list" />
                </div>

                <div class="grid gap-2">
                  <label class="text-xs font-semibold text-black/70 dark:text-white/70">Outcome (optional)</label>
                  <textarea v-model="form.outcome" class="input" rows="2" placeholder="Result summary" />
                </div>

                <div class="grid gap-2">
                  <label class="text-xs font-semibold text-black/70 dark:text-white/70">CTA (optional)</label>
                  <textarea v-model="form.cta" class="input" rows="2" placeholder="Call to action line" />
                </div>

                <!-- Tools -->
                <div class="panel">
                  <div class="panelHead">
                    <div class="font-semibold text-black dark:text-white">Tools</div>
                  </div>
                  <div class="panelBody space-y-2">
                    <div class="flex gap-2">
                      <input v-model="newTool" class="input flex-1" placeholder="Add tool (Enter)" @keydown.enter.prevent="addTool" />
                      <button type="button" class="btnSmall" @click="addTool">Add</button>
                    </div>
                    <div class="flex flex-wrap gap-2">
                      <span v-for="(t, i) in form.tools || []" :key="t + i" class="chip">
                        {{ t }}
                        <button type="button" class="chipX" @click="removeTool(i)">×</button>
                      </span>
                      <div v-if="(form.tools || []).length === 0" class="text-xs text-black/50 dark:text-white/50">
                        No tools yet.
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Tags -->
                <div class="panel">
                  <div class="panelHead">
                    <div class="font-semibold text-black dark:text-white">Tags</div>
                  </div>
                  <div class="panelBody space-y-2">
                    <div class="flex gap-2">
                      <input v-model="newTag" class="input flex-1" placeholder="Add tag (Enter)" @keydown.enter.prevent="addTag" />
                      <button type="button" class="btnSmall" @click="addTag">Add</button>
                    </div>
                    <div class="flex flex-wrap gap-2">
                      <span v-for="(t, i) in form.tags || []" :key="t + i" class="chip soft">
                        {{ t }}
                        <button type="button" class="chipX" @click="removeTag(i)">×</button>
                      </span>
                      <div v-if="(form.tags || []).length === 0" class="text-xs text-black/50 dark:text-white/50">
                        No tags yet.
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Highlights -->
                <div class="panel">
                  <div class="panelHead">
                    <div class="font-semibold text-black dark:text-white">Highlights</div>
                  </div>
                  <div class="panelBody space-y-2">
                    <div class="flex gap-2">
                      <input
                        v-model="newHighlight"
                        class="input flex-1"
                        placeholder="Add highlight (Enter)"
                        @keydown.enter.prevent="addHighlight"
                      />
                      <button type="button" class="btnSmall" @click="addHighlight">Add</button>
                    </div>
                    <div class="flex flex-wrap gap-2">
                      <span v-for="(h, i) in form.highlights || []" :key="h + i" class="chip">
                        {{ h }}
                        <button type="button" class="chipX" @click="removeHighlight(i)">×</button>
                      </span>
                      <div v-if="(form.highlights || []).length === 0" class="text-xs text-black/50 dark:text-white/50">
                        No highlights yet.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- MEDIA TAB -->
              <div v-else class="space-y-4">
                <!-- Saved media -->
                <div class="panel">
                  <div class="panelHead">
                    <div class="font-semibold text-black dark:text-white">Saved media</div>
                    <div class="text-xs text-black/60 dark:text-white/60">Files already linked to this work.</div>
                  </div>
                  <div class="panelBody space-y-3">
                    <div v-if="refreshingMedia" class="p-3">
                      <div class="animate-pulse space-y-2">
                        <div class="h-3 w-40 rounded bg-black/10 dark:bg-white/10" />
                        <div class="h-3 w-full rounded bg-black/10 dark:bg-white/10" />
                        <div class="h-3 w-5/6 rounded bg-black/10 dark:bg-white/10" />
                      </div>
                    </div>

                    <template v-else>
                      <div v-if="heroSaved?.path" class="mediaRow">
                        <img :src="getPublicUrl(heroSaved.path)" class="mediaThumb" alt="" />
                        <div class="min-w-0 flex-1">
                          <div class="text-xs text-black/60 dark:text-white/60 font-mono truncate">{{ heroSaved.path }}</div>
                          <div class="text-xs text-black/60 dark:text-white/60 mt-1">{{ heroSaved.alt || '—' }}</div>
                        </div>
                        <button type="button" class="btnDangerMini" @click="removeSavedMedia(heroSaved)">Remove</button>
                      </div>
                      <div v-else class="text-xs text-black/50 dark:text-white/50">No hero yet.</div>

                      <div v-if="gallerySaved.length" class="galleryList">
                        <div v-for="m in gallerySaved" :key="m.id" class="galleryItem">
                          <img :src="getPublicUrl(m.path)" class="mediaThumb" alt="" />
                          <div class="min-w-0 flex-1">
                            <div class="text-xs text-black/60 dark:text-white/60 font-mono truncate">{{ m.path }}</div>
                            <div class="text-xs text-black/60 dark:text-white/60 mt-1">{{ m.alt || '—' }}</div>
                          </div>
                          <button type="button" class="btnDangerMini" @click="removeSavedMedia(m)">Remove</button>
                        </div>
                      </div>
                      <div v-else class="text-xs text-black/50 dark:text-white/50">No gallery yet.</div>
                    </template>
                  </div>
                </div>

                <!-- Uploads -->
                <div class="panel">
                  <div class="panelHead">
                    <div class="font-semibold text-black dark:text-white">Upload</div>
                    <div class="text-xs text-black/60 dark:text-white/60">Files upload automatically after you choose them.</div>
                  </div>
                  <div class="panelBody space-y-4">
                    <!-- Hero -->
                    <div class="grid gap-2">
                      <div class="text-xs font-semibold text-black/70 dark:text-white/70">Hero</div>

                      <div v-if="pending.hero?.path" class="mediaRow">
                        <img :src="getPublicUrl(pending.hero.path)" class="mediaThumb" alt="" />
                        <div class="min-w-0 flex-1">
                          <div class="text-xs text-black/60 dark:text-white/60 font-mono truncate">{{ pending.hero.path }}</div>
                          <div class="text-xs text-black/60 dark:text-white/60 mt-1">{{ autoAlt('hero') }}</div>
                        </div>
                        <button type="button" class="btnDangerMini" @click="removePending(pending.hero)">Remove</button>
                      </div>

                      <input
                        ref="heroInputEl"
                        class="input"
                        type="file"
                        accept="image/*"
                        :disabled="uploadingHero"
                        @change="onHeroPickedAuto"
                      />
                      <div class="text-[11px] text-black/60 dark:text-white/60">
                        Alt text will be saved automatically.
                      </div>
                    </div>

                    <!-- Gallery -->
                    <div class="grid gap-2">
                      <div class="text-xs font-semibold text-black/70 dark:text-white/70">Gallery</div>

                      <input
                        ref="galleryInputEl"
                        class="input"
                        type="file"
                        accept="image/*"
                        multiple
                        :disabled="uploadingGallery"
                        @change="onGalleryPickedAuto"
                      />

                      <div v-if="pending.gallery.length === 0" class="text-xs text-black/50 dark:text-white/50">
                        No gallery images selected yet.
                      </div>

                      <div v-else ref="pendingGalleryEl" class="galleryList">
                        <div v-for="(m, i) in pending.gallery" :key="m.path" class="galleryItem">
                          <button
                            type="button"
                            class="drag-handle inline-flex items-center justify-center w-9 h-9 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition"
                            title="Drag to reorder"
                            :disabled="isReorderPending"
                          >
                            ⠿
                          </button>
                          <img :src="getPublicUrl(m.path)" class="mediaThumb" alt="" />
                          <div class="min-w-0 flex-1">
                            <div class="text-xs text-black/60 dark:text-white/60 font-mono truncate">{{ m.path }}</div>
                            <div class="text-xs text-black/60 dark:text-white/60 mt-1">{{ autoAlt('gallery', i + 1) }}</div>
                          </div>
                          <button type="button" class="btnDangerMini" @click="removePending(m)">Remove</button>
                        </div>
                      </div>

                      <div class="text-[11px] text-black/60 dark:text-white/60">
                        Upload images, then click <span class="font-semibold">Create work</span> / <span class="font-semibold">Save changes</span>.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <!-- /MEDIA -->
            </div>
          </div>
        </div>

        <div class="modalFooter">
          <button
            type="button"
            class="btn px-4 py-2.5 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition"
            :disabled="saving || uploadingHero || uploadingGallery || refreshingMedia"
            @click="closeModal"
          >
            Close
          </button>

          <button
            type="button"
            class="btn px-4 py-2.5 rounded-2xl bg-black text-white dark:bg-white dark:text-black hover:opacity-90 transition"
            :disabled="saving || uploadingHero || uploadingGallery || refreshingMedia"
            @click="saveWorkFinalize"
          >
            <span v-if="!saving">{{ isEditing ? 'Save changes' : 'Create work' }}</span>
            <span v-else>Saving…</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ===== Created Modal ===== -->
    <div v-if="showCreated" class="fixed inset-0 z-[9999] grid place-items-center bg-black/55 p-4">
      <div class="w-full max-w-lg rounded-3xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#0b0f1a] shadow-[0_40px_120px_rgba(0,0,0,.35)] overflow-hidden">
        <div class="p-5 border-b border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="text-lg font-semibold text-black dark:text-white">Work created</div>
              <div class="text-xs text-black/60 dark:text-white/60 mt-1">Your new project is ready.</div>
            </div>
            <button class="btn px-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5" @click="closeCreated">
              ✕
            </button>
          </div>
        </div>

        <div class="p-5 space-y-3">
          <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-4">
            <div class="text-sm font-semibold text-black dark:text-white">{{ createdSummary.title }}</div>
            <div class="mt-2 text-xs text-black/60 dark:text-white/60">
              Category: <span class="font-mono">{{ createdSummary.category }}</span>
            </div>
            <div class="mt-2 text-xs text-black/60 dark:text-white/60">
              Slug: <span class="font-mono">{{ createdSummary.slug }}</span>
            </div>
            <div class="mt-2 text-xs text-black/60 dark:text-white/60">
              Link preview: <span class="font-mono">/work/{{ createdSummary.slug }}</span>
            </div>
          </div>

          <div class="text-sm text-black/70 dark:text-white/70">Do you want to create another work?</div>
        </div>

        <div class="p-5 border-t border-black/10 dark:border-white/10 flex justify-end gap-2">
          <button class="btn px-4 py-2.5 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5" @click="closeCreated">
            No, done
          </button>
          <button class="btn px-4 py-2.5 rounded-2xl bg-black text-white dark:bg-white dark:text-black hover:opacity-90 transition" @click="createAnother">
            Yes, create new
          </button>
        </div>
      </div>
    </div>

    <!-- ===== Delete Modal ===== -->
    <div v-if="showDelete" class="fixed inset-0 z-[9999] grid place-items-center bg-black/55 p-4">
      <div class="w-full max-w-md rounded-3xl border border-red-500/20 bg-white dark:bg-[#0b0f1a] shadow-[0_40px_120px_rgba(0,0,0,.35)] overflow-hidden">
        <div class="p-5 border-b border-black/10 dark:border-white/10 bg-red-500/5">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="text-lg font-semibold text-black dark:text-white">Delete work?</div>
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

<style scoped>
/* Inputs */
.input {
  width: 100%;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  background: rgba(255, 255, 255, 0.65);
  color: rgba(0, 0, 0, 0.9);
  outline: none;
}
.dark .input {
  border-color: rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.92);
}
.input::placeholder {
  color: rgba(0, 0, 0, 0.45);
}
.dark .input::placeholder {
  color: rgba(255, 255, 255, 0.45);
}
.readOnly {
  opacity: 0.75;
  cursor: not-allowed;
}

/* Checkbox */
.checkbox {
  width: 18px;
  height: 18px;
  border-radius: 6px;
  border: 1px solid rgba(0, 0, 0, 0.2);
}
.dark .checkbox {
  border-color: rgba(255, 255, 255, 0.2);
}

/* Drag */
.drag-handle {
  cursor: grab;
}
.drag-handle:active {
  cursor: grabbing;
}
.sortable-ghost {
  opacity: 0.55;
}
.sortable-chosen {
  transform: scale(1.01);
}

/* Small buttons */
.btnDangerMini {
  padding: 6px 10px;
  border-radius: 12px;
  border: 1px solid rgba(239, 68, 68, 0.25);
  background: rgba(239, 68, 68, 0.1);
  color: rgba(185, 28, 28, 0.95);
  font-size: 12px;
  white-space: nowrap;
}
.dark .btnDangerMini {
  color: rgba(252, 165, 165, 0.95);
}

/* Panels */
.panel {
  border-radius: 22px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  background: rgba(255, 255, 255, 0.65);
  overflow: hidden;
}
.dark .panel {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
}
.panelHead {
  padding: 12px 14px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  background: rgba(0, 0, 0, 0.03);
}
.dark .panelHead {
  border-bottom-color: rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
}
.panelBody {
  padding: 12px 14px;
}

/* Chips */
.chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  background: rgba(0, 0, 0, 0.04);
  font-size: 12px;
  color: rgba(0, 0, 0, 0.85);
}
.dark .chip {
  border-color: rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.9);
}
.chip.soft {
  background: rgba(124, 58, 237, 0.08);
  border-color: rgba(124, 58, 237, 0.18);
}
.dark .chip.soft {
  background: rgba(124, 58, 237, 0.12);
  border-color: rgba(124, 58, 237, 0.24);
}
.chipX {
  width: 20px;
  height: 20px;
  border-radius: 999px;
  border: 1px solid rgba(0, 0, 0, 0.14);
  background: rgba(0, 0, 0, 0.06);
  line-height: 18px;
}
.dark .chipX {
  border-color: rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.9);
}

/* ===== Modal ===== */
.modalOverlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.55);
  padding: 16px;
}
.modalShell {
  width: 100%;
  max-width: 980px;
  max-height: calc(100vh - 32px);
  display: flex;
  flex-direction: column;
  border-radius: 28px;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.1);
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 40px 120px rgba(0, 0, 0, 0.35);
  position: relative;
}
.dark .modalShell {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(11, 15, 26, 0.92);
}
.modalHeader {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  background: rgba(255, 255, 255, 0.86);
  backdrop-filter: blur(10px);
}
.dark .modalHeader {
  border-bottom-color: rgba(255, 255, 255, 0.1);
  background: rgba(11, 15, 26, 0.75);
}
.modalClose {
  width: 40px;
  height: 40px;
  border-radius: 14px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  background: rgba(0, 0, 0, 0.05);
  transition: 0.15s;
}
.dark .modalClose {
  border-color: rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.92);
}
.modalClose:hover {
  transform: translateY(-1px);
}
.modalBody {
  padding: 16px;
  overflow: auto;
  flex: 1;
}
.modalFooter {
  position: sticky;
  bottom: 0;
  z-index: 2;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 16px;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  background: rgba(255, 255, 255, 0.86);
  backdrop-filter: blur(10px);
}
.dark .modalFooter {
  border-top-color: rgba(255, 255, 255, 0.1);
  background: rgba(11, 15, 26, 0.75);
}
.modalTopRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

/* ===== Tabs ===== */
.tabWrap {
  border-radius: 22px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  background: rgba(255, 255, 255, 0.65);
  overflow: hidden;
}
.dark .tabWrap {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
}
.tabBar {
  display: flex;
  gap: 8px;
  padding: 10px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  background: rgba(0, 0, 0, 0.03);
}
.dark .tabBar {
  border-bottom-color: rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
}
.tabBtn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 10px;
  border-radius: 14px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  background: rgba(255, 255, 255, 0.7);
  color: rgba(0, 0, 0, 0.75);
  font-size: 12px;
  font-weight: 600;
  transition: 0.15s;
}
.dark .tabBtn {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.75);
}
.tabBtn:hover {
  transform: translateY(-1px);
}
.tabBtn.active {
  border-color: rgba(124, 58, 237, 0.35);
  background: rgba(124, 58, 237, 0.12);
  color: rgba(0, 0, 0, 0.9);
}
.dark .tabBtn.active {
  color: rgba(255, 255, 255, 0.92);
  background: rgba(124, 58, 237, 0.18);
  border-color: rgba(124, 58, 237, 0.4);
}
.tabPanel {
  padding: 12px;
}

/* Media UI */
.mediaRow {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  border-radius: 18px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  background: rgba(0, 0, 0, 0.03);
}
.dark .mediaRow {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
}
.mediaThumb {
  width: 70px;
  height: 52px;
  border-radius: 14px;
  object-fit: cover;
  border: 1px solid rgba(0, 0, 0, 0.1);
  background: rgba(0, 0, 0, 0.03);
}
.dark .mediaThumb {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
}
.galleryList {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.galleryItem {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border-radius: 18px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  background: rgba(0, 0, 0, 0.03);
}
.dark .galleryItem {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
}

/* Loading overlay inside modal */
.loadingOverlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(4px);
}
.loadingCard {
  width: min(360px, 92%);
  border-radius: 22px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(11, 15, 26, 0.88);
  padding: 16px;
  text-align: center;
}
.spinner {
  width: 34px;
  height: 34px;
  border-radius: 999px;
  border: 3px solid rgba(255, 255, 255, 0.22);
  border-top-color: rgba(255, 255, 255, 0.85);
  margin: 0 auto;
  animation: spin 0.9s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
