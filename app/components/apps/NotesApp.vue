<script setup lang="ts">
type NoteFolder = 'Inbox' | 'Work' | 'Personal' | 'Ideas' | 'Archive'

type NoteItem = {
  id: string
  title: string
  content: string
  folder: NoteFolder
  tags: string[]
  pinned: boolean
  createdAt: number
  updatedAt: number
}

const STORAGE_KEY = 'illusionarc.notes.v1'

const toast = useToast()

/* ---------------- State ---------------- */
const notes = ref<NoteItem[]>([])
const selectedId = ref<string | null>(null)

const query = ref('')
const folder = ref<NoteFolder | 'All'>('All')
const tag = ref<'All' | string>('All')
const showPinnedOnly = ref(false)

/* Edit fields (bound to selected note) */
const editTitle = ref('')
const editContent = ref('')
const editFolder = ref<NoteFolder>('Inbox')
const editTagsInput = ref('')
const editPinned = ref(false)

const markdownPreview = ref(true)

/* ---------------- Utils ---------------- */
function uid() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
}

function normalizeTags(input: string): string[] {
  return input
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => t.replace(/\s+/g, ' '))
    .slice(0, 12)
}

function formatDate(ts: number) {
  const d = new Date(ts)
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes.value))
  } catch {
    // ignore
  }
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as NoteItem[]
    if (Array.isArray(parsed)) notes.value = parsed
  } catch {
    // ignore
  }
}

