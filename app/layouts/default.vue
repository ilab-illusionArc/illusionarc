<template>
  <div class="min-h-dvh flex flex-col">
    <!-- Header -->
    <header class="sticky top-0 z-50 backdrop-blur border-b border-white/5 bg-black/20">
      <UContainer class="py-3 flex items-center justify-between gap-3">
        <NuxtLink to="/" class="flex items-center gap-2">
          <UIcon name="i-heroicons-sparkles" class="text-xl" />
          <span class="font-semibold tracking-wide">illusion Arc</span>
        </NuxtLink>

        <nav class="hidden md:flex items-center gap-1">
          <UButton variant="ghost" to="/work">Work</UButton>
          <UButton variant="ghost" to="/services">Services</UButton>
          <UButton variant="ghost" to="/arcade">Arcade</UButton>
          <UButton variant="ghost" to="/about">About</UButton>
          <UButton variant="ghost" to="/arcade/leaderboard">Leaderboard</UButton>
          <UButton variant="ghost" to="/arcade/winners">Winners</UButton>
        </nav>

        <div class="flex items-center gap-2">
          <!-- ✅ Theme button (desktop) -->
          <!-- <UButton
            class="hidden md:inline-flex"
            variant="ghost"
            size="sm"
            :title="`Theme: ${themeLabel} (click to change)`"
            @click="cycleTheme"
          >
            <UIcon :name="themeIcon" class="w-5 h-5" />
          </UButton> -->

          <UButton class="hidden md:inline-flex" color="primary" to="/contact">
            Contact
          </UButton>

          <!-- ✅ Avatar / Login (desktop) -->
          <div class="hidden md:block">
            <UserMenu />
          </div>

          <!-- Mobile menu -->
          <UButton class="md:hidden" variant="ghost" @click="open = true">
            <UIcon name="i-heroicons-bars-3" />
          </UButton>
        </div>
      </UContainer>
    </header>

    <!-- Mobile drawer -->
    <USlideover v-model:open="open">
      <template #body>
        <div class="p-4 flex flex-col gap-2">
          <!-- Top row actions (mobile) -->
          <div class="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
            <div class="text-sm font-semibold opacity-80">Menu</div>

            <!-- ✅ Theme button (mobile) -->
            <UButton
              variant="ghost"
              size="sm"
              :title="`Theme: ${themeLabel} (tap to change)`"
              @click="cycleTheme"
            >
              <UIcon :name="themeIcon" class="w-5 h-5" />
            </UButton>
          </div>

          <!-- ✅ Avatar/Login inside drawer -->
          <div class="pb-2 border-b border-white/10">
            <!-- Logged out -->
            <UButton
              v-if="!user"
              color="primary"
              variant="soft"
              to="/login"
              icon="i-heroicons-lock-closed"
              @click="open = false"
              class="w-full justify-center"
            >
              Login
            </UButton>

            <!-- Logged in -->
            <div v-else class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-3">
                <div class="h-10 w-10 overflow-hidden rounded-full border border-white/10 bg-white/5">
                  <img
                    v-if="avatarUrl"
                    :src="avatarUrl"
                    alt="Avatar"
                    class="h-full w-full object-cover"
                    referrerpolicy="no-referrer"
                  />
                  <div v-else class="h-full w-full grid place-items-center text-sm font-semibold opacity-90">
                    {{ initials }}
                  </div>
                </div>

                <div class="leading-tight">
                  <div class="text-sm font-semibold">{{ displayName }}</div>
                  <div class="text-xs opacity-70">Account</div>
                </div>
              </div>

              <UButton
                variant="ghost"
                icon="i-heroicons-arrow-right-on-rectangle"
                @click="logout"
              >
                Logout
              </UButton>
            </div>

            <UButton
              v-if="user"
              variant="ghost"
              icon="i-heroicons-user-circle"
              to="/profile"
              class="mt-2 w-full justify-start"
              @click="open = false"
            >
              Edit Profile
            </UButton>
          </div>

          <UButton variant="ghost" to="/work" @click="open=false">Work</UButton>
          <UButton variant="ghost" to="/services" @click="open=false">Services</UButton>
          <UButton variant="ghost" to="/arcade" @click="open=false">Arcade</UButton>
          <UButton variant="ghost" to="/about" @click="open=false">About</UButton>
          <UButton variant="ghost" to="/arcade/leaderboard" @click="open=false">Leaderboard</UButton>
          <UButton variant="ghost" to="/arcade/winners" @click="open=false">Winners</UButton>
          <UButton color="primary" to="/contact" @click="open=false">Contact</UButton>
        </div>
      </template>
    </USlideover>

    <!-- Page -->
    <main class="flex-1">
      <slot />
    </main>

    <!-- Footer -->
    <footer class="border-t border-white/5 bg-black/10">
      <UContainer class="py-10 grid gap-6 md:grid-cols-3">
        <div>
          <div class="font-semibold">Illusion Arc</div>
          <div class="text-sm opacity-70 mt-2">
            Games • AR/VR • VFX/CGI • Animation
          </div>
        </div>

        <div class="text-sm">
          <div class="opacity-60 mb-2">Links</div>
          <div class="flex flex-col gap-1">
            <NuxtLink to="/work" class="opacity-80 hover:opacity-100">Work</NuxtLink>
            <NuxtLink to="/arcade" class="opacity-80 hover:opacity-100">Arcade</NuxtLink>
            <NuxtLink to="/contact" class="opacity-80 hover:opacity-100">Contact</NuxtLink>
          </div>
        </div>

        <div class="text-sm">
          <div class="opacity-60 mb-2">Legal</div>
          <div class="flex flex-col gap-1">
            <NuxtLink to="/privacy" class="opacity-80 hover:opacity-100">Privacy</NuxtLink>
            <NuxtLink to="/terms" class="opacity-80 hover:opacity-100">Terms</NuxtLink>
          </div>
        </div>
      </UContainer>
    </footer>

    <!-- Install Button overlay -->
    <InstallPwaButton />
  </div>
