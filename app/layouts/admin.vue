<script setup lang="ts">
type RoleResponse = { role: 'admin' | 'user' | null; found: boolean }

const route = useRoute()
const supabase = useSupabaseClient()
const ready = ref(false)

const nav = [
  { label: 'Dashboard', to: '/admin', icon: 'i-heroicons-squares-2x2' },
  { label: 'Users', to: '/admin/users', icon: 'i-heroicons-users' },
  { label: 'Scores', to: '/admin/scores', icon: 'i-heroicons-trophy' },
  { label: 'Messages', to: '/admin/messages', icon: 'i-heroicons-inbox' },
  { label: 'Requests', to: '/admin/requests', icon: 'i-heroicons-clipboard-document-check' }
]

async function go(path: string): Promise<void> {
  await navigateTo(path)
}

async function signOut(): Promise<void> {
  await supabase.auth.signOut()
  await navigateTo('/', { replace: true })
}

onMounted(async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return navigateTo({ path: '/login', query: { next: route.fullPath } })

    const res = await $fetch<RoleResponse>('/api/auth/role')
    if (res.role !== 'admin') return navigateTo('/', { replace: true })

    ready.value = true
  } catch {
    return navigateTo('/', { replace: true })
  }
})
</script>

<template>
  <div class="shell">
    <!-- loader gate -->
    <div v-if="!ready" class="loaderWrap" aria-label="Loading">
      <div class="loaderCard">
        <div class="rings" aria-hidden="true">
          <span class="ring r1" />
          <span class="ring r2" />
          <span class="ring r3" />
        </div>
        <div class="bar" aria-hidden="true"><span class="fill" /></div>
      </div>
    </div>

    <div v-else class="app">
      <aside class="side">
        <div class="brand">
          <div class="dot" />
          <div class="txt">
            <div class="t1">illusion Arc</div>
            <div class="t2">Admin Panel</div>
          </div>
        </div>

        <nav class="nav">
          <button
            v-for="item in nav"
            :key="item.to"
            class="navItem"
            :class="{ on: route.path === item.to }"
            type="button"
            @click="() => go(item.to)"
          >
            <UIcon :name="item.icon" class="w-5 h-5" />
            <span>{{ item.label }}</span>
          </button>
        </nav>

        <div class="bottom">
          <UButton variant="soft" block @click="signOut">
            <UIcon name="i-heroicons-arrow-right-on-rectangle" class="w-4 h-4" />
            Sign out
          </UButton>
        </div>
      </aside>

      <main class="main">
        <slot />
      </main>
    </div>
  </div>
</template>

<style scoped>
.shell{ min-height:100dvh; background:var(--app-bg); color:var(--app-fg); }
.app{ min-height:100dvh; display:grid; grid-template-columns: 280px 1fr; }
@media (max-width: 920px){ .app{ grid-template-columns: 1fr; } .side{ position:sticky; top:0; z-index:10; } }

.side{
  border-right: 1px solid rgba(255,255,255,.08);
  background: rgba(255,255,255,.03);
  backdrop-filter: blur(10px);
  padding: 14px;
  display:flex;
  flex-direction:column;
  gap: 12px;
}

.brand{
  display:flex; gap:10px; align-items:center;
  padding: 10px 10px;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,.08);
  background: rgba(255,255,255,.04);
}
.dot{
  width:10px; height:10px; border-radius:9999px;
  background: linear-gradient(90deg, rgba(34,211,238,1), rgba(124,58,237,1), rgba(34,197,94,1));
  box-shadow: 0 0 16px rgba(34,211,238,.35);
}
.t1{ font-weight:800; letter-spacing:-.02em; }
.t2{ font-size:.75rem; opacity:.65; margin-top:2px; }

.nav{ display:grid; gap:8px; }
.navItem{
  display:flex; align-items:center; gap:10px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.08);
  background: rgba(255,255,255,.03);
  opacity: .88;
  transition: transform .12s ease, background .12s ease, opacity .12s ease;
}
.navItem:hover{ transform: translateY(-1px); background: rgba(255,255,255,.05); opacity: 1; }
.navItem.on{
  background: rgba(255,255,255,.07);
  border-color: rgba(255,255,255,.14);
  opacity: 1;
}

.bottom{ margin-top:auto; }

.main{
  padding: 16px;
  min-height: 100dvh;
}

/* loader */
.loaderWrap{ min-height:100dvh; display:grid; place-items:center; }
.loaderCard{
  width:min(420px, calc(100vw - 32px));
  padding: 22px;
  border-radius: 22px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.06);
  box-shadow: 0 30px 90px rgba(0,0,0,.28);
  backdrop-filter: blur(12px);
}
.rings{ height:120px; display:grid; place-items:center; position:relative; margin-bottom:10px; }
.ring{ position:absolute; border-radius:9999px; border:2px solid rgba(255,255,255,.12); }
.r1{ width:86px; height:86px; border-top-color: rgba(34,211,238,.85); animation: spin 1.1s linear infinite; }
.r2{ width:110px; height:110px; border-right-color: rgba(124,58,237,.85); animation: spin 1.55s linear infinite reverse; }
.r3{ width:134px; height:134px; border-bottom-color: rgba(34,197,94,.75); animation: spin 2.0s linear infinite; }
@keyframes spin{ to{ transform: rotate(360deg); } }
.bar{
  height:10px; border-radius:9999px;
  background: rgba(255,255,255,.08);
  border: 1px solid rgba(255,255,255,.10);
  overflow:hidden;
}
.fill{
  display:block; height:100%; width:45%;
  border-radius:9999px;
  background: linear-gradient(90deg, rgba(34,211,238,.95), rgba(124,58,237,.95), rgba(34,197,94,.9));
  animation: sweep 1.15s ease-in-out infinite;
}
@keyframes sweep{
  0%{ transform: translateX(-110%); }
  50%{ transform: translateX(70%); }
  100%{ transform: translateX(210%); }
}
</style>
