<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: ['admin']
})

useHead({ title: 'Admin — Messages' })

const toast = useToast()
const supabase = useSupabaseClient()

type MsgStatus = 'new' | 'open' | 'resolved'
type ContactMessageRow = {
  id: string
  created_at: string
  name: string
  email: string
  subject: string | null
  message: string
  source: string
  status: MsgStatus
  user_agent: string | null
  ip: string | null
  user_id: string | null
  project_type: string | null
  budget: string | null
}

const loading = ref(true)
const errorMsg = ref<string | null>(null)

const q = ref('')
const statusFilter = ref<MsgStatus | 'all'>('all')
const limit = ref(50)

const rows = ref<ContactMessageRow[]>([])

const selected = ref<ContactMessageRow | null>(null)
const modalOpen = ref(false)

const updating = ref(false)

function clampLimit(n: number) {
  if (!Number.isFinite(n)) return 50
  return Math.max(10, Math.min(Math.floor(n), 200))
}

function fmtDate(ts?: string) {
  if (!ts) return ''
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ts
  return d.toLocaleString()
}

function statusPillClass(s: MsgStatus) {
  // no "green"/"amber" etc — use tailwind classes
  if (s === 'new') return 'bg-violet-500/10 text-violet-600 dark:text-violet-300 border-violet-500/20'
  if (s === 'open') return 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20'
  return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
}

function safeContains(hay: string, needle: string) {
  return hay.toLowerCase().includes(needle.toLowerCase())
}

const filtered = computed(() => {
  const needle = q.value.trim()
  let list = rows.value

  if (statusFilter.value !== 'all') {
    list = list.filter((r) => r.status === statusFilter.value)
  }

  if (needle) {
    list = list.filter((r) => {
      const s =
          `${r.name} ${r.email} ${r.subject ?? ''} ${r.message} ${r.source} ${r.project_type ?? ''} ${r.budget ?? ''}`.trim()
      return safeContains(s, needle)
    })
  }

  return list
})

async function load(): Promise<void> {
  loading.value = true
  errorMsg.value = null
  rows.value = []

  try {
    const lim = clampLimit(limit.value)

    const { data, error } = await supabase
        .from('contact_messages')
        .select(
            'id, created_at, name, email, subject, message, source, status, user_agent, ip, user_id, project_type, budget'
        )
        .order('created_at', { ascending: false })
        .limit(lim)

    if (error) throw error

    rows.value = (data || []) as unknown as ContactMessageRow[]
  } catch (e: any) {
    errorMsg.value = e?.message || 'Failed to load messages.'
  } finally {
    loading.value = false
  }
}

onMounted(load)

function openRow(r: ContactMessageRow) {
  selected.value = r
  modalOpen.value = true
}

function closeModal() {
  modalOpen.value = false
  selected.value = null
}

async function setStatus(next: MsgStatus): Promise<void> {
  if (!selected.value) return
  if (updating.value) return

  updating.value = true
  try {
    const id = selected.value.id

    // ✅ avoid "never" by using explicit match and minimal payload
    const { error } = await supabase.from('contact_messages').update({ status: next }).eq('id', id)

    if (error) throw error

    // update local list
    rows.value = rows.value.map((r) => (r.id === id ? { ...r, status: next } : r))
    selected.value = { ...selected.value, status: next }

    toast.add({
      title: 'Status updated',
      description: `Message marked as "${next}".`,
      color: next === 'resolved' ? 'success' : next === 'open' ? 'info' : 'primary'
    })
  } catch (e: any) {
    toast.add({ title: 'Update failed', description: e?.message || 'Try again.', color: 'error' })
  } finally {
    updating.value = false
  }
}

function copy(v: string) {
  if (!import.meta.client) return
  navigator.clipboard.writeText(v).then(
      () => toast.add({ title: 'Copied', description: v, color: 'success' }),
      () => toast.add({ title: 'Copy failed', description: 'Your browser blocked it.', color: 'warning' })
  )
}

