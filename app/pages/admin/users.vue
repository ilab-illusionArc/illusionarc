<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: ['admin']
})

useHead({ title: 'Admin — Users' })

const toast = useToast()
const supabase = useSupabaseClient()

type Role = 'user' | 'admin'
type ProfileRow = {
  user_id: string
  display_name: string
  avatar_url: string | null
  updated_at: string
  role: Role
}

const loading = ref(true)
const errorMsg = ref<string | null>(null)

const q = ref('')
const roleFilter = ref<Role | 'all'>('all')
const limit = ref(100)

const rows = ref<ProfileRow[]>([])

const selected = ref<ProfileRow | null>(null)
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

function rolePillClass(r: Role) {
  return r === 'admin'
      ? 'bg-rose-500/10 text-rose-700 dark:text-rose-200 border-rose-500/20'
      : 'bg-sky-500/10 text-sky-700 dark:text-sky-200 border-sky-500/20'
}

function avatarFallback(name: string) {
  const s = (name || '').trim()
  if (!s) return 'U'
  const parts = s.split(/\s+/g)
  const a = parts[0]?.[0] ?? 'U'
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : ''
  return (a + b).toUpperCase()
}

const filtered = computed(() => {
  const needle = q.value.trim()
  let list = rows.value

  if (roleFilter.value !== 'all') {
    list = list.filter((r) => r.role === roleFilter.value)
  }

  if (needle) {
    list = list.filter((r) => {
      const s = `${r.display_name} ${r.user_id} ${r.role}`.trim()
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
        .from('profiles')
        .select('user_id, display_name, avatar_url, updated_at, role')
        .order('updated_at', { ascending: false })
        .limit(lim)

    if (error) throw error
    rows.value = (data || []) as unknown as ProfileRow[]
  } catch (e: any) {
    errorMsg.value = e?.message || 'Failed to load users.'
  } finally {
    loading.value = false
  }
}

onMounted(load)

function openRow(r: ProfileRow) {
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

async function setRole(next: Role): Promise<void> {
  if (!selected.value) return
  if (updating.value) return
  if (selected.value.role === next) return

  updating.value = true
  try {
    const id = selected.value.user_id

    // ✅ minimal payload avoids TS "never" issues
    const { error } = await supabase.from('profiles').update({ role: next }).eq('user_id', id)
    if (error) throw error

    rows.value = rows.value.map((r) => (r.user_id === id ? { ...r, role: next, updated_at: new Date().toISOString() } : r))
    selected.value = { ...selected.value, role: next, updated_at: new Date().toISOString() }

    toast.add({
      title: 'Role updated',
      description: `User is now "${next}".`,
      color: next === 'admin' ? 'warning' : 'info'
    })
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
      <div
          class="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full blur-3xl opacity-60"
          style="background: radial-gradient(circle at 30% 30%, rgba(34,197,94,.22), transparent 60%);"
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
            <UIcon name="i-heroicons-users" class="h-4 w-4" />
            Profiles
          </div>

          <h1 class="mt-3 text-2xl lg:text-3xl font-extrabold tracking-tight text-black dark:text-white">
            Users
          </h1>
          <p class="mt-1 text-sm text-black/60 dark:text-white/60 max-w-xl">
            View profiles and manage roles (admin / user).
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
              placeholder="Search display name or user id…"
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

        <!-- Role filter -->
        <div
            class="inline-flex flex-wrap items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-1.5 backdrop-blur"
        >
          <button
              type="button"
              class="px-3 py-2 rounded-xl text-sm transition"
              :class="roleFilter === 'all'
              ? 'bg-black/10 dark:bg-white/10 text-black dark:text-white'
              : 'text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white'"
              @click="roleFilter = 'all'"
          >
            All
          </button>

          <button
              type="button"
              class="px-3 py-2 rounded-xl text-sm transition"
              :class="roleFilter === 'user'
              ? 'bg-sky-500/15 text-sky-800 dark:text-sky-200'
              : 'text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white'"
              @click="roleFilter = 'user'"
          >
            Users
          </button>

          <button
              type="button"
              class="px-3 py-2 rounded-xl text-sm transition"
              :class="roleFilter === 'admin'
              ? 'bg-rose-500/15 text-rose-800 dark:text-rose-200'
              : 'text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white'"
              @click="roleFilter = 'admin'"
          >
            Admins
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
            <th class="py-3 px-4">User</th>
            <th class="py-3 px-4 hidden md:table-cell">User ID</th>
            <th class="py-3 px-4">Role</th>
            <th class="py-3 px-4 hidden lg:table-cell">Updated</th>
            <th class="py-3 px-4 text-right">Manage</th>
          </tr>
          </thead>

          <tbody>
          <tr
              v-for="r in filtered"
              :key="r.user_id"
              class="border-b border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition"
          >
            <td class="py-3 px-4 min-w-[240px]">
              <div class="flex items-center gap-3">
                <div
                    class="h-10 w-10 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 grid place-items-center overflow-hidden"
                >
                  <img
                      v-if="r.avatar_url"
                      :src="r.avatar_url"
                      alt=""
                      class="h-full w-full object-cover"
                  />
                  <span v-else class="text-xs font-extrabold text-black/70 dark:text-white/70">
                      {{ avatarFallback(r.display_name) }}
                    </span>
                </div>

                <div class="min-w-0">
                  <div class="font-semibold text-black dark:text-white truncate">
                    {{ r.display_name }}
                  </div>
                  <div class="text-xs text-black/60 dark:text-white/60 md:hidden break-all">
                    {{ r.user_id }}
                  </div>
                </div>
              </div>
            </td>

            <td class="py-3 px-4 hidden md:table-cell font-mono text-xs text-black/60 dark:text-white/60">
              {{ r.user_id }}
            </td>

            <td class="py-3 px-4">
                <span
                    class="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
                    :class="rolePillClass(r.role)"
                >
                  <span class="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                  {{ r.role }}
                </span>
            </td>

            <td class="py-3 px-4 hidden lg:table-cell text-black/60 dark:text-white/60 whitespace-nowrap">
              {{ fmtDate(r.updated_at) }}
            </td>

            <td class="py-3 px-4 text-right">
              <div class="inline-flex gap-2 justify-end">
                <button
                    type="button"
                    class="inline-flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-2 text-xs hover:bg-black/10 dark:hover:bg-white/10 transition"
                    @click="copy(r.user_id)"
                >
                  <UIcon name="i-heroicons-clipboard" class="h-4 w-4" />
                  Copy ID
                </button>

                <button
                    type="button"
                    class="inline-flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-2 text-xs hover:bg-black/10 dark:hover:bg-white/10 transition"
                    @click="openRow(r)"
                >
                  <UIcon name="i-heroicons-cog-6-tooth" class="h-4 w-4" />
                  Manage
                </button>
              </div>
            </td>
          </tr>

          <tr v-if="!loading && filtered.length === 0">
            <td colspan="5" class="py-10 text-center text-black/60 dark:text-white/60">
              No users found.
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

    <!-- Manage Modal (custom) -->
    <div
        v-if="modalOpen && selected"
        class="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center p-0 sm:p-6"
        role="dialog"
        aria-modal="true"
    >
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="closeModal" />

      <div
          class="relative w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#0b1020] shadow-[0_30px_100px_rgba(0,0,0,.35)] overflow-hidden"
      >
        <div class="p-4 sm:p-5 border-b border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <div class="text-lg font-extrabold tracking-tight text-black dark:text-white truncate">
                  {{ selected.display_name }}
                </div>

                <span
                    class="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
                    :class="rolePillClass(selected.role)"
                >
                  <span class="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                  {{ selected.role }}
                </span>
              </div>

              <div class="mt-1 text-xs text-black/60 dark:text-white/60 font-mono break-all">
                {{ selected.user_id }}
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

        <div class="p-4 sm:p-5 grid gap-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4">
              <div class="text-xs text-black/60 dark:text-white/60">Updated</div>
              <div class="mt-1 text-sm font-semibold text-black dark:text-white">
                {{ fmtDate(selected.updated_at) }}
              </div>

              <div class="mt-3 flex flex-wrap gap-2">
                <button
                    type="button"
                    class="inline-flex items-center gap-2 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-2 text-xs hover:bg-black/10 dark:hover:bg-white/10 transition"
                    @click="copy(selected.user_id)"
                >
                  <UIcon name="i-heroicons-clipboard" class="h-4 w-4" />
                  Copy user id
                </button>
              </div>
            </div>

            <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4">
              <div class="text-xs text-black/60 dark:text-white/60">Avatar</div>

              <div class="mt-2 flex items-center gap-3">
                <div
                    class="h-14 w-14 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 grid place-items-center overflow-hidden"
                >
                  <img v-if="selected.avatar_url" :src="selected.avatar_url" class="h-full w-full object-cover" alt="" />
                  <span v-else class="text-sm font-extrabold text-black/70 dark:text-white/70">
                    {{ avatarFallback(selected.display_name) }}
                  </span>
                </div>

                <div class="min-w-0">
                  <div class="text-sm font-semibold text-black dark:text-white">
                    {{ selected.avatar_url ? 'Has avatar' : 'No avatar' }}
                  </div>
                  <div class="text-xs text-black/60 dark:text-white/60 break-all">
                    {{ selected.avatar_url || '—' }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- role actions -->
          <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-4">
            <div class="text-xs text-black/60 dark:text-white/60">Role actions</div>
            <div class="mt-2 flex flex-wrap gap-2">
              <button
                  type="button"
                  class="inline-flex items-center gap-2 rounded-2xl border border-sky-500/25 bg-sky-500/10 px-4 py-2.5 text-sm font-semibold text-sky-800 dark:text-sky-200 hover:bg-sky-500/15 transition disabled:opacity-60"
                  :disabled="updating || selected.role === 'user'"
                  @click="setRole('user')"
              >
                <span v-if="updating && selected.role !== 'user'" class="h-4 w-4 rounded-full border-2 border-sky-400/40 border-t-sky-400 animate-spin" />
                <UIcon v-else name="i-heroicons-user" class="h-5 w-5" />
                Set user
              </button>

              <button
                  type="button"
                  class="inline-flex items-center gap-2 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-800 dark:text-rose-200 hover:bg-rose-500/15 transition disabled:opacity-60"
                  :disabled="updating || selected.role === 'admin'"
                  @click="setRole('admin')"
              >
                <span v-if="updating && selected.role !== 'admin'" class="h-4 w-4 rounded-full border-2 border-rose-400/40 border-t-rose-400 animate-spin" />
                <UIcon v-else name="i-heroicons-shield-check" class="h-5 w-5" />
                Set admin
              </button>
            </div>

            <div class="mt-3 text-xs text-black/60 dark:text-white/60">
              Note: Only admins should be able to change roles (RLS policy required).
            </div>
          </div>
        </div>

        <div class="p-4 sm:p-5 border-t border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 flex justify-end">
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
