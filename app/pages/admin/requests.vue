<script setup lang="ts">
definePageMeta({ layout: 'admin' })
useHead({ title: 'Admin · Requests — illusion Arc' })

type ReqStatus = 'new' | 'seen' | 'done'

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

const supabase = useSupabaseClient()
const sb: any = supabase // avoids "never" typing without generated Database types
const toast = useToast()

const loading = ref(true)
const saving = ref<string | null>(null)

const q = ref('')
const statusFilter = ref<'all' | ReqStatus>('all')
const sourceFilter = ref<'all' | string>('all')
const sort = ref<'newest' | 'oldest'>('newest')

const rows = ref<ContactRequestRow[]>([])
const selected = ref<ContactRequestRow | null>(null)

const isModalOpen = computed({
  get: () => !!selected.value,
  set: (v) => {
    if (!v) selected.value = null
  }
})

const sources = computed(() => {
  const set = new Set<string>()
  for (const r of rows.value) set.add(r.source || 'website')
  return ['all', ...Array.from(set).sort()]
})

const filtered = computed(() => {
  const query = q.value.trim().toLowerCase()
  let list = rows.value.slice()

  if (statusFilter.value !== 'all') list = list.filter(r => r.status === statusFilter.value)
  if (sourceFilter.value !== 'all') list = list.filter(r => (r.source || 'website') === sourceFilter.value)

  if (query) {
    list = list.filter(r => {
      const hay =
        `${r.name} ${r.email} ${r.project_type} ${r.budget} ${r.message}`.toLowerCase()
      return hay.includes(query)
    })
  }

  list.sort((a, b) => {
    const da = +new Date(a.created_at)
    const db = +new Date(b.created_at)
    return sort.value === 'newest' ? db - da : da - db
  })

  return list
})

function fmtTime(v: string) {
  try {
    return new Date(v).toLocaleString()
  } catch {
    return v
  }
}

function clip(s: string, n = 120) {
  const t = String(s || '')
  return t.length <= n ? t : t.slice(0, n - 1) + '…'
}

