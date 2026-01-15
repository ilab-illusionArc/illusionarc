<script setup lang="ts">
definePageMeta({ layout: 'admin' })

useHead({ title: 'Admin · Users — illusion Arc' })

type ProfileRole = 'user' | 'admin'
type ProfileRow = {
  user_id: string
  display_name: string
  avatar_url: string | null
  role: ProfileRole
  updated_at: string
}

const supabase = useSupabaseClient()
const toast = useToast()

const loading = ref(true)
const savingId = ref<string | null>(null)

const q = ref('')
const roleFilter = ref<'all' | ProfileRole>('all')
const sort = ref<'updated_desc' | 'name_asc' | 'name_desc'>('updated_desc')

const rows = ref<ProfileRow[]>([])

const filtered = computed(() => {
  const query = q.value.trim().toLowerCase()

  let list = rows.value.slice()

  if (roleFilter.value !== 'all') {
    list = list.filter(r => r.role === roleFilter.value)
  }

  if (query) {
    list = list.filter(r =>
      r.display_name?.toLowerCase().includes(query) ||
      r.user_id.toLowerCase().includes(query)
    )
  }

  if (sort.value === 'updated_desc') {
    list.sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at))
  } else if (sort.value === 'name_asc') {
    list.sort((a, b) => (a.display_name || '').localeCompare(b.display_name || ''))
  } else if (sort.value === 'name_desc') {
    list.sort((a, b) => (b.display_name || '').localeCompare(a.display_name || ''))
  }

  return list
})

async function load(): Promise<void> {
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, display_name, avatar_url, role, updated_at')
      .order('updated_at', { ascending: false })
      .limit(500)

    if (error) throw error
    rows.value = (data || []) as ProfileRow[]
  } catch (e: any) {
    toast.add({
      title: 'Failed to load users',
      description: String(e?.message || 'Unknown error'),
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

async function setRole(userId: string, role: ProfileRole): Promise<void> {
  savingId.value = userId
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('user_id', userId)

    if (error) throw error

    // update local state
    const i = rows.value.findIndex(r => r.user_id === userId)
    if (i !== -1) rows.value[i] = { ...rows.value[i], role, updated_at: new Date().toISOString() }

    toast.add({ title: 'Role updated', description: `Set to ${role}`, color: 'success' })
  } catch (e: any) {
    toast.add({
      title: 'Role update failed',
      description: String(e?.message || 'Unknown error'),
      color: 'error'
    })
  } finally {
    savingId.value = null
  }
}

function shortId(id: string) {
  return id ? `${id.slice(0, 8)}…${id.slice(-6)}` : ''
}

function fmtTime(v: string) {
  try { return new Date(v).toLocaleString() } catch { return v }
}

onMounted(load)
</script>

<template>
  <div class="page">
    <!-- Header -->
    <div class="head">
      <div class="left">
        <div class="title">Users</div>
        <div class="sub">Manage profiles and roles.</div>
      </div>

      <div class="right">
        <UButton variant="soft" :loading="loading" @click="load">
          <UIcon name="i-heroicons-arrow-path" class="w-4 h-4" />
          Refresh
        </UButton>
      </div>
    </div>

    <!-- Toolbar -->
    <div class="toolbar">
      <UInput
        v-model="q"
        icon="i-heroicons-magnifying-glass"
        placeholder="Search by name or user id…"
        class="w-full"
      />

      <div class="controls">
        <USelect
          v-model="roleFilter"
          :options="[
            { label: 'All roles', value: 'all' },
            { label: 'Admins', value: 'admin' },
            { label: 'Users', value: 'user' }
          ]"
        />

        <USelect
          v-model="sort"
          :options="[
            { label: 'Recently updated', value: 'updated_desc' },
            { label: 'Name (A → Z)', value: 'name_asc' },
            { label: 'Name (Z → A)', value: 'name_desc' }
          ]"
        />
      </div>
    </div>

    <!-- Content -->
    <div class="card">
      <div class="cardHead">
        <div class="meta">
          <div class="k">Total</div>
          <div class="v">{{ filtered.length }}</div>
        </div>
        <div class="hint">
          Only admins can change roles (RLS).
        </div>
      </div>

      <div v-if="loading" class="skeleton">
        <div v-for="i in 8" :key="i" class="skRow" />
      </div>

      <div v-else-if="filtered.length === 0" class="empty">
        No users found.
      </div>

      <div v-else class="list">
        <div v-for="u in filtered" :key="u.user_id" class="row">
          <div class="who">
            <div class="avatar">
              <img v-if="u.avatar_url" :src="u.avatar_url" alt="" />
              <div v-else class="ph">{{ (u.display_name || 'U').slice(0, 1).toUpperCase() }}</div>
            </div>

            <div class="info">
              <div class="name">
                <span class="nm">{{ u.display_name }}</span>
                <UBadge
                  :label="u.role"
                  variant="soft"
                  :color="u.role === 'admin' ? 'primary' : 'gray'"
                />
              </div>

              <div class="idline">
                <span class="dim">{{ shortId(u.user_id) }}</span>
                <span class="dot">•</span>
                <span class="dim">Updated: {{ fmtTime(u.updated_at) }}</span>
              </div>
            </div>
          </div>

          <div class="actions">
            <USelect
              :model-value="u.role"
              :disabled="savingId === u.user_id"
              :options="[
                { label: 'User', value: 'user' },
                { label: 'Admin', value: 'admin' }
              ]"
              @update:model-value="(v) => setRole(u.user_id, v as any)"
            />

            <div v-if="savingId === u.user_id" class="miniLoad" aria-hidden="true" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page{
  display:grid;
  gap: 14px;
}

