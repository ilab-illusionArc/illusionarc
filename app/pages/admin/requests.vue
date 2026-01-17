<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: ['admin']
})

useHead({ title: 'Admin — Requests' })

const toast = useToast()
const supabase = useSupabaseClient()

type ReqStatus = 'new' | 'read' | 'done' | 'archived'
type ContactRequestRow = {
  id: string
  created_at: string
  name: string
  email: string
  project_type: string
  budget: string
  message: string
  source: string
  status: ReqStatus
  user_agent: string | null
  ip: string | null
}

const loading = ref(true)
const errorMsg = ref<string | null>(null)

const q = ref('')
const statusFilter = ref<ReqStatus | 'all'>('all')
const limit = ref(100)

const rows = ref<ContactRequestRow[]>([])

const selected = ref<ContactRequestRow | null>(null)
const modalOpen = ref(false)

const updating = ref(false)

function clampLimit(n: number) {
  if (!Number.isFinite(n)) return 100
  return Math.max(10, Math.min(Math.floor(n), 500))
}

function fmtDate(ts?: string) {
  if (!ts) return ''
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ts
  return d.toLocaleString()
}

function safeContains(hay: string, needle: string) {
  return hay.toLowerCase().includes(needle.toLowerCase())
}

function statusPillClass(s: ReqStatus) {
  switch (s) {
    case 'new':
      return 'bg-amber-500/10 text-amber-800 dark:text-amber-200 border-amber-500/20'
    case 'read':
      return 'bg-sky-500/10 text-sky-800 dark:text-sky-200 border-sky-500/20'
    case 'done':
      return 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 border-emerald-500/20'
    case 'archived':
      return 'bg-zinc-500/10 text-zinc-700 dark:text-zinc-200 border-zinc-500/20'
  }
}

function statusDotClass(s: ReqStatus) {
  switch (s) {
    case 'new':
      return 'bg-amber-500'
    case 'read':
      return 'bg-sky-500'
    case 'done':
      return 'bg-emerald-500'
    case 'archived':
      return 'bg-zinc-400'
  }
}

function short(v: string, n = 110) {
  const s = String(v || '').trim()
  if (s.length <= n) return s
  return s.slice(0, n).trimEnd() + '…'
}

const filtered = computed(() => {
  const needle = q.value.trim()
  let list = rows.value

  if (statusFilter.value !== 'all') {
    list = list.filter((r) => r.status === statusFilter.value)
  }

  if (needle) {
    list = list.filter((r) => {
      const s = `${r.name} ${r.email} ${r.project_type} ${r.budget} ${r.message} ${r.status}`.trim()
      return safeContains(s, needle)
    })
  }

  return list
})

const stats = computed(() => {
  const out = { total: rows.value.length, new: 0, read: 0, done: 0, archived: 0 }
  for (const r of rows.value) (out as any)[r.status]++
  return out
})

async function load(): Promise<void> {
  loading.value = true
  errorMsg.value = null
  rows.value = []

  try {
    const lim = clampLimit(limit.value)

    const { data, error } = await supabase
        .from('contact_requests')
        .select('id, created_at, name, email, project_type, budget, message, source, status, user_agent, ip')
        .order('created_at', { ascending: false })
        .limit(lim)

    if (error) throw error
    rows.value = (data || []) as unknown as ContactRequestRow[]
  } catch (e: any) {
    errorMsg.value = e?.message || 'Failed to load requests.'
  } finally {
    loading.value = false
  }
}

onMounted(load)

function openRow(r: ContactRequestRow) {
  selected.value = r
  modalOpen.value = true
}

function closeModal() {
  modalOpen.value = false
  selected.value = null
}

function copy(v: string) {
  if (!import.meta.client) return
  navigator.clipboard.writeText(v).then(
      () => toast.add({ title: 'Copied', description: v, color: 'success' }),
      () => toast.add({ title: 'Copy failed', description: 'Your browser blocked it.', color: 'warning' })
  )
}

function mailTo(email: string) {
  if (!import.meta.client) return
  window.location.href = `mailto:${encodeURIComponent(email)}`
}

