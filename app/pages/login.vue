<script setup lang="ts">
useHead({
  title: 'Login — illusion Arc',
  meta: [{ name: 'description', content: 'Login to play games on Illusion Arc.' }]
})

type RoleResponse = { role: 'admin' | 'user' | null; found?: boolean }

const route = useRoute()
const toast = useToast()

const supabase = useSupabaseClient()
const user = useSupabaseUser()

const email = ref('')
const password = ref('')
const loading = ref(false)
const mode = ref<'signin' | 'signup'>('signin')
const showPass = ref(false)

// Display name (signup only, optional)
const displayName = ref('')

const nextUrl = computed(() => {
  const n = route.query.next
  return typeof n === 'string' && n.startsWith('/') ? n : '/arcade'
})

function isEmailValid(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

function normalizeDisplayName(v: string) {
  const s = String(v || '').trim().replace(/\s+/g, ' ')
  const cleaned = s.replace(/[^\p{L}\p{N} _-]/gu, '')
  return cleaned.slice(0, 24)
}

function randomDisplayName() {
  const a = ['Neon', 'Turbo', 'Shadow', 'Nova', 'Pixel', 'Arc', 'Blaze', 'Frost', 'Cosmic', 'Hyper']
  const b = ['Rider', 'Knight', 'Hunter', 'Pilot', 'Ninja', 'Wizard', 'Boss', 'Runner', 'Samurai', 'Rogue']
  const n = Math.floor(1000 + Math.random() * 9000)
  return `${a[Math.floor(Math.random() * a.length)]}${b[Math.floor(Math.random() * b.length)]}${n}`
}

watch(
  () => mode.value,
  (m) => {
    if (m === 'signup' && !displayName.value.trim()) displayName.value = randomDisplayName()
  },
  { immediate: true }
)

const canSubmit = computed(() => {
  if (!isEmailValid(email.value)) return false
  if (password.value.length < 6) return false
  if (loading.value) return false
  return true
})

async function getRole(): Promise<'admin' | 'user' | null> {
  try {
    const res = await $fetch<RoleResponse>('/api/auth/role')
    return res.role
  } catch {
    return null
  }
}

function hardReloadTo(path: string) {
  if (!import.meta.client) return
  // full URL ensures it works from any route
  window.location.assign(path)
}

async function redirectAfterLogin() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  const role = await getRole()

  if(role === 'admin') hardReloadTo('/admin')

  if (role === 'admin') return navigateTo('/admin', { replace: true })
  return navigateTo(nextUrl.value, { replace: true })
}

// If already logged in, redirect by role
watch(
  () => user.value?.id,
  async (id) => {
    if (!id) return
    await redirectAfterLogin()
  },
  { immediate: true }
)

async function isDisplayNameTaken(name: string): Promise<boolean> {
  if (!import.meta.client) return false
  const n = normalizeDisplayName(name)
  if (!n) return false

  try {
    const client: any = supabase
    const { data, error } = await client.from('profiles').select('user_id').eq('display_name', n).limit(1)
    if (error) return false
    return Array.isArray(data) && data.length > 0
  } catch {
    return false
  }
}

async function pickUniqueDisplayName(preferred: string): Promise<string> {
  let base = normalizeDisplayName(preferred) || normalizeDisplayName(randomDisplayName())
  if (!base) base = 'Player' + Math.floor(1000 + Math.random() * 9000)

  for (let i = 0; i < 7; i++) {
    const taken = await isDisplayNameTaken(base)
    if (!taken) return base
    base = `${base.slice(0, 18)}${Math.floor(10 + Math.random() * 90)}`
  }
  return `Player${Math.floor(100000 + Math.random() * 900000)}`
}

async function ensureDisplayNameAfterLogin() {
  const u: any = user.value
  if (!u?.id) return

  const md = u.user_metadata || {}
  const existing = normalizeDisplayName(md.display_name || md.full_name || md.name || '')
  if (existing) return

  const dn = await pickUniqueDisplayName('')
  const { error } = await supabase.auth.updateUser({ data: { display_name: dn } })
  if (error) return

  await supabase.auth.refreshSession()
}