.head{
  display:flex;
  align-items:flex-end;
  justify-content:space-between;
  gap: 12px;
  padding: 14px;
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.06);
  backdrop-filter: blur(10px);
}

.title{
  font-size: 1.35rem;
  font-weight: 900;
  letter-spacing: -0.02em;
}
.sub{ opacity:.7; margin-top: 4px; }

.toolbar{
  display:grid;
  gap: 12px;
  padding: 12px;
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.05);
  backdrop-filter: blur(10px);
}

.controls{
  display:flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content:flex-end;
}

.card{
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.05);
  backdrop-filter: blur(10px);
  overflow: hidden;
}

.cardHead{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(255,255,255,.08);
  background: rgba(0,0,0,.10);
}
.meta{ display:flex; gap: 10px; align-items:baseline; }
.k{ font-size:.8rem; opacity:.7; }
.v{ font-weight: 900; }
.hint{ font-size:.8rem; opacity:.6; }

.list{ display:grid; }
.row{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap: 12px;
  padding: 12px 14px;
  border-top: 1px solid rgba(255,255,255,.08);
}

.who{
  display:flex;
  align-items:center;
  gap: 12px;
  min-width: 0;
}

.avatar{
  width: 42px;
  height: 42px;
  border-radius: 14px;
  overflow:hidden;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.04);
  display:grid;
  place-items:center;
  flex: 0 0 auto;
}
.avatar img{ width:100%; height:100%; object-fit: cover; }
.ph{
  font-weight: 900;
  opacity: .9;
}

.info{ min-width:0; }
.name{
  display:flex;
  gap: 10px;
  align-items:center;
  min-width:0;
}
.nm{
  font-weight: 900;
  letter-spacing: -0.01em;
  white-space: nowrap;
  overflow:hidden;
  text-overflow: ellipsis;
  max-width: min(520px, 50vw);
}
.idline{
  display:flex;
  align-items:center;
  gap: 8px;
  margin-top: 2px;
}
.dim{ opacity:.65; font-size:.82rem; }
.dot{ opacity:.5; }

.actions{
  display:flex;
  align-items:center;
  gap: 10px;
  flex: 0 0 auto;
}

.skeleton{ padding: 14px; display:grid; gap: 10px; }
.skRow{
  height: 52px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.08);
  background: linear-gradient(90deg, rgba(255,255,255,.05), rgba(255,255,255,.10), rgba(255,255,255,.05));
  background-size: 200% 100%;
  animation: shimmer 1.2s ease-in-out infinite;
}
@keyframes shimmer{
  0%{ background-position: 0% 0; }
  100%{ background-position: 200% 0; }
}

.empty{
  padding: 18px 14px;
  opacity: .7;
}

.miniLoad{
  width: 18px;
  height: 18px;
  border-radius: 9999px;
  border: 2px solid rgba(255,255,255,.12);
  border-top-color: rgba(34,211,238,.85);
  animation: spin 0.9s linear infinite;
}
@keyframes spin{ to{ transform: rotate(360deg); } }
</style>
