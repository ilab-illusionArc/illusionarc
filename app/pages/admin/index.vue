<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: ['admin']
})

useHead({ title: 'Admin — Dashboard' })

const toast = useToast()
const supabase = useSupabaseClient()
const loading = ref(true)

const stats = ref({
  users: 0,
  newMessages: 0,
  newRequests: 0,
  scoreEvents: 0
})

async function loadStats(): Promise<void> {
  loading.value = true
  try {
    const [{ count: users }, { count: msgs }, { count: reqs }, { count: scores }] = await Promise.all([
      supabase.from('profiles').select('user_id', { count: 'exact', head: true }),
      supabase.from('contact_messages').select('id', { count: 'exact', head: true }).eq('status', 'new'),
      supabase.from('contact_requests').select('id', { count: 'exact', head: true }).eq('status', 'new'),
      supabase.from('leaderboard_scores').select('id', { count: 'exact', head: true })
    ])

    stats.value = {
      users: users || 0,
      newMessages: msgs || 0,
      newRequests: reqs || 0,
      scoreEvents: scores || 0
    }
  } catch (e: any) {
    toast.add({ title: 'Failed to load', description: e?.message || 'Try again.', color: 'error' })
  } finally {
    loading.value = false
  }
}

onMounted(loadStats)

function n(v: number) {
  return new Intl.NumberFormat().format(v || 0)
}
</script>