function badgeColor(s: ReqStatus): 'primary' | 'warning' | 'success' {
  if (s === 'new') return 'primary'
  if (s === 'seen') return 'warning'
  return 'success'
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const { data, error } = await sb
      .from('contact_requests')
      .select('id, created_at, name, email, project_type, budget, message, source, status, user_agent, ip')
      .order('created_at', { ascending: false })
      .limit(800)

    if (error) throw error
    rows.value = (data || []) as ContactRequestRow[]
  } catch (e: any) {
    toast.add({
      title: 'Failed to load requests',
      description: String(e?.message || 'Unknown error'),
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

async function updateStatus(id: string, status: ReqStatus, opts?: { silent?: boolean }): Promise<void> {
  saving.value = id
  try {
    const { error } = await sb.from('contact_requests').update({ status }).eq('id', id)
    if (error) throw error

    const i = rows.value.findIndex(r => r.id === id)
    if (i !== -1) rows.value[i] = { ...rows.value[i], status }

    if (selected.value?.id === id) selected.value = { ...selected.value, status }

    if (!opts?.silent) {
      toast.add({ title: 'Updated', description: `Status set to ${status}`, color: 'success' })
    }
  } catch (e: any) {
    toast.add({
      title: 'Update failed',
      description: String(e?.message || 'Unknown error'),
      color: 'error'
    })
  } finally {
    saving.value = null
  }
}

async function openRow(r: ContactRequestRow): Promise<void> {
  selected.value = r
  if (r.status === 'new') {
    await updateStatus(r.id, 'seen', { silent: true })
  }
}

async function removeRequest(id: string): Promise<void> {
  saving.value = id
  try {
    const { error } = await sb.from('contact_requests').delete().eq('id', id)
    if (error) throw error

    rows.value = rows.value.filter(r => r.id !== id)
    if (selected.value?.id === id) selected.value = null

    toast.add({ title: 'Deleted', description: 'Request removed.', color: 'success' })
  } catch (e: any) {
    toast.add({
      title: 'Delete failed',
      description: String(e?.message || 'Unknown error'),
      color: 'error'
    })
  } finally {
    saving.value = null
  }
}

// safe modal action wrappers
async function markSelectedSeen(): Promise<void> {
  if (!selected.value) return
  await updateStatus(selected.value.id, 'seen')
}
async function markSelectedDone(): Promise<void> {
  if (!selected.value) return
  await updateStatus(selected.value.id, 'done')
}
async function deleteSelected(): Promise<void> {
  if (!selected.value) return
  await removeRequest(selected.value.id)
}

onMounted(load)
</script>

<template>
  <div class="page">
    <!-- Header -->
    <div class="head">
      <div class="left">
        <div class="title">Contact Requests</div>
        <div class="sub">Project requests (type + budget) with status workflow.</div>
      </div>

      <div class="right">
        <UButton variant="soft" :loading="loading" @click="load">
          <UIcon name="i-heroicons-arrow-path" class="w-4 h-4" />
          Refresh
        </UButton>
      </div>
    </div>

    <!-- Filters -->
    <div class="toolbar">
      <UInput
        v-model="q"
        icon="i-heroicons-magnifying-glass"
        placeholder="Search name, email, project type, budget, message…"
        class="w-full"
      />

      <div class="controls">
        <USelect
          v-model="statusFilter"
          :options="[
            { label: 'All status', value: 'all' },
            { label: 'New', value: 'new' },
            { label: 'Seen', value: 'seen' },
            { label: 'Done', value: 'done' }
          ]"
        />

        <USelect
          v-model="sourceFilter"
          :options="sources.map(s => ({ label: s === 'all' ? 'All sources' : s, value: s }))"
        />

        <USelect
          v-model="sort"
          :options="[
            { label: 'Newest first', value: 'newest' },
            { label: 'Oldest first', value: 'oldest' }
          ]"
        />
      </div>
    </div>

    <!-- Table Card -->
    <div class="card">
      <div class="cardHead">
        <div class="meta">
          <div class="k">Showing</div>
          <div class="v">{{ filtered.length }}</div>
        </div>
      </div>

      <div v-if="loading" class="skeleton">
        <div v-for="i in 10" :key="i" class="skRow" />
      </div>

      <div v-else-if="filtered.length === 0" class="empty">
        No requests found.
      </div>

      <div v-else class="tableWrap">
        <table class="table">
          <thead>
            <tr>
              <th>Status</th>
              <th>From</th>
              <th>Project</th>
              <th>Budget</th>
              <th>Preview</th>
              <th>Meta</th>
              <th class="rightCol">Actions</th>
            </tr>
          </thead>

          <tbody>
            <tr v-for="r in filtered" :key="r.id" class="tr" @click="openRow(r)">
              <td>
                <UBadge :label="r.status" variant="soft" :color="badgeColor(r.status)" />
              </td>

              <td class="from">
                <div class="nm">{{ r.name }}</div>
                <div class="dim">{{ r.email }}</div>
              </td>

              <td class="project">
                <div class="nm">{{ r.project_type }}</div>
              </td>

              <td class="budget">
                <div class="nm">{{ r.budget }}</div>
              </td>

              <td class="preview">
                {{ clip(r.message, 90) }}
              </td>

              <td class="metaCell">
                <div class="dim">{{ fmtTime(r.created_at) }}</div>
                <div class="dim">src: {{ r.source || 'website' }}</div>
              </td>

              <td class="rightCol" @click.stop>
                <div class="btns">
                  <UButton size="xs" variant="soft" :loading="saving === r.id" @click="() => updateStatus(r.id, 'seen')">
                    Seen
                  </UButton>
                  <UButton size="xs" color="primary" variant="solid" :loading="saving === r.id" @click="() => updateStatus(r.id, 'done')">
                    Done
                  </UButton>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Detail Modal -->
    <UModal v-model="isModalOpen" :ui="{ content: 'sm:max-w-3xl' }">
      <div v-if="selected" class="modal">
        <div class="mHead">
          <div class="mTitle">
            <div class="big">{{ selected.name }}</div>
            <div class="dim">{{ selected.email }}</div>
          </div>

          <div class="mActions">
            <USelect
              :model-value="selected.status"
              :disabled="saving === selected.id"
              :options="[
                { label: 'New', value: 'new' },
                { label: 'Seen', value: 'seen' },
                { label: 'Done', value: 'done' }
              ]"
              @update:model-value="(v) => updateStatus(selected.id, v as any)"
            />

            <UButton variant="soft" :loading="saving === selected.id" @click="markSelectedSeen">
              Mark seen
            </UButton>

            <UButton color="primary" variant="solid" :loading="saving === selected.id" @click="markSelectedDone">
              Mark done
            </UButton>

            <UButton color="error" variant="soft" :loading="saving === selected.id" @click="deleteSelected">
              Delete
            </UButton>
          </div>
        </div>

        <div class="mBody">
          <div class="pillRow">
            <UBadge :label="selected.status" variant="soft" :color="badgeColor(selected.status)" />
            <UBadge :label="selected.source || 'website'" variant="soft" />
            <div class="dim">Created: {{ fmtTime(selected.created_at) }}</div>
          </div>

          <div class="grid2">
            <div class="block">
              <div class="k">Project type</div>
              <div class="v">{{ selected.project_type }}</div>
            </div>
            <div class="block">
              <div class="k">Budget</div>
              <div class="v">{{ selected.budget }}</div>
            </div>
          </div>

          <div class="block">
            <div class="k">Message</div>
            <div class="msg">{{ selected.message }}</div>
          </div>

          <div class="grid2">
            <div class="block">
              <div class="k">IP</div>
              <div class="v mono">{{ selected.ip || '—' }}</div>
            </div>
            <div class="block">
              <div class="k">User agent</div>
              <div class="v mono">{{ selected.user_agent || '—' }}</div>
            </div>
          </div>
        </div>

        <div class="mFoot">
          <UButton variant="soft" @click="isModalOpen = false">Close</UButton>
        </div>
      </div>
    </UModal>
  </div>