async function upsertProfileIfPossible(dn: string) {
  try {
    const u: any = user.value
    if (!u?.id) return
    const client: any = supabase

    const { error } = await client.from('profiles').upsert({
      user_id: u.id,
      display_name: dn,
      avatar_url: u.user_metadata?.avatar_url || null,
      updated_at: new Date().toISOString()
    })

    if (error) console.warn('profiles upsert error:', error.message)
  } catch (e) {
    console.warn('profiles upsert exception:', e)
  }
}

async function submit() {
  if (!email.value.trim() || !password.value) {
    toast.add({ title: 'Missing fields', description: 'Email and password are required.', color: 'warning' })
    return
  }
  if (!isEmailValid(email.value)) {
    toast.add({ title: 'Invalid email', description: 'Please enter a valid email address.', color: 'warning' })
    return
  }
  if (password.value.length < 6) {
    toast.add({ title: 'Weak password', description: 'Password must be at least 6 characters.', color: 'warning' })
    return
  }

  loading.value = true
  try {
    if (mode.value === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.value.trim(),
        password: password.value
      })
      if (error) throw error

      // ✅ ensures metadata display name exists
      await ensureDisplayNameAfterLogin()

      // ✅ CRITICAL: ensure profiles row exists on every login
      const u: any = user.value
      const md = u?.user_metadata || {}
      const dn =
        normalizeDisplayName(md.display_name || md.full_name || md.name || '') ||
        (await pickUniqueDisplayName(displayName.value || ''))
      await upsertProfileIfPossible(dn)

      toast.add({ title: 'Welcome back', description: 'Logged in successfully.', color: 'success' })

      await redirectAfterLogin()
      return
    }

    // signup
    const picked = await pickUniqueDisplayName(displayName.value)

    const { data, error } = await supabase.auth.signUp({
      email: email.value.trim(),
      password: password.value,
      options: { data: { display_name: picked } }
    })
    if (error) throw error

    if (data?.session) {
      await supabase.auth.refreshSession()
      await upsertProfileIfPossible(picked)
    }

    toast.add({
      title: 'Account created',
      description: `Welcome, ${picked}! ${data?.session ? '' : 'If email confirmation is enabled, check your inbox.'}`,
      color: 'success'
    })

    await redirectAfterLogin()
  } catch (e: any) {
    const msg = String(e?.message || e?.error_description || '')
    const friendly =
      msg.includes('duplicate') || msg.includes('23505')
        ? 'That display name is already taken. Try another one.'
        : msg || 'Please try again.'

    toast.add({ title: 'Auth failed', description: friendly, color: 'error' })
  } finally {
    loading.value = false
  }
}

function continueBrowsing() {
  navigateTo('/', { replace: true })
}
</script>

