<script setup lang="ts">
type Priority = 'Low' | 'Medium' | 'High'
type Status = 'Active' | 'Done'

type TodoItem = {
  id: string
  title: string
  notes?: string
  priority: Priority
  due?: string | null // YYYY-MM-DD
  tags: string[]
  status: Status
  createdAt: number
  updatedAt: number
  order: number
}

const STORAGE_KEY = 'illusionarc.todo.v1'

/* ---------------- State ---------------- */
const query = ref('')
const filterStatus = ref<'All' | Status>('All')
const filterPriority = ref<'All' | Priority>('All')
const filterTag = ref<'All' | string>('All')
const hideOverdueDone = ref(false)

const items = ref<TodoItem[]>([])
const selected = ref<TodoItem | null>(null)

/* Create form */
const newTitle = ref('')
const newPriority = ref<Priority>('Medium')
const newDue = ref<string | null>(null)
const newTagsInput = ref('')

/* UI helpers */
const toast = useToast()

/* ---------------- Utils ---------------- */
function uid() {
  // tiny uid for client-only data
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

function isOverdue(i: TodoItem) {
  if (!i.due) return false
  // Compare by date only (local)
  const today = new Date()
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const d = new Date(i.due + 'T00:00:00').getTime()
  return i.status !== 'Done' && d < t
}

function save() {
  try {
    const payload = JSON.stringify(items.value)
    localStorage.setItem(STORAGE_KEY, payload)
  } catch {
    // ignore
  }
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as TodoItem[]
    if (Array.isArray(parsed)) items.value = parsed
  } catch {
    // ignore
  }
}

/* ---------------- Lifecycle ---------------- */
onMounted(() => {
  load()
  // If empty, seed a tiny starter list (optional)
  if (items.value.length === 0) {
    const now = Date.now()
    items.value = [
      {
        id: uid(),
        title: 'Plan today’s top 3 tasks',
        notes: 'Keep it realistic. Finish > perfect.',
        priority: 'High',
        due: null,
        tags: ['work'],
        status: 'Active',
        createdAt: now,
        updatedAt: now,
        order: 0
      },
      {
        id: uid(),
        title: 'Review meetings & prep agenda',
        notes: '',
        priority: 'Medium',
        due: null,
        tags: ['meeting'],
        status: 'Active',
        createdAt: now,
        updatedAt: now,
        order: 1
      }
    ]
    save()
  }
})

watch(
  items,
  () => {
    // keep order stable & persisted
    save()
  },
  { deep: true }
)

/* ---------------- Derived ---------------- */
const allTags = computed(() => {
  const set = new Set<string>()
  for (const i of items.value) for (const t of i.tags) set.add(t)
  return Array.from(set).sort((a, b) => a.localeCompare(b))
})

const tagOptions = computed(() => [
  { label: 'All', value: 'All' },
  ...allTags.value.map((t) => ({ label: t, value: t }))
])

const statusOptions = [
  { label: 'All', value: 'All' },
  { label: 'Active', value: 'Active' },
  { label: 'Done', value: 'Done' }
] as const

const priorityOptions = [
  { label: 'All', value: 'All' },
  { label: 'High', value: 'High' },
  { label: 'Medium', value: 'Medium' },
  { label: 'Low', value: 'Low' }
] as const

const counts = computed(() => {
  const total = items.value.length
  const done = items.value.filter((i) => i.status === 'Done').length
  const active = total - done
  const overdue = items.value.filter((i) => isOverdue(i)).length
  return { total, active, done, overdue }
})

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()

  // sort by order first
  const base = [...items.value].sort((a, b) => a.order - b.order)

  return base
    .filter((i) => (filterStatus.value === 'All' ? true : i.status === filterStatus.value))
    .filter((i) => (filterPriority.value === 'All' ? true : i.priority === filterPriority.value))
    .filter((i) => (filterTag.value === 'All' ? true : i.tags.includes(filterTag.value)))
    .filter((i) => (hideOverdueDone.value ? !(i.status === 'Done' && isOverdue(i)) : true))
    .filter((i) => {
      if (!q) return true
      const hay = `${i.title} ${i.notes || ''} ${i.priority} ${i.tags.join(' ')}`.toLowerCase()
      return hay.includes(q)
    })
})