</template>

<script setup lang="ts">
import UserMenu from '@/components/nav/UserMenu.vue'

const open = ref(false)

// Mobile drawer user info
const user = useSupabaseUser()
const supabase = useSupabaseClient()
const toast = useToast()

const displayName = computed(() => {
  const u: any = user.value
  return (
    u?.user_metadata?.display_name ||
    u?.user_metadata?.full_name ||
    u?.email?.split?.('@')?.[0] ||
    'Player'
  )
})

const avatarUrl = computed(() => {
  const u: any = user.value
  return u?.user_metadata?.avatar_url || ''
})

const initials = computed(() => {
  const n = (displayName.value || '').trim()
  return n ? n.slice(0, 1).toUpperCase() : 'U'
})

async function logout() {
  try {
    await supabase.auth.signOut()
    toast.add({ title: 'Logged out', color: 'success' })
    open.value = false
    await navigateTo('/', { replace: true })
  } catch (e: any) {
    toast.add({ title: 'Logout failed', description: e?.message || '', color: 'error' })
  }
}

/* =========================
   ✅ Color mode button logic
   ========================= */
const colorMode = useColorMode()

type Mode = 'system' | 'light' | 'dark'
const order: Mode[] = ['system', 'light', 'dark']

function normalizeMode(v: unknown): Mode {
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
}

const theme = computed<Mode>(() => normalizeMode((colorMode as any).preference))

const themeIcon = computed(() => {
  if (theme.value === 'light') return 'i-heroicons-sun'
  if (theme.value === 'dark') return 'i-heroicons-moon'
  return 'i-heroicons-computer-desktop'
})

const themeLabel = computed(() => {
  if (theme.value === 'light') return 'Light'
  if (theme.value === 'dark') return 'Dark'
  return 'System'
})

function cycleTheme() {
  const i = order.indexOf(theme.value)
  const next = order[(i + 1) % order.length]
  ;(colorMode as any).preference = next
}
</script>