function mailto(email: string, subject?: string | null) {
  const s = encodeURIComponent(subject || 'Hello')
  const url = `mailto:${encodeURIComponent(email)}?subject=${s}`
  if (import.meta.client) window.location.href = url
}
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div
        class="relative overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-5 lg:p-6 backdrop-blur"
    >
      <div
          class="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full blur-3xl opacity-60"
          style="background: radial-gradient(circle at 30% 30%, rgba(34,211,238,.22), transparent 60%);"
          aria-hidden="true"
      />
      <div
          class="pointer-events-none absolute -bottom-28 -left-28 h-80 w-80 rounded-full blur-3xl opacity-60"
          style="background: radial-gradient(circle at 30% 30%, rgba(124,58,237,.22), transparent 60%);"
          aria-hidden="true"
      />

      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="min-w-0">
          <div
              class="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-1.5 text-xs text-black/60 dark:text-white/60"
          >
            <UIcon name="i-heroicons-inbox" class="h-4 w-4" />
            Inbox
          </div>

          <h1 class="mt-3 text-2xl lg:text-3xl font-extrabold tracking-tight text-black dark:text-white">
            Contact Messages
          </h1>
          <p class="mt-1 text-sm text-black/60 dark:text-white/60 max-w-xl">
            Search, open details, and update status without leaving the page.
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

          <div
              class="inline-flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2.5"
          >
            <UIcon name="i-heroicons-list-bullet" class="h-4 w-4 opacity-70" />
            <span class="text-xs text-black/60 dark:text-white/60">Limit</span>
            <input
                v-model.number="limit"
                type="number"
                min="10"
                max="200"
                class="w-20 bg-transparent text-sm text-black dark:text-white outline-none"
                @change="load"
            />
          </div>
        </div>
      </div>

      <!-- Controls -->
      <div class="mt-4 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3">
        <!-- Search -->
        <div
            class="flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2.5 backdrop-blur"
        >
          <UIcon name="i-heroicons-magnifying-glass" class="h-5 w-5 opacity-60" />
          <input
              v-model="q"
              type="text"
              placeholder="Search name, email, subject, message, source…"
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
              ? 'bg-violet-500/15 text-violet-700 dark:text-violet-200'
              : 'text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white'"
              @click="statusFilter = 'new'"
          >
            New
          </button>

          <button
              type="button"
              class="px-3 py-2 rounded-xl text-sm transition"
              :class="statusFilter === 'open'
              ? 'bg-cyan-500/15 text-cyan-800 dark:text-cyan-200'
              : 'text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white'"
              @click="statusFilter = 'open'"
          >
            Open
          </button>

          <button
              type="button"
              class="px-3 py-2 rounded-xl text-sm transition"
              :class="statusFilter === 'resolved'
              ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200'
              : 'text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white'"
              @click="statusFilter = 'resolved'"
          >
            Resolved
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
            <th class="py-3 px-4">When</th>
            <th class="py-3 px-4">From</th>
            <th class="py-3 px-4 hidden md:table-cell">Subject</th>
            <th class="py-3 px-4">Status</th>
            <th class="py-3 px-4 text-right">Open</th>
          </tr>
          </thead>

          <tbody>
          <tr
              v-for="r in filtered"
              :key="r.id"
              class="border-b border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition"
          >
            <td class="py-3 px-4 whitespace-nowrap text-black/70 dark:text-white/70">
              {{ fmtDate(r.created_at) }}
            </td>

            <td class="py-3 px-4 min-w-[220px]">
              <div class="font-semibold text-black dark:text-white">{{ r.name }}</div>
              <div class="text-xs text-black/60 dark:text-white/60">{{ r.email }}</div>
            </td>

            <td class="py-3 px-4 hidden md:table-cell">
              <div class="text-black dark:text-white line-clamp-1">
                {{ r.subject || '—' }}
              </div>
              <div class="text-xs text-black/60 dark:text-white/60 line-clamp-1">
                {{ r.message }}
              </div>
            </td>

            <td class="py-3 px-4">
                <span
                    class="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
                    :class="statusPillClass(r.status)"
                >
                  <span class="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                  {{ r.status }}
                </span>
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
            <td colspan="5" class="py-10 text-center text-black/60 dark:text-white/60">
              No messages found.
            </td>
          </tr>

          <tr v-if="loading">
            <td colspan="5" class="py-8">
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

    <!-- Detail Modal (custom, not UModal — avoids width/ui typing issues) -->
    <div
        v-if="modalOpen && selected"
        class="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center p-0 sm:p-6"
        role="dialog"
        aria-modal="true"
    >
      <!-- overlay -->
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="closeModal" />

      <!-- sheet/card -->
      <div
          class="relative w-full sm:max-w-3xl rounded-t-3xl sm:rounded-3xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#0b1020] shadow-[0_30px_100px_rgba(0,0,0,.35)] overflow-hidden"
      >
        <!-- header -->
        <div class="p-4 sm:p-5 border-b border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <div class="text-lg font-extrabold tracking-tight text-black dark:text-white truncate">
                  {{ selected.subject || 'Message' }}
                </div>
                <span
                    class="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
                    :class="statusPillClass(selected.status)"
                >
                  <span class="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                  {{ selected.status }}
                </span>
              </div>

              <div class="mt-1 text-xs text-black/60 dark:text-white/60">
                {{ fmtDate(selected.created_at) }} • {{ selected.source }}
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

        <!-- body -->
        <div class="p-4 sm:p-5 grid gap-4">
          <!-- person -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-4">
              <div class="text-xs text-black/60 dark:text-white/60">From</div>
              <div class="mt-1 font-semibold text-black dark:text-white">{{ selected.name }}</div>
              <div class="mt-1 text-sm text-black/70 dark:text-white/70 break-all">{{ selected.email }}</div>

              <div class="mt-3 flex flex-wrap gap-2">
                <button
                    type="button"
                    class="inline-flex items-center gap-2 rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2 text-xs hover:bg-black/5 dark:hover:bg-white/10 transition"
                    @click="mailto(selected.email, selected.subject)"
                >
                  <UIcon name="i-heroicons-envelope" class="h-4 w-4" />
                  Reply
                </button>

                <button
                    type="button"
                    class="inline-flex items-center gap-2 rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2 text-xs hover:bg-black/5 dark:hover:bg-white/10 transition"
                    @click="copy(selected.email)"
                >
                  <UIcon name="i-heroicons-clipboard" class="h-4 w-4" />
                  Copy email
                </button>
              </div>
            </div>

            <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-4">
              <div class="text-xs text-black/60 dark:text-white/60">Project details</div>

              <div class="mt-2 grid gap-2 text-sm">
                <div class="flex items-center justify-between gap-3">
                  <div class="text-black/60 dark:text-white/60">Type</div>
                  <div class="font-semibold text-black dark:text-white">
                    {{ selected.project_type || '—' }}
                  </div>
                </div>

                <div class="flex items-center justify-between gap-3">
                  <div class="text-black/60 dark:text-white/60">Budget</div>
                  <div class="font-semibold text-black dark:text-white">
                    {{ selected.budget || '—' }}
                  </div>
                </div>

                <div class="flex items-center justify-between gap-3">
                  <div class="text-black/60 dark:text-white/60">User</div>
                  <div class="font-semibold text-black dark:text-white break-all">
                    {{ selected.user_id || '—' }}
                  </div>
                </div>

                <div class="flex items-center justify-between gap-3">
                  <div class="text-black/60 dark:text-white/60">IP</div>
                  <div class="font-semibold text-black dark:text-white">
                    {{ selected.ip || '—' }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- message -->
          <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4">
            <div class="text-xs text-black/60 dark:text-white/60">Message</div>
            <div class="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-black dark:text-white">
              {{ selected.message }}
            </div>
          </div>
        </div>

        <!-- footer -->
        <div class="p-4 sm:p-5 border-t border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="text-xs text-black/60 dark:text-white/60">
              Update status:
            </div>

            <div class="flex flex-wrap gap-2">
              <button
                  type="button"
                  class="inline-flex items-center gap-2 rounded-2xl border border-violet-500/25 bg-violet-500/10 px-4 py-2.5 text-sm font-semibold text-violet-700 dark:text-violet-200 hover:bg-violet-500/15 transition disabled:opacity-60"
                  :disabled="updating || selected.status === 'new'"
                  @click="setStatus('new')"
              >
                <span v-if="updating && selected.status !== 'new'" class="h-4 w-4 rounded-full border-2 border-violet-400/40 border-t-violet-400 animate-spin" />
                <UIcon v-else name="i-heroicons-sparkles" class="h-5 w-5" />
                New
              </button>

              <button
                  type="button"
                  class="inline-flex items-center gap-2 rounded-2xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-800 dark:text-cyan-200 hover:bg-cyan-500/15 transition disabled:opacity-60"
                  :disabled="updating || selected.status === 'open'"
                  @click="setStatus('open')"
              >
                <span v-if="updating && selected.status !== 'open'" class="h-4 w-4 rounded-full border-2 border-cyan-400/40 border-t-cyan-400 animate-spin" />
                <UIcon v-else name="i-heroicons-eye" class="h-5 w-5" />
                Open
              </button>

              <button
                  type="button"
                  class="inline-flex items-center gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-800 dark:text-emerald-200 hover:bg-emerald-500/15 transition disabled:opacity-60"
                  :disabled="updating || selected.status === 'resolved'"
                  @click="setStatus('resolved')"
              >
                <span v-if="updating && selected.status !== 'resolved'" class="h-4 w-4 rounded-full border-2 border-emerald-400/40 border-t-emerald-400 animate-spin" />
                <UIcon v-else name="i-heroicons-check-badge" class="h-5 w-5" />
                Resolved
              </button>
            </div>
          </div>

          <div class="mt-3 flex items-center justify-end gap-2">
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
  </div>
</template>