/* ---------------- Actions ---------------- */
function createTodo() {
  const title = newTitle.value.trim()
  if (!title) return

  const now = Date.now()
  const nextOrder = items.value.length ? Math.max(...items.value.map((i) => i.order)) + 1 : 0

  const todo: TodoItem = {
    id: uid(),
    title,
    notes: '',
    priority: newPriority.value,
    due: newDue.value || null,
    tags: normalizeTags(newTagsInput.value),
    status: 'Active',
    createdAt: now,
    updatedAt: now,
    order: nextOrder
  }

  items.value.push(todo)

  newTitle.value = ''
  newPriority.value = 'Medium'
  newDue.value = null
  newTagsInput.value = ''

  toast.add({ title: 'Added', description: todo.title })
}

function toggleDone(i: TodoItem) {
  i.status = i.status === 'Done' ? 'Active' : 'Done'
  i.updatedAt = Date.now()
}

function removeTodo(i: TodoItem) {
  items.value = items.value.filter((x) => x.id !== i.id)
  if (selected.value?.id === i.id) selected.value = null
  toast.add({ title: 'Deleted', description: i.title })
}

function openEdit(i: TodoItem) {
  selected.value = { ...i }
}

function applyEdit() {
  if (!selected.value) return
  const title = selected.value.title.trim()
  if (!title) return

  const idx = items.value.findIndex((x) => x.id === selected.value!.id)
  if (idx === -1) return

  const prev = items.value[idx]
  items.value[idx] = {
    ...prev,
    title,
    notes: selected.value.notes || '',
    priority: selected.value.priority,
    due: selected.value.due || null,
    tags: Array.isArray(selected.value.tags) ? selected.value.tags : [],
    status: selected.value.status,
    updatedAt: Date.now()
  }

  selected.value = null
  toast.add({ title: 'Saved', description: title })
}

function clearAllDone() {
  const before = items.value.length
  items.value = items.value.filter((i) => i.status !== 'Done')
  const removed = before - items.value.length
  toast.add({ title: 'Cleared', description: `${removed} completed task(s) removed.` })
}

function reorder(fromIndex: number, toIndex: number) {
  const arr = [...items.value].sort((a, b) => a.order - b.order)
  const [moved] = arr.splice(fromIndex, 1)
  arr.splice(toIndex, 0, moved)
  // rewrite order
  items.value = arr.map((i, idx) => ({ ...i, order: idx }))
}

/* Keyboard: Enter to add */
function onNewTitleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') createTodo()
}
</script>