<template>
  <div class="authPage">
    <div class="bg" aria-hidden="true" />
    <div class="wash" aria-hidden="true" />
    <div class="noise" aria-hidden="true" />

    <div class="orb orbA" aria-hidden="true" />
    <div class="orb orbB" aria-hidden="true" />
    <div class="orb orbC" aria-hidden="true" />

    <UContainer class="relative py-10 md:py-14">
      <div class="grid gap-8 lg:grid-cols-2 items-center">
        <div class="max-w-xl">
          <div class="badge">
            <UIcon name="i-heroicons-lock-closed" class="w-4 h-4" />
            Login required to play games
          </div>

          <h1 class="mt-4 text-4xl md:text-6xl font-semibold tracking-tight">
            Enter the <span class="grad">Arcade</span>
          </h1>

          <p class="mt-4 text-sm md:text-base opacity-80 leading-relaxed max-w-lg">
            Sign in to save scores, show up on leaderboards, and continue your runs across devices.
          </p>

          <div class="mt-6 grid gap-3 sm:grid-cols-2 max-w-lg">
            <div class="feature">
              <UIcon name="i-heroicons-trophy" class="w-5 h-5" />
              <div>
                <div class="text-sm font-semibold">Leaderboard</div>
                <div class="text-xs opacity-70">Compete on top scores</div>
              </div>
            </div>

            <div class="feature">
              <UIcon name="i-heroicons-sparkles" class="w-5 h-5" />
              <div>
                <div class="text-sm font-semibold">Micro-interactions</div>
                <div class="text-xs opacity-70">Fast, playful UI</div>
              </div>
            </div>

            <div class="feature">
              <UIcon name="i-heroicons-shield-check" class="w-5 h-5" />
              <div>
                <div class="text-sm font-semibold">Secure</div>
                <div class="text-xs opacity-70">Supabase authentication</div>
              </div>
            </div>

            <div class="feature">
              <UIcon name="i-heroicons-device-phone-mobile" class="w-5 h-5" />
              <div>
                <div class="text-sm font-semibold">Mobile-first</div>
                <div class="text-xs opacity-70">Works on phones too</div>
              </div>
            </div>
          </div>

          <div class="mt-6 text-xs opacity-60">
            After login you’ll return to:
            <span class="opacity-100">{{ nextUrl }}</span>
          </div>
        </div>

        <div class="lg:justify-self-end w-full max-w-xl">
          <div class="card">
            <div class="cardHead">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <div class="text-lg font-semibold">
                    {{ mode === 'signin' ? 'Sign in' : 'Create account' }}
                  </div>
                  <div class="text-xs opacity-70 mt-1">
                    {{ mode === 'signin'
                      ? 'Login to play games and save scores.'
                      : 'Create an account to join the leaderboard.' }}
                  </div>
                </div>

                <div class="toggle">
                  <button class="pill" :class="{ on: mode === 'signin' }" type="button" @click="mode = 'signin'">
                    Login
                  </button>
                  <button class="pill" :class="{ on: mode === 'signup' }" type="button" @click="mode = 'signup'">
                    Sign up
                  </button>
                </div>
              </div>
            </div>

            <div class="cardBody">
              <div class="grid gap-4">
                <UFormGroup label="Email" required>
                  <UInput v-model="email" placeholder="you@email.com" autocomplete="email" icon="i-heroicons-envelope" />
                </UFormGroup>

                <UFormGroup v-if="mode === 'signup'" label="Display name (optional)">
                  <UInput
                    v-model="displayName"
                    placeholder="e.g. Souvik / NeonRider1234"
                    autocomplete="nickname"
                    icon="i-heroicons-user"
                  />
                  <div class="mt-1 text-xs opacity-60 flex items-center justify-between">
                    <span>Must be unique.</span>
                    <UButton size="xs" variant="ghost" @click="displayName = randomDisplayName()">
                      Random
                    </UButton>
                  </div>
                </UFormGroup>

                <UFormGroup label="Password" required>
                  <UInput
                    v-model="password"
                    :type="showPass ? 'text' : 'password'"
                    placeholder="••••••••"
                    :autocomplete="mode === 'signin' ? 'current-password' : 'new-password'"
                    icon="i-heroicons-key"
                  />
                  <div class="mt-2 flex items-center justify-between">
                    <UButton size="xs" variant="ghost" @click="showPass = !showPass">
                      <UIcon :name="showPass ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'" class="w-4 h-4" />
                      {{ showPass ? 'Hide' : 'Show' }}
                    </UButton>
                    <div class="text-xs opacity-60">Min 6 chars</div>
                  </div>
                </UFormGroup>

                <div class="grid gap-2 sm:grid-cols-2">
                  <UButton
                    color="primary"
                    variant="solid"
                    size="lg"
                    :loading="loading"
                    :disabled="!canSubmit"
                    @click="submit"
                  >
                    <UIcon name="i-heroicons-arrow-right-circle" class="w-5 h-5" />
                    {{ mode === 'signin' ? 'Login' : 'Create account' }}
                  </UButton>

                  <UButton variant="soft" size="lg" @click="continueBrowsing">
                    <UIcon name="i-heroicons-home" class="w-5 h-5" />
                    Continue browsing
                  </UButton>
                </div>

                <div class="divider">
                  <span class="text-xs opacity-60">illusion Arc</span>
                </div>

                <div class="text-xs opacity-70 leading-relaxed">
                  By continuing, you agree to basic fair-use rules for the Arcade.
                </div>
              </div>
            </div>
          </div>

          <div class="mt-4 text-xs opacity-60 text-center">
            Tip: Use the same account to keep scores across games.
          </div>
        </div>
      </div>
    </UContainer>
  </div>
</template>