/* Minimal markdown -> HTML (safe-ish) */
function escapeHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function mdToHtml(md: string) {
  const s = escapeHtml(md)

  // very small set: headings, bold, italic, code, links, line breaks
  const withCode = s.replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-black/5 dark:bg-white/10">$1</code>')
  const withBold = withCode.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  const withItalic = withBold.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  const withH3 = withItalic.replace(/^### (.*)$/gm, '<h3 class="mt-4 mb-2 text-lg font-semibold">$1</h3>')
  const withH2 = withH3.replace(/^## (.*)$/gm, '<h2 class="mt-4 mb-2 text-xl font-semibold">$1</h2>')
  const withH1 = withH2.replace(/^# (.*)$/gm, '<h1 class="mt-4 mb-2 text-2xl font-semibold">$1</h1>')
  const withLinks = withH1.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a class="underline underline-offset-4" href="$2" target="_blank" rel="noreferrer">$1</a>')
  const withParas = withLinks
    .split(/\n{2,}/)
    .map((block) => {
      const b = block.trim()
      if (!b) return ''
      // if already heading
      if (b.startsWith('<h')) return b
      // keep line breaks inside paragraph
      return `<p class="leading-relaxed">${b.replace(/\n/g, '<br />')}</p>`
    })
    .join('<div class="h-3"></div>')

  return withParas
}

/* ---------------- Lifecycle ---------------- */
onMounted(() => {
  load()

  if (notes.value.length === 0) {
    const now = Date.now()
    const first: NoteItem = {
      id: uid(),
      title: 'Welcome note',
      content:
        '# Notes\n\n- Use **markdown** for formatting\n- Add tags like: work, meeting\n- Pin important notes\n\nTry writing your daily meeting notes here.',
      folder: 'Inbox',
      tags: ['work'],
      pinned: true,
      createdAt: now,
      updatedAt: now
    }
    notes.value = [first]
    selectedId.value = first.id
    save()
  } else {
    // pick last updated
    const pick = [...notes.value].sort((a, b) => b.updatedAt - a.updatedAt)[0]
    selectedId.value = pick?.id || null
  }
})

watch(
  notes,
  () => {
    save()
  },
  { deep: true }
)

/* ---------------- Derived ---------------- */
const folders = computed<(NoteFolder | 'All')[]>(() => [
  'All',
  'Inbox',
  'Work',
  'Personal',
  'Ideas',
  'Archive'
])

const folderOptions = computed(() => folders.value.map((f) => ({ label: f, value: f })))

const allTags = computed(() => {
  const set = new Set<string>()
  for (const n of notes.value) for (const t of n.tags) set.add(t)
  return Array.from(set).sort((a, b) => a.localeCompare(b))
})

const tagOptions = computed(() => [
  { label: 'All', value: 'All' },
  ...allTags.value.map((t) => ({ label: t, value: t }))
])

const selected = computed(() => notes.value.find((n) => n.id === selectedId.value) || null)

watch(
  selected,
  (n) => {
    if (!n) return
    editTitle.value = n.title
    editContent.value = n.content
    editFolder.value = n.folder
    editTagsInput.value = n.tags.join(', ')
    editPinned.value = n.pinned
  },
  { immediate: true }
)

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()

  const base = [...notes.value]
    .filter((n) => (folder.value === 'All' ? true : n.folder === folder.value))
    .filter((n) => (tag.value === 'All' ? true : n.tags.includes(tag.value)))
    .filter((n) => (showPinnedOnly.value ? n.pinned : true))
    .filter((n) => {
      if (!q) return true
      const hay = `${n.title} ${n.content} ${n.folder} ${n.tags.join(' ')}`.toLowerCase()
      return hay.includes(q)
    })

  // pinned first, then updated desc
  return base.sort((a, b) => {
    if (a.pinned !== b.pinned) return Number(b.pinned) - Number(a.pinned)
    return b.updatedAt - a.updatedAt
  })
})

const selectedPreviewHtml = computed(() => mdToHtml(editContent.value || ''))

/* ---------------- Actions ---------------- */
function createNote() {
  const now = Date.now()
  const n: NoteItem = {
    id: uid(),
    title: 'Untitled note',
    content: '',
    folder: 'Inbox',
    tags: [],
    pinned: false,
    createdAt: now,
    updatedAt: now
  }
  notes.value.unshift(n)
  selectedId.value = n.id
  toast.add({ title: 'Created', description: 'New note added.' })
}

function deleteNote(id: string) {
  const cur = selectedId.value
  notes.value = notes.value.filter((n) => n.id !== id)

  if (cur === id) {
    const next = filtered.value[0]?.id || notes.value[0]?.id || null
    selectedId.value = next
  }

  toast.add({ title: 'Deleted', description: 'Note removed.' })
}

function togglePin(id: string) {
  const n = notes.value.find((x) => x.id === id)
  if (!n) return
  n.pinned = !n.pinned
  n.updatedAt = Date.now()
}

function applyEdits() {
  const n = selected.value
  if (!n) return

  n.title = (editTitle.value || 'Untitled note').trim()
  n.content = editContent.value || ''
  n.folder = editFolder.value
  n.tags = normalizeTags(editTagsInput.value)
  n.pinned = editPinned.value
  n.updatedAt = Date.now()

  toast.add({ title: 'Saved', description: n.title })
}

let autosaveTimer: any = null
watch([editTitle, editContent, editFolder, editTagsInput, editPinned], () => {
  if (!selected.value) return
  clearTimeout(autosaveTimer)
  autosaveTimer = setTimeout(() => {
    applyEdits()
  }, 450)
})

function exportJson() {
  const data = JSON.stringify(notes.value, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'notes-export.json'
  a.click()
  URL.revokeObjectURL(url)
}

function importJson(file: File | null) {
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result)) as NoteItem[]
      if (!Array.isArray(parsed)) throw new Error('Invalid format')
      notes.value = parsed
      selectedId.value = notes.value[0]?.id || null
      toast.add({ title: 'Imported', description: 'Notes imported successfully.' })
    } catch {
      toast.add({ title: 'Import failed', description: 'Invalid JSON file.' })
    }
  }
  reader.readAsText(file)
}
</script>