async function setStatus(next: ReqStatus): Promise<void> {
  if (!selected.value) return
  if (updating.value) return
  if (selected.value.status === next) return

  updating.value = true
  try {
    const id = selected.value.id

    // ✅ minimal payload avoids TS "never" issues
    const { error } = await supabase.from('contact_requests').update({ status: next }).eq('id', id)
    if (error) throw error

    rows.value = rows.value.map((r) => (r.id === id ? { ...r, status: next } : r))
    selected.value = { ...selected.value, status: next }

    toast.add({ title: 'Updated', description: `Status set to "${next}".`, color: 'success' })
  } catch (e: any) {
    toast.add({ title: 'Update failed', description: e?.message || 'Try again.', color: 'error' })
  } finally {
    updating.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div
        class="relative overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-5 lg:p-6 backdrop-blur"
    >
      <!-- gradient blobs -->
      <div
          class="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full blur-3xl opacity-60"
          style="background: radial-gradient(circle at 30% 30%, rgba(124,58,237,.22), transparent 60%);"
          aria-hidden="true"
      />
      <div
          class="pointer-events-none absolute -bottom-28 -left-28 h-80 w-80 rounded-full blur-3xl opacity-60"
          style="background: radial-gradient(circle at 30% 30%, rgba(34,211,238,.22), transparent 60%);"
          aria-hidden="true"
      />

      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="min-w-0">
          <div
              class="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-1.5 text-xs text-black/60 dark:text-white/60"
          >
            <UIcon name="i-heroicons-clipboard-document-list" class="h-4 w-4" />
            Contact Requests
          </div>

          <h1 class="mt-3 text-2xl lg:text-3xl font-extrabold tracking-tight text-black dark:text-white">
            Requests
          </h1>
          <p class="mt-1 text-sm text-black/60 dark:text-white/60 max-w-xl">
            Project requests with budget + type. Open details and update status.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button
              type="button"
              class="inline-flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-4 py-2.5 text-sm hover:bg-black/10 dark:hover:bg-white/10 transition"
              @click="load"
          >
            <UIcon name="i-heroicons-arrow-path" class="h-5 w-5 opacity-80" />
            Refresh
          </button>

          <div class="inline-flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2.5">
            <UIcon name="i-heroicons-list-bullet" class="h-4 w-4 opacity-70" />
            <span class="text-xs text-black/60 dark:text-white/60">Limit</span>
            <input
                v-model.number="limit"
                type="number"
                min="10"
                max="500"
                class="w-24 bg-transparent text-sm text-black dark:text-white outline-none"
                @change="load"
            />
          </div>
        </div>
      </div>

      <!-- Stats -->
      <div class="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2">
        <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-3">
          <div class="text-[11px] text-black/60 dark:text-white/60">Total</div>
          <div class="mt-1 text-lg font-extrabold text-black dark:text-white tabular-nums">{{ stats.total }}</div>
        </div>

        <div class="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3">
          <div class="text-[11px] text-amber-900/70 dark:text-amber-200/80">New</div>
          <div class="mt-1 text-lg font-extrabold text-amber-900 dark:text-amber-100 tabular-nums">{{ stats.new }}</div>
        </div>

        <div class="rounded-2xl border border-sky-500/20 bg-sky-500/10 p-3">
          <div class="text-[11px] text-sky-900/70 dark:text-sky-200/80">Read</div>
          <div class="mt-1 text-lg font-extrabold text-sky-900 dark:text-sky-100 tabular-nums">{{ stats.read }}</div>
        </div>

        <div class="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3">
          <div class="text-[11px] text-emerald-900/70 dark:text-emerald-200/80">Done</div>
          <div class="mt-1 text-lg font-extrabold text-emerald-900 dark:text-emerald-100 tabular-nums">{{ stats.done }}</div>
        </div>

        <div class="rounded-2xl border border-zinc-500/20 bg-zinc-500/10 p-3">
          <div class="text-[11px] text-zinc-800/70 dark:text-zinc-200/80">Archived</div>
          <div class="mt-1 text-lg font-extrabold text-zinc-900 dark:text-zinc-100 tabular-nums">{{ stats.archived }}</div>
        </div>
      </div>

      <!-- Controls -->
      <div class="mt-3 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3">
        <!-- Search -->
        <div
            class="flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2.5 backdrop-blur"
        >
          <UIcon name="i-heroicons-magnifying-glass" class="h-5 w-5 opacity-60" />
          <input
              v-model="q"
              type="text"
              placeholder="Search name, email, type, budget, message…"
              class="w-full bg-transparent text-sm outline-none text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40"
          />
          <button
              v-if="q.trim()"
              type="button"
              class="rounded-xl px-2 py-1 text-xs border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition"
              @click="q = ''"
          >
            Clear
          </button>
        </div>

        <!-- Status filter -->
        <div
            class="inline-flex flex-wrap items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-1.5 backdrop-blur"
        >
          <button
              type="button"
              class="px-3 py-2 rounded-xl text-sm transition"
              :class="statusFilter === 'all'
              ? 'bg-black/10 dark:bg-white/10 text-black dark:text-white'
              : 'text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white'"
              @click="statusFilter = 'all'"
          >
            All
          </button>

          <button
              type="button"
              class="px-3 py-2 rounded-xl text-sm transition"
              :class="statusFilter === 'new'
              ? 'bg-amber-500/15 text-amber-800 dark:text-amber-200'
              : 'text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white'"
              @click="statusFilter = 'new'"
          >
            New
          </button>

          <button
              type="button"
              class="px-3 py-2 rounded-xl text-sm transition"
              :class="statusFilter === 'read'
              ? 'bg-sky-500/15 text-sky-800 dark:text-sky-200'
              : 'text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white'"
              @click="statusFilter = 'read'"
          >
            Read
          </button>

          <button
              type="button"
              class="px-3 py-2 rounded-xl text-sm transition"
              :class="statusFilter === 'done'
              ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200'
              : 'text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white'"
              @click="statusFilter = 'done'"
          >
            Done
          </button>

          <button
              type="button"
              class="px-3 py-2 rounded-xl text-sm transition"
              :class="statusFilter === 'archived'
              ? 'bg-zinc-500/15 text-zinc-800 dark:text-zinc-200'
              : 'text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white'"
              @click="statusFilter = 'archived'"
          >
            Archived
          </button>
        </div>
      </div>

      <!-- Summary -->
      <div class="mt-3 flex flex-wrap items-center gap-2 text-xs text-black/60 dark:text-white/60">
        <span class="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-1.5">
          <UIcon name="i-heroicons-queue-list" class="h-4 w-4 opacity-70" />
          Showing <span class="font-semibold text-black dark:text-white">{{ filtered.length }}</span>
          of <span class="font-semibold text-black dark:text-white">{{ rows.length }}</span>
        </span>

        <span v-if="loading" class="inline-flex items-center gap-2 rounded-full px-3 py-1.5 border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
          <span class="h-2 w-2 rounded-full animate-pulse bg-cyan-400" />
          Loading…
        </span>
      </div>
    </div>

    <!-- Table card -->
    <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur overflow-hidden">
      <div v-if="errorMsg" class="p-4">
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

      <div v-else class="overflow-auto">
        <table class="w-full text-sm">
          <thead class="text-black/60 dark:text-white/60">
          <tr class="text-left border-b border-black/10 dark:border-white/10">
            <th class="py-3 px-4">Request</th>
            <th class="py-3 px-4 hidden lg:table-cell">Type</th>
            <th class="py-3 px-4 hidden lg:table-cell">Budget</th>
            <th class="py-3 px-4">Status</th>
            <th class="py-3 px-4 hidden md:table-cell">Created</th>
            <th class="py-3 px-4 text-right">Open</th>
          </tr>
          </thead>

          <tbody>
          <tr
              v-for="r in filtered"
              :key="r.id"
              class="border-b border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition"
          >
            <td class="py-3 px-4 min-w-[280px]">
              <div class="flex items-start gap-3">
                <div class="mt-1 h-10 w-10 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 grid place-items-center">
                  <UIcon name="i-heroicons-clipboard-document" class="h-5 w-5 opacity-70" />
                </div>

                <div class="min-w-0">
                  <div class="font-semibold text-black dark:text-white truncate">
                    {{ r.name }}
                    <span class="font-normal text-black/50 dark:text-white/50">• {{ r.email }}</span>
                  </div>

                  <div class="mt-1 text-xs text-black/60 dark:text-white/60">
                    {{ short(r.message, 120) }}
                  </div>

                  <div class="mt-2 flex flex-wrap items-center gap-2 lg:hidden">
                      <span class="rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-2.5 py-1 text-[11px] text-black/70 dark:text-white/70">
                        {{ r.project_type }}
                      </span>
                    <span class="rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-2.5 py-1 text-[11px] text-black/70 dark:text-white/70">
                        {{ r.budget }}
                      </span>
                  </div>
                </div>
              </div>
            </td>

            <td class="py-3 px-4 hidden lg:table-cell">
                <span class="rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-1.5 text-xs text-black/70 dark:text-white/70">
                  {{ r.project_type }}
                </span>
            </td>

            <td class="py-3 px-4 hidden lg:table-cell">
                <span class="rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-1.5 text-xs text-black/70 dark:text-white/70">
                  {{ r.budget }}
                </span>
            </td>

            <td class="py-3 px-4">
                <span
                    class="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
                    :class="statusPillClass(r.status)"
                >
                  <span class="h-1.5 w-1.5 rounded-full" :class="statusDotClass(r.status)" />
                  {{ r.status }}
                </span>
            </td>

            <td class="py-3 px-4 hidden md:table-cell text-black/60 dark:text-white/60 whitespace-nowrap">
              {{ fmtDate(r.created_at) }}
            </td>

            <td class="py-3 px-4 text-right">
              <button
                  type="button"
                  class="inline-flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-2 text-xs hover:bg-black/10 dark:hover:bg-white/10 transition"
                  @click="openRow(r)"
              >
                <UIcon name="i-heroicons-arrow-top-right-on-square" class="h-4 w-4" />
                View
              </button>
            </td>
          </tr>

          <tr v-if="!loading && filtered.length === 0">
            <td colspan="6" class="py-10 text-center text-black/60 dark:text-white/60">
              No requests found.
            </td>
          </tr>

          <tr v-if="loading">
            <td colspan="6" class="py-8">
              <div class="px-4 grid gap-2">
                <div class="h-10 rounded-2xl bg-black/10 dark:bg-white/10 animate-pulse" />
                <div class="h-10 rounded-2xl bg-black/10 dark:bg-white/10 animate-pulse" />
                <div class="h-10 rounded-2xl bg-black/10 dark:bg-white/10 animate-pulse" />
              </div>
            </td>
          </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Detail Modal (custom) -->
    <div
        v-if="modalOpen && selected"
        class="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center p-0 sm:p-6"
        role="dialog"
        aria-modal="true"
    >
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="closeModal" />

      <div
          class="relative w-full sm:max-w-3xl rounded-t-3xl sm:rounded-3xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#0b1020] shadow-[0_30px_100px_rgba(0,0,0,.35)] overflow-hidden"
      >
        <!-- Header -->
        <div class="p-4 sm:p-5 border-b border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <div class="text-lg font-extrabold tracking-tight text-black dark:text-white truncate">
                  {{ selected.name }}
                </div>

                <span
                    class="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
                    :class="statusPillClass(selected.status)"
                >
                  <span class="h-1.5 w-1.5 rounded-full" :class="statusDotClass(selected.status)" />
                  {{ selected.status }}
                </span>

                <span
                    class="rounded-full border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 py-1.5 text-xs text-black/60 dark:text-white/60"
                >
                  {{ fmtDate(selected.created_at) }}
                </span>
              </div>

              <div class="mt-1 text-sm text-black/60 dark:text-white/60 break-all">
                {{ selected.email }}
              </div>
            </div>

            <button
                type="button"
                class="shrink-0 inline-flex items-center justify-center h-10 w-10 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition"
                @click="closeModal"
            >
              <UIcon name="i-heroicons-x-mark" class="h-5 w-5" />
            </button>
          </div>
        </div>

        <!-- Body -->
        <div class="p-4 sm:p-5 grid gap-4">
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4">
              <div class="text-xs text-black/60 dark:text-white/60">Project type</div>
              <div class="mt-1 text-sm font-semibold text-black dark:text-white">
                {{ selected.project_type }}
              </div>
            </div>

            <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4">
              <div class="text-xs text-black/60 dark:text-white/60">Budget</div>
              <div class="mt-1 text-sm font-semibold text-black dark:text-white">
                {{ selected.budget }}
              </div>
            </div>

            <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4">
              <div class="text-xs text-black/60 dark:text-white/60">Source</div>
              <div class="mt-1 text-sm font-semibold text-black dark:text-white">
                {{ selected.source }}
              </div>
            </div>
          </div>

          <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4">
            <div class="flex items-center justify-between gap-2">
              <div class="text-xs text-black/60 dark:text-white/60">Message</div>
              <button
                  type="button"
                  class="inline-flex items-center gap-2 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-2 text-xs hover:bg-black/10 dark:hover:bg-white/10 transition"
                  @click="copy(selected.message)"
              >
                <UIcon name="i-heroicons-clipboard" class="h-4 w-4" />
                Copy
              </button>
            </div>

            <div class="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-black dark:text-white">
              {{ selected.message }}
            </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4">
              <div class="text-xs text-black/60 dark:text-white/60">IP</div>
              <div class="mt-1 text-sm font-semibold text-black dark:text-white break-all">
                {{ selected.ip || '—' }}
              </div>
            </div>

            <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4">
              <div class="text-xs text-black/60 dark:text-white/60">User agent</div>
              <div class="mt-1 text-sm font-semibold text-black dark:text-white break-words">
                {{ selected.user_agent || '—' }}
              </div>
            </div>
          </div>

          <!-- Status actions -->
          <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-4">
            <div class="text-xs text-black/60 dark:text-white/60">Status actions</div>
            <div class="mt-2 flex flex-wrap gap-2">
              <button
                  type="button"
                  class="inline-flex items-center gap-2 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-900 dark:text-amber-200 hover:bg-amber-500/15 transition disabled:opacity-60"
                  :disabled="updating || selected.status === 'new'"
                  @click="setStatus('new')"
              >
                <span v-if="updating && selected.status !== 'new'" class="h-4 w-4 rounded-full border-2 border-amber-400/40 border-t-amber-400 animate-spin" />
                <UIcon v-else name="i-heroicons-sparkles" class="h-5 w-5" />
                Mark new
              </button>

              <button
                  type="button"
                  class="inline-flex items-center gap-2 rounded-2xl border border-sky-500/25 bg-sky-500/10 px-4 py-2.5 text-sm font-semibold text-sky-900 dark:text-sky-200 hover:bg-sky-500/15 transition disabled:opacity-60"
                  :disabled="updating || selected.status === 'read'"
                  @click="setStatus('read')"
              >
                <span v-if="updating && selected.status !== 'read'" class="h-4 w-4 rounded-full border-2 border-sky-400/40 border-t-sky-400 animate-spin" />
                <UIcon v-else name="i-heroicons-eye" class="h-5 w-5" />
                Mark read
              </button>

              <button
                  type="button"
                  class="inline-flex items-center gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-900 dark:text-emerald-200 hover:bg-emerald-500/15 transition disabled:opacity-60"
                  :disabled="updating || selected.status === 'done'"
                  @click="setStatus('done')"
              >
                <span v-if="updating && selected.status !== 'done'" class="h-4 w-4 rounded-full border-2 border-emerald-400/40 border-t-emerald-400 animate-spin" />
                <UIcon v-else name="i-heroicons-check-badge" class="h-5 w-5" />
                Mark done
              </button>

              <button
                  type="button"
                  class="inline-flex items-center gap-2 rounded-2xl border border-zinc-500/25 bg-zinc-500/10 px-4 py-2.5 text-sm font-semibold text-zinc-900 dark:text-zinc-200 hover:bg-zinc-500/15 transition disabled:opacity-60"
                  :disabled="updating || selected.status === 'archived'"
                  @click="setStatus('archived')"
              >
                <span v-if="updating && selected.status !== 'archived'" class="h-4 w-4 rounded-full border-2 border-zinc-400/40 border-t-zinc-400 animate-spin" />
                <UIcon v-else name="i-heroicons-archive-box" class="h-5 w-5" />
                Archive
              </button>

              <button
                  type="button"
                  class="ml-auto inline-flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-4 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition"
                  @click="mailTo(selected.email)"
              >
                <UIcon name="i-heroicons-envelope" class="h-5 w-5" />
                Email
              </button>
            </div>

            <div class="mt-3 text-xs text-black/60 dark:text-white/60">
              Tip: use "Read" when you’ve seen it, "Done" after you’ve replied, and "Archived" to hide.
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="p-4 sm:p-5 border-t border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 flex flex-wrap gap-2 justify-end">
          <button
              type="button"
              class="inline-flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-4 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition"
              @click="copy(selected.id)"
          >
            <UIcon name="i-heroicons-clipboard" class="h-5 w-5" />
            Copy request id
          </button>

          <button
              type="button"
              class="inline-flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-4 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition"
              @click="closeModal"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