<style scoped>
/* (your CSS unchanged — keep exactly as you already have) */
.authPage { position: relative; min-height: calc(100dvh - 64px); overflow: hidden; color: var(--app-fg); }
.bg { position: absolute; inset: 0; background: var(--app-bg); }
.wash { position: absolute; inset: 0; background: radial-gradient(900px 600px at 15% 20%, var(--wash-b), transparent 60%), radial-gradient(900px 600px at 85% 30%, var(--wash-a), transparent 60%), radial-gradient(900px 700px at 55% 90%, rgba(34, 197, 94, 0.10), transparent 60%), linear-gradient(to bottom, rgba(255, 255, 255, 0.05), transparent 35%, rgba(255, 255, 255, 0.03)); opacity: 0.9; }
.noise { position: absolute; inset: 0; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='.18'/%3E%3C/svg%3E"); opacity: 0.1; mix-blend-mode: overlay; }
.orb { position: absolute; border-radius: 9999px; filter: blur(24px); opacity: 0.55; transform: translateZ(0); animation: float 9s ease-in-out infinite; }
.orbA { width: 280px; height: 280px; left: -90px; top: 80px; background: radial-gradient(circle at 30% 30%, rgba(34, 211, 238, 0.35), rgba(34, 211, 238, 0.06) 60%, transparent 70%); }
.orbB { width: 320px; height: 320px; right: -120px; top: 120px; background: radial-gradient(circle at 30% 30%, rgba(124, 58, 237, 0.35), rgba(124, 58, 237, 0.06) 60%, transparent 70%); animation-delay: -2s; }
.orbC { width: 360px; height: 360px; left: 40%; bottom: -180px; background: radial-gradient(circle at 30% 30%, rgba(34, 197, 94, 0.25), rgba(34, 197, 94, 0.05) 60%, transparent 70%); animation-delay: -4s; }
@keyframes float { 0%, 100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-14px) scale(1.02); } }
.grad { background: linear-gradient(90deg, rgba(34, 211, 238, 1), rgba(124, 58, 237, 1), rgba(34, 197, 94, 1)); -webkit-background-clip: text; background-clip: text; color: transparent; }
.badge { display: inline-flex; align-items: center; gap: 0.5rem; border-radius: 9999px; border: 1px solid rgba(255, 255, 255, 0.1); background: rgba(255, 255, 255, 0.04); padding: 0.25rem 0.75rem; font-size: 0.75rem; }
.feature { display: flex; gap: 0.6rem; align-items: flex-start; padding: 0.85rem; border-radius: 1.25rem; border: 1px solid rgba(255, 255, 255, 0.1); background: rgba(255, 255, 255, 0.04); transition: transform 0.18s ease, background 0.18s ease, border-color 0.18s ease; }
.feature:hover { transform: translateY(-2px); border-color: rgba(255, 255, 255, 0.18); background: rgba(255, 255, 255, 0.06); }
.card { border-radius: 1.5rem; border: 1px solid rgba(255, 255, 255, 0.1); background: rgba(255, 255, 255, 0.06); box-shadow: 0 30px 80px rgba(0, 0, 0, 0.22); overflow: hidden; backdrop-filter: blur(10px); }
.cardHead { padding: 1.1rem 1.1rem 0.9rem; border-bottom: 1px solid rgba(255, 255, 255, 0.1); background: rgba(0, 0, 0, 0.1); }
.cardBody { padding: 1.1rem; }
.toggle { display: flex; gap: 0.35rem; padding: 0.25rem; border-radius: 9999px; border: 1px solid rgba(255, 255, 255, 0.1); background: rgba(255, 255, 255, 0.04); }
.pill { padding: 0.45rem 0.75rem; font-size: 0.85rem; border-radius: 9999px; color: inherit; opacity: 0.75; transition: background 0.16s ease, opacity 0.16s ease, transform 0.16s ease; }
.pill:hover { transform: translateY(-1px); opacity: 1; }
.pill.on { background: rgba(255, 255, 255, 0.12); opacity: 1; }
.divider { position: relative; padding: 0.6rem 0; display: flex; justify-content: center; }
.divider::before { content: ''; position: absolute; inset: 50% 0 auto; height: 1px; background: rgba(255, 255, 255, 0.1); }
.divider span { position: relative; padding: 0 0.75rem; background: rgba(0, 0, 0, 0.1); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 9999px; }
</style>