<template>
  <div class="rounded-3xl border border-black/10 bg-white/60 p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-black/20">
    <!-- Header -->
    <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <h2 class="text-2xl font-semibold">Notes</h2>
        <p class="mt-1 text-sm text-black/60 dark:text-white/60">
          Foldered notes with tags, pinning, search, and markdown preview.
        </p>
      </div>

      <div class="flex flex-col gap-2 md:flex-row md:items-center">
        <UButton icon="i-heroicons-plus" @click="createNote">New</UButton>
        <UButton variant="soft" icon="i-heroicons-arrow-down-tray" @click="exportJson">Export</UButton>

        <div class="relative">
          <input
            type="file"
            accept="application/json"
            class="absolute inset-0 z-10 w-full cursor-pointer opacity-0"
            @change="(e: any) => importJson(e.target?.files?.[0] || null)"
          />
          <UButton variant="soft" icon="i-heroicons-arrow-up-tray">Import</UButton>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="mt-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <div class="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
        <UInput
          v-model="query"
          icon="i-heroicons-magnifying-glass"
          placeholder="Search notes…"
          class="md:w-64"
        />
        <USelect v-model="folder" :options="folderOptions" class="md:w-40" />
        <USelect v-model="tag" :options="tagOptions" class="md:w-44" />
      </div>

      <div class="flex items-center justify-between gap-3">
        <UCheckbox v-model="showPinnedOnly" label="Pinned only" />
        <UCheckbox v-model="markdownPreview" label="Preview" />
      </div>
    </div>

    <!-- Layout -->
    <div class="mt-6 grid gap-4 lg:grid-cols-12">
      <!-- Sidebar list -->
      <div class="lg:col-span-4">
        <div class="rounded-2xl border border-black/10 bg-white/50 p-3 dark:border-white/10 dark:bg-black/15">
          <div class="max-h-[560px] overflow-auto">
            <button
              v-for="n in filtered"
              :key="n.id"
              class="group w-full rounded-xl border border-transparent p-3 text-left transition
                     hover:bg-black/5 dark:hover:bg-white/5"
              :class="selectedId === n.id ? 'bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10' : ''"
              @click="selectedId = n.id"
            >
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <UIcon
                      v-if="n.pinned"
                      name="i-heroicons-bookmark-solid"
                      class="h-4 w-4"
                    />
                    <div class="truncate font-medium">{{ n.title || 'Untitled note' }}</div>
                  </div>
                  <div class="mt-1 text-xs text-black/55 dark:text-white/55">
                    {{ n.folder }} • {{ formatDate(n.updatedAt) }}
                  </div>
                </div>

                <div class="flex shrink-0 items-center gap-1 opacity-80">
                  <UButton
                    variant="ghost"
                    icon="i-heroicons-bookmark"
                    @click.stop="togglePin(n.id)"
                  />
                  <UButton
                    variant="ghost"
                    color="red"
                    icon="i-heroicons-trash"
                    @click.stop="deleteNote(n.id)"
                  />
                </div>
              </div>

              <div v-if="n.tags.length" class="mt-2 flex flex-wrap gap-1.5">
                <UBadge
                  v-for="t in n.tags.slice(0, 4)"
                  :key="t"
                  variant="soft"
                  size="xs"
                  class="cursor-pointer"
                  @click.stop="tag = t"
                >
                  {{ t }}
                </UBadge>
                <span v-if="n.tags.length > 4" class="text-xs opacity-60">+{{ n.tags.length - 4 }}</span>
              </div>
            </button>

            <div
              v-if="filtered.length === 0"
              class="rounded-xl border border-black/10 bg-white/60 p-4 text-sm text-black/60 dark:border-white/10 dark:bg-black/20 dark:text-white/60"
            >
              No notes found.
            </div>
          </div>
        </div>
      </div>

      <!-- Editor -->
      <div class="lg:col-span-8">
        <div class="rounded-2xl border border-black/10 bg-white/50 p-4 dark:border-white/10 dark:bg-black/15">
          <div v-if="!selected" class="text-sm text-black/60 dark:text-white/60">
            Select a note from the left, or create a new one.
          </div>

          <div v-else class="grid gap-3">
            <div class="grid gap-3 md:grid-cols-12">
              <div class="md:col-span-7">
                <UInput v-model="editTitle" label="Title" />
              </div>
              <div class="md:col-span-3">
                <USelect v-model="editFolder" :options="folderOptions.filter(o => o.value !== 'All')" label="Folder" />
              </div>
              <div class="md:col-span-2">
                <div class="pt-7">
                  <UCheckbox v-model="editPinned" label="Pinned" />
                </div>
              </div>
            </div>

            <UInput v-model="editTagsInput" label="Tags" placeholder="work, meeting, personal" />

            <div class="grid gap-3 lg:grid-cols-2">
              <UTextarea v-model="editContent" :rows="14" label="Content" placeholder="Write your note…" />

              <div v-if="markdownPreview" class="rounded-xl border border-black/10 bg-white/60 p-4 dark:border-white/10 dark:bg-black/20">
                <div class="text-xs uppercase tracking-wide opacity-60">Preview</div>
                <div class="mt-3 prose prose-sm max-w-none dark:prose-invert" v-html="selectedPreviewHtml" />
              </div>
            </div>

            <div class="flex items-center justify-between text-xs text-black/55 dark:text-white/55">
              <div>
                Created: {{ formatDate(selected.createdAt) }} • Updated: {{ formatDate(selected.updatedAt) }}
              </div>
              <div class="opacity-70">Autosaves while typing</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