</template>

<style scoped>
.page { display: grid; gap: 14px; }

.head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  padding: 14px;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, .10);
  background: rgba(255, 255, 255, .06);
  backdrop-filter: blur(10px);
}
.title { font-size: 1.35rem; font-weight: 900; letter-spacing: -.02em; }
.sub { opacity: .7; margin-top: 4px; }

.toolbar {
  display: grid;
  gap: 12px;
  padding: 12px;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, .10);
  background: rgba(255, 255, 255, .05);
  backdrop-filter: blur(10px);
}
.controls {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.card {
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, .10);
  background: rgba(255, 255, 255, .05);
  backdrop-filter: blur(10px);
  overflow: hidden;
}
.cardHead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, .08);
  background: rgba(0, 0, 0, .10);
}
.meta { display: flex; gap: 10px; align-items: baseline; }
.k { font-size: .8rem; opacity: .7; }
.v { font-weight: 900; }

.tableWrap { overflow: auto; }
.table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  min-width: 1020px;
}
thead th {
  text-align: left;
  font-size: .75rem;
  opacity: .75;
  padding: 10px 12px;
  white-space: nowrap;
}
.tr { cursor: pointer; transition: background .12s ease; }
.tr:hover { background: rgba(255, 255, 255, .04); }
tbody td {
  padding: 12px;
  border-top: 1px solid rgba(255, 255, 255, .08);
  vertical-align: top;
}
.from .nm { font-weight: 900; letter-spacing: -.01em; }
.dim { opacity: .65; font-size: .82rem; }
.preview { max-width: 360px; opacity: .85; }
.metaCell { white-space: nowrap; }
.rightCol { text-align: right; white-space: nowrap; }
.btns { display: flex; gap: 8px; justify-content: flex-end; }

.skeleton { padding: 14px; display: grid; gap: 10px; }
.skRow {
  height: 56px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, .08);
  background: linear-gradient(90deg, rgba(255, 255, 255, .05), rgba(255, 255, 255, .10), rgba(255, 255, 255, .05));
  background-size: 200% 100%;
  animation: shimmer 1.2s ease-in-out infinite;
}
@keyframes shimmer { 0% { background-position: 0% 0; } 100% { background-position: 200% 0; } }

.empty { padding: 18px 14px; opacity: .7; }

/* Modal */
.modal { padding: 14px; color: var(--app-fg); }
.mHead {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, .10);
}
.mTitle .big { font-size: 1.15rem; font-weight: 950; letter-spacing: -.02em; }
.mActions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }

.mBody { padding-top: 12px; display: grid; gap: 12px; }
.pillRow { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

.block {
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, .10);
  background: rgba(255, 255, 255, .04);
  padding: 12px;
}
.block .k { font-size: .78rem; opacity: .7; margin-bottom: 6px; }
.block .v { font-weight: 800; }

.msg { white-space: pre-wrap; line-height: 1.6; opacity: .92; }

.grid2 {
  display: grid;
  gap: 12px;
  grid-template-columns: 1fr 1fr;
}
@media (max-width: 760px) { .grid2 { grid-template-columns: 1fr; } }

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: .82rem;
}

.mFoot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, .10);
  margin-top: 12px;
}
</style>