<template>
  <div class="space-y-4">
    <!-- HERO -->
    <div
        class="relative overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-5 lg:p-6 shadow-[0_30px_90px_rgba(0,0,0,.12)] dark:shadow-[0_30px_90px_rgba(0,0,0,.30)] backdrop-blur"
    >
      <!-- top wash -->
      <div
          class="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full blur-3xl opacity-60"
          style="background: radial-gradient(circle at 30% 30%, rgba(34,211,238,.28), transparent 60%);"
          aria-hidden="true"
      />
      <div
          class="pointer-events-none absolute -bottom-32 -left-32 h-80 w-80 rounded-full blur-3xl opacity-60"
          style="background: radial-gradient(circle at 30% 30%, rgba(124,58,237,.26), transparent 60%);"
          aria-hidden="true"
      />

      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="min-w-0">
          <div class="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-1.5 text-xs text-black/60 dark:text-white/60">
            <span class="h-2 w-2 rounded-full"
                  style="background: radial-gradient(circle at 30% 30%, #22d3ee, #7c3aed); box-shadow: 0 0 0 6px rgba(34,211,238,.10);" />
            Command Center
          </div>

          <h1 class="mt-3 text-2xl lg:text-3xl font-extrabold tracking-tight text-black dark:text-white">
            System Overview
          </h1>
          <p class="mt-1 text-sm text-black/60 dark:text-white/60 max-w-xl">
            Monitor inbox, requests, users and leaderboard activity — all in one place.
          </p>
        </div>

        <div class="flex flex-wrap gap-2">
          <button
              type="button"
              class="inline-flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-4 py-2.5 text-sm hover:bg-black/10 dark:hover:bg-white/10 transition"
              @click="loadStats"
          >
            <UIcon name="i-heroicons-arrow-path" class="h-5 w-5 opacity-80" />
            Refresh
          </button>

          <NuxtLink
              to="/admin/scores"
              class="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/30 bg-gradient-to-br from-cyan-400/15 via-violet-500/10 to-emerald-500/10 px-4 py-2.5 text-sm font-semibold hover:from-cyan-400/20 hover:via-violet-500/15 hover:to-emerald-500/15 transition"
          >
            <UIcon name="i-heroicons-trophy" class="h-5 w-5 opacity-90" />
            Open Scores
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- KPI GRID -->
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      <!-- KPI card component style -->
      <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4 backdrop-blur">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3 min-w-0">
            <div class="h-11 w-11 rounded-2xl grid place-items-center border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
              <UIcon name="i-heroicons-users" class="h-5 w-5 opacity-80" />
            </div>
            <div class="min-w-0">
              <div class="text-sm font-semibold text-black dark:text-white">Users</div>
              <div class="text-xs text-black/60 dark:text-white/60 truncate">profiles</div>
            </div>
          </div>

          <NuxtLink to="/admin/users" class="text-xs text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition">
            Open →
          </NuxtLink>
        </div>

        <div class="mt-4 text-3xl font-extrabold tracking-tight text-black dark:text-white tabular-nums">
          <span v-if="loading" class="inline-block h-9 w-20 rounded-xl bg-black/10 dark:bg-white/10 animate-pulse" />
          <span v-else>{{ n(stats.users) }}</span>
        </div>
      </div>

      <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4 backdrop-blur">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3 min-w-0">
            <div class="h-11 w-11 rounded-2xl grid place-items-center border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
              <UIcon name="i-heroicons-inbox" class="h-5 w-5 opacity-80" />
            </div>
            <div class="min-w-0">
              <div class="text-sm font-semibold text-black dark:text-white">New Messages</div>
              <div class="text-xs text-black/60 dark:text-white/60 truncate">contact_messages.status=new</div>
            </div>
          </div>

          <NuxtLink to="/admin/messages" class="text-xs text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition">
            Open →
          </NuxtLink>
        </div>

        <div class="mt-4 text-3xl font-extrabold tracking-tight text-black dark:text-white tabular-nums">
          <span v-if="loading" class="inline-block h-9 w-20 rounded-xl bg-black/10 dark:bg-white/10 animate-pulse" />
          <span v-else>{{ n(stats.newMessages) }}</span>
        </div>
      </div>

      <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4 backdrop-blur">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3 min-w-0">
            <div class="h-11 w-11 rounded-2xl grid place-items-center border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
              <UIcon name="i-heroicons-clipboard-document-list" class="h-5 w-5 opacity-80" />
            </div>
            <div class="min-w-0">
              <div class="text-sm font-semibold text-black dark:text-white">New Requests</div>
              <div class="text-xs text-black/60 dark:text-white/60 truncate">contact_requests.status=new</div>
            </div>
          </div>

          <NuxtLink to="/admin/requests" class="text-xs text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition">
            Open →
          </NuxtLink>
        </div>

        <div class="mt-4 text-3xl font-extrabold tracking-tight text-black dark:text-white tabular-nums">
          <span v-if="loading" class="inline-block h-9 w-20 rounded-xl bg-black/10 dark:bg-white/10 animate-pulse" />
          <span v-else>{{ n(stats.newRequests) }}</span>
        </div>
      </div>

      <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4 backdrop-blur">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3 min-w-0">
            <div class="h-11 w-11 rounded-2xl grid place-items-center border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
              <UIcon name="i-heroicons-bolt" class="h-5 w-5 opacity-80" />
            </div>
            <div class="min-w-0">
              <div class="text-sm font-semibold text-black dark:text-white">Score Events</div>
              <div class="text-xs text-black/60 dark:text-white/60 truncate">leaderboard_scores</div>
            </div>
          </div>

          <NuxtLink to="/admin/scores" class="text-xs text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition">
            Open →
          </NuxtLink>
        </div>

        <div class="mt-4 text-3xl font-extrabold tracking-tight text-black dark:text-white tabular-nums">
          <span v-if="loading" class="inline-block h-9 w-20 rounded-xl bg-black/10 dark:bg-white/10 animate-pulse" />
          <span v-else>{{ n(stats.scoreEvents) }}</span>
        </div>
      </div>
    </div>

    <!-- ACTION PANELS -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <NuxtLink
          to="/admin/messages"
          class="group rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-5 backdrop-blur hover:bg-black/5 dark:hover:bg-white/10 transition"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="text-lg font-extrabold tracking-tight text-black dark:text-white">Inbox</div>
            <div class="mt-1 text-sm text-black/60 dark:text-white/60">
              Read messages, open details, and update status.
            </div>
          </div>
          <div class="h-12 w-12 rounded-2xl grid place-items-center border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 group-hover:scale-[1.02] transition">
            <UIcon name="i-heroicons-inbox" class="h-6 w-6 opacity-80" />
          </div>
        </div>

        <div class="mt-4 text-sm font-semibold text-black/70 dark:text-white/70 group-hover:text-black dark:group-hover:text-white transition">
          Open →
        </div>
      </NuxtLink>

      <NuxtLink
          to="/admin/scores"
          class="group rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-5 backdrop-blur hover:bg-black/5 dark:hover:bg-white/10 transition"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="text-lg font-extrabold tracking-tight text-black dark:text-white">Leaderboards</div>
            <div class="mt-1 text-sm text-black/60 dark:text-white/60">
              Daily, weekly, and all-time winners plus score history.
            </div>
          </div>
          <div class="h-12 w-12 rounded-2xl grid place-items-center border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 group-hover:scale-[1.02] transition">
            <UIcon name="i-heroicons-trophy" class="h-6 w-6 opacity-80" />
          </div>
        </div>

        <div class="mt-4 text-sm font-semibold text-black/70 dark:text-white/70 group-hover:text-black dark:group-hover:text-white transition">
          Open →
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
