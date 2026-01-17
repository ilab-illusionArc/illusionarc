<script setup lang="ts">
type RoleResponse = { role: 'admin' | 'user' | null; found: boolean }

const route = useRoute()
const toast = useToast()
const supabase = useSupabaseClient()

const checking = ref(true)

async function signOut(): Promise<void> {
  await supabase.auth.signOut()
  await navigateTo('/', { replace: true })
}

onMounted(async () => {
  try {
    // 1) session check
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      await navigateTo({ path: '/login', query: { next: route.fullPath } })
      return
    }

    // 2) role check
    const res = await $fetch<RoleResponse>('/api/auth/role')
    if (res.role !== 'admin') {
      await navigateTo('/', { replace: true })
      return
    }
  } catch (e: any) {
    toast.add({ title: 'Access check failed', description: e?.message || 'Please login again.', color: 'error' })
    await navigateTo({ path: '/login', query: { next: route.fullPath } })
  } finally {
    checking.value = false
  }
})
</script>

<template>
  <div
      class="min-h-dvh text-[var(--app-fg)]"
  >
    <!-- FULLSCREEN LOADER (prevents flash) -->
    <div
        v-if="checking"
        class="fixed inset-0 z-[9999] grid place-items-center bg-[var(--app-bg)]"
    >
      <!-- background wash -->
      <div
          class="absolute inset-0 opacity-90"
          style="
          background:
            radial-gradient(1100px 700px at 20% 0%, rgba(124,58,237,.22), transparent 60%),
            radial-gradient(900px 600px at 80% 15%, rgba(34,211,238,.16), transparent 60%),
            radial-gradient(900px 700px at 55% 90%, rgba(34,197,94,.10), transparent 60%);
        "
          aria-hidden="true"
      />

      <!-- card -->
      <div
          class="relative flex items-center gap-4 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-5 py-4 shadow-[0_30px_90px_rgba(0,0,0,.25)] backdrop-blur"
      >
        <!-- animated ring -->
        <div class="relative h-10 w-10">
          <div
              class="absolute inset-0 rounded-full border-4 border-black/10 dark:border-white/15"
          />
          <div
              class="absolute inset-0 rounded-full border-4 border-transparent border-t-cyan-400 border-l-violet-500 animate-spin"
          />
          <div
              class="absolute inset-2 rounded-full bg-black/5 dark:bg-white/5"
          />
        </div>

        <div class="min-w-0">
          <div class="text-sm font-semibold tracking-tight">
            Authorizing admin
          </div>
          <div class="mt-1 text-xs text-black/60 dark:text-white/60">
            Preparing console…
          </div>
        </div>
      </div>
    </div>

    <!-- SHELL -->
    <div class="min-h-dvh">
      <!-- Mobile top bar -->
      <div
          class="lg:hidden sticky top-0 z-30 border-b border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/30 backdrop-blur"
      >
        <div class="px-4 py-3 flex items-center justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <div
                class="h-10 w-10 rounded-xl grid place-items-center border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 font-bold"
                style="background: radial-gradient(circle at 30% 30%, rgba(34,211,238,.22), rgba(124,58,237,.16));"
            >
              IA
            </div>
            <div class="min-w-0">
              <div class="font-semibold leading-5 truncate">Admin</div>
              <div class="text-xs text-black/60 dark:text-white/60 truncate">{{ route.path }}</div>
            </div>
          </div>

          <!-- quick actions -->
          <div class="flex items-center gap-2">
            <NuxtLink
                to="/admin/messages"
                class="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-2 text-xs hover:bg-black/10 dark:hover:bg-white/10 transition"
            >
              <UIcon name="i-heroicons-inbox" class="h-4 w-4" />
              Inbox
            </NuxtLink>

            <NuxtLink
                to="/admin/scores"
                class="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-2 text-xs hover:bg-black/10 dark:hover:bg-white/10 transition"
            >
              <UIcon name="i-heroicons-trophy" class="h-4 w-4" />
            </NuxtLink>
          </div>
        </div>
      </div>

      <div class="lg:grid lg:grid-cols-[300px_1fr] lg:min-h-dvh">
        <!-- Sidebar (desktop) / Bottom nav style (mobile) -->
        <aside
            class="
            lg:sticky lg:top-0 lg:h-dvh
            lg:border-r lg:border-black/10 lg:dark:border-white/10
            lg:bg-white/60 lg:dark:bg-white/5 lg:backdrop-blur
            p-4
          "
        >
          <!-- Brand -->
          <div
              class="hidden lg:flex items-center gap-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-3 backdrop-blur"
          >
            <div
                class="h-12 w-12 rounded-2xl grid place-items-center border border-black/10 dark:border-white/10 font-bold"
                style="background: radial-gradient(circle at 30% 30%, rgba(34,211,238,.22), rgba(124,58,237,.16));"
            >
              IA
            </div>
            <div class="min-w-0">
              <div class="font-semibold truncate">illusion Arc</div>
              <div class="text-xs text-black/60 dark:text-white/60 truncate">Admin Console</div>
            </div>
          </div>

          <!-- Nav -->
          <nav class="mt-0 lg:mt-4 grid gap-2">
            <NuxtLink
                to="/admin"
                class="inline-flex items-center gap-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-4 py-3 hover:bg-black/5 dark:hover:bg-white/10 transition"
            >
              <UIcon name="i-heroicons-squares-2x2" class="h-5 w-5 opacity-80" />
              <span class="font-medium">Dashboard</span>
            </NuxtLink>

            <NuxtLink
                to="/admin/messages"
                class="inline-flex items-center gap-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-4 py-3 hover:bg-black/5 dark:hover:bg-white/10 transition"
            >
              <UIcon name="i-heroicons-inbox" class="h-5 w-5 opacity-80" />
              <span class="font-medium">Messages</span>
            </NuxtLink>

            <NuxtLink
                to="/admin/requests"
                class="inline-flex items-center gap-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-4 py-3 hover:bg-black/5 dark:hover:bg-white/10 transition"
            >
              <UIcon name="i-heroicons-clipboard-document-list" class="h-5 w-5 opacity-80" />
              <span class="font-medium">Requests</span>
            </NuxtLink>

            <NuxtLink
                to="/admin/users"
                class="inline-flex items-center gap-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-4 py-3 hover:bg-black/5 dark:hover:bg-white/10 transition"
            >
              <UIcon name="i-heroicons-users" class="h-5 w-5 opacity-80" />
              <span class="font-medium">Users</span>
            </NuxtLink>

            <NuxtLink
                to="/admin/scores"
                class="inline-flex items-center gap-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-4 py-3 hover:bg-black/5 dark:hover:bg-white/10 transition"
            >
              <UIcon name="i-heroicons-trophy" class="h-5 w-5 opacity-80" />
              <span class="font-medium">Scores</span>
            </NuxtLink>
          </nav>

          <!-- Footer -->
          <div class="mt-4 lg:mt-6 grid gap-2">
            <button
                type="button"
                class="inline-flex items-center justify-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-4 py-3 text-sm hover:bg-black/10 dark:hover:bg-white/10 transition"
                @click="() => navigateTo('/', { replace: true })"
            >
              <UIcon name="i-heroicons-arrow-left" class="h-5 w-5 opacity-80" />
              Back to site
            </button>

            <button
                type="button"
                class="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-500/25 bg-red-500/5 px-4 py-3 text-sm hover:bg-red-500/10 transition"
                @click="signOut"
            >
              <UIcon name="i-heroicons-arrow-right-on-rectangle" class="h-5 w-5 opacity-80" />
              Sign out
            </button>
          </div>
        </aside>

        <!-- Main -->
        <main class="p-4 lg:p-6">
          <!-- Desktop topbar -->
          <div
              class="hidden lg:flex items-center justify-between gap-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-4 py-3 backdrop-blur"
          >
            <div class="flex items-center gap-3 min-w-0">
              <span class="h-2.5 w-2.5 rounded-full"
                    style="background: radial-gradient(circle at 30% 30%, #22d3ee, #7c3aed); box-shadow: 0 0 0 6px rgba(34,211,238,.10);" />
              <div class="text-sm text-black/60 dark:text-white/60 truncate">{{ route.path }}</div>
            </div>

            <div class="flex items-center gap-2">
              <NuxtLink
                  to="/admin/scores"
                  class="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-2 text-xs hover:bg-black/10 dark:hover:bg-white/10 transition"
              >
                <UIcon name="i-heroicons-trophy" class="h-4 w-4" />
                Leaderboards
              </NuxtLink>

              <NuxtLink
                  to="/admin/messages"
                  class="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-2 text-xs hover:bg-black/10 dark:hover:bg-white/10 transition"
              >
                <UIcon name="i-heroicons-inbox" class="h-4 w-4" />
                Inbox
              </NuxtLink>
            </div>
          </div>

          <div class="mt-4 lg:mt-5">
            <slot />
          </div>
        </main>
      </div>
    </div>
  </div>
</template>