<template>
  <div class="rounded-3xl border border-black/10 bg-white/60 p-5 shadow-sm backdrop-blur
              dark:border-white/10 dark:bg-black/20">
    <!-- Header -->
    <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <h2 class="text-2xl font-semibold">To-Do</h2>
        <p class="mt-1 text-sm text-black/60 dark:text-white/60">
          Simple tasks, priorities, due dates, tags — saved locally.
        </p>

        <div class="mt-3 flex flex-wrap gap-2 text-xs">
          <UBadge variant="soft">Total: {{ counts.total }}</UBadge>
          <UBadge variant="soft">Active: {{ counts.active }}</UBadge>
          <UBadge variant="soft">Done: {{ counts.done }}</UBadge>
          <UBadge v-if="counts.overdue" variant="soft">Overdue: {{ counts.overdue }}</UBadge>
        </div>
      </div>

      <div class="flex flex-col gap-2 md:flex-row md:items-center">
        <UInput
          v-model="query"
          icon="i-heroicons-magnifying-glass"
          placeholder="Search…"
          class="md:w-64"
        />
        <USelect v-model="filterStatus" :options="statusOptions" class="md:w-36" />
        <USelect v-model="filterPriority" :options="priorityOptions" class="md:w-36" />
        <USelect v-model="filterTag" :options="tagOptions" class="md:w-44" />
      </div>
    </div>

    <!-- Create -->
    <div class="mt-6 grid gap-3 md:grid-cols-12">
      <div class="md:col-span-5">
        <UInput
          v-model="newTitle"
          placeholder="Add a task…"
          icon="i-heroicons-plus"
          @keydown="onNewTitleKeydown"
        />
      </div>

      <div class="md:col-span-2">
        <USelect
          v-model="newPriority"
          :options="[
            { label: 'High', value: 'High' },
            { label: 'Medium', value: 'Medium' },
            { label: 'Low', value: 'Low' }
          ]"
        />
      </div>

      <div class="md:col-span-2">
        <UInput v-model="newDue" type="date" />
      </div>

      <div class="md:col-span-2">
        <UInput v-model="newTagsInput" placeholder="tags: work, meeting" />
      </div>

      <div class="md:col-span-1">
        <UButton block @click="createTodo">
          Add
        </UButton>
      </div>
    </div>

    <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
      <UCheckbox v-model="hideOverdueDone" label="Hide done items that are overdue" />
      <UButton
        v-if="counts.done"
        variant="soft"
        color="red"
        @click="clearAllDone"
      >
        Clear done
      </UButton>
    </div>

    <!-- List -->
    <div class="mt-6 grid gap-3">
      <div
        v-for="(i, idx) in filtered"
        :key="i.id"
        class="group flex flex-col gap-3 rounded-2xl border border-black/10 bg-white/60 p-4
               dark:border-white/10 dark:bg-black/20"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-start gap-3">
            <UCheckbox
              :model-value="i.status === 'Done'"
              @update:model-value="() => toggleDone(i)"
              class="mt-0.5"
            />

            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <div
                  class="truncate font-medium"
                  :class="i.status === 'Done' ? 'line-through opacity-60' : ''"
                >
                  {{ i.title }}
                </div>

                <UBadge v-if="i.priority === 'High'" variant="soft">High</UBadge>
                <UBadge v-else-if="i.priority === 'Medium'" variant="soft">Medium</UBadge>
                <UBadge v-else variant="soft">Low</UBadge>

                <UBadge v-if="isOverdue(i)" variant="soft">Overdue</UBadge>

                <UBadge v-if="i.due" variant="soft">Due: {{ i.due }}</UBadge>
              </div>

              <div v-if="i.tags.length" class="mt-2 flex flex-wrap gap-1.5">
                <UBadge
                  v-for="t in i.tags"
                  :key="t"
                  variant="soft"
                  size="xs"
                  class="cursor-pointer"
                  @click="filterTag = t"
                >
                  {{ t }}
                </UBadge>
              </div>

              <div v-if="i.notes" class="mt-2 text-sm text-black/60 dark:text-white/60">
                {{ i.notes }}
              </div>
            </div>
          </div>

          <div class="flex items-center gap-1.5 opacity-90">
            <!-- reorder buttons -->
            <UButton
              variant="ghost"
              icon="i-heroicons-chevron-up"
              :disabled="idx === 0"
              @click="reorder(idx, idx - 1)"
            />
            <UButton
              variant="ghost"
              icon="i-heroicons-chevron-down"
              :disabled="idx === filtered.length - 1"
              @click="reorder(idx, idx + 1)"
            />

            <UButton variant="ghost" icon="i-heroicons-pencil-square" @click="openEdit(i)" />
            <UButton
              variant="ghost"
              color="red"
              icon="i-heroicons-trash"
              @click="removeTodo(i)"
            />
          </div>
        </div>
      </div>

      <div
        v-if="filtered.length === 0"
        class="rounded-2xl border border-black/10 bg-white/50 p-6 text-sm text-black/60
               dark:border-white/10 dark:bg-black/15 dark:text-white/60"
      >
        No tasks found. Try a different keyword or filter.
      </div>
    </div>

    <!-- Edit Modal -->
    <UModal v-model="(selected as any)">
      <div class="p-5">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h3 class="text-lg font-semibold">Edit task</h3>
            <p class="mt-1 text-sm text-black/60 dark:text-white/60">
              Update title, notes, tags, due date, and status.
            </p>
          </div>
          <UButton variant="ghost" icon="i-heroicons-x-mark" @click="selected = null" />
        </div>

        <div v-if="selected" class="mt-5 grid gap-3">
          <UInput v-model="selected.title" label="Title" />
          <UTextarea v-model="selected.notes" label="Notes" :rows="3" />

          <div class="grid gap-3 md:grid-cols-3">
            <USelect
              v-model="selected.priority"
              :options="[
                { label: 'High', value: 'High' },
                { label: 'Medium', value: 'Medium' },
                { label: 'Low', value: 'Low' }
              ]"
              label="Priority"
            />
            <USelect
              v-model="selected.status"
              :options="[
                { label: 'Active', value: 'Active' },
                { label: 'Done', value: 'Done' }
              ]"
              label="Status"
            />
            <UInput v-model="selected.due" type="date" label="Due date" />
          </div>

          <UInput
            :model-value="selected.tags.join(', ')"
            label="Tags"
            placeholder="work, meeting, personal"
            @update:model-value="(v: string) => (selected!.tags = normalizeTags(String(v)))"
          />

          <div class="mt-2 flex justify-end gap-2">
            <UButton variant="soft" @click="selected = null">Cancel</UButton>
            <UButton @click="applyEdit">Save</UButton>
          </div>
        </div>
      </div>
    </UModal>
  </div>
</template>
