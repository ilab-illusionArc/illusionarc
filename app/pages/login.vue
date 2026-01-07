<script setup lang="ts">
useHead({
  title: 'Login — Illusion Arc',
  meta: [{ name: 'description', content: 'Login to play games on Illusion Arc.' }]
})

const route = useRoute()
const toast = useToast()

const supabase = useSupabaseClient()
const user = useSupabaseUser()

const email = ref('')
const password = ref('')
const loading = ref(false)
const mode = ref<'signin' | 'signup'>('signin')
const showPass = ref(false)

// ✅ NEW: display name (signup only, optional)
const displayName = ref('')

const nextUrl = computed(() => {
  const n = route.query.next
  return typeof n === 'string' && n.startsWith('/') ? n : '/arcade'
})

// If already logged in, go back immediately
watchEffect(() => {
  if (user.value) navigateTo(nextUrl.value, { replace: true })
})

function isEmailValid(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

const canSubmit = computed(() => {
  return isEmailValid(email.value) && password.value.length >= 6 && !loading.value
})

// ✅ Random display name generator
function randomDisplayName() {
  const a = ['Neon', 'Turbo', 'Shadow', 'Nova', 'Pixel', 'Arc', 'Blaze', 'Frost', 'Cosmic', 'Hyper']
  const b = ['Rider', 'Knight', 'Hunter', 'Pilot', 'Ninja', 'Wizard', 'Boss', 'Runner', 'Samurai', 'Rogue']
  const n = Math.floor(1000 + Math.random() * 9000)
  return `${a[Math.floor(Math.random() * a.length)]}${b[Math.floor(Math.random() * b.length)]}${n}`
}

function normalizeDisplayName(v: string) {
  const s = String(v || '').trim().replace(/\s+/g, ' ')
  return s.slice(0, 32)
}

async function ensureDisplayNameAfterLogin() {
  // called after sign in to "heal" old accounts
  const u: any = user.value
  if (!u?.id) return

  const md = u.user_metadata || {}
  const dn = normalizeDisplayName(md.display_name || md.full_name || md.name || '')
  if (dn) return

  const fallback = randomDisplayName()
  const { error } = await supabase.auth.updateUser({
    data: { display_name: fallback }
  })
  if (error) {
    // non-blocking
    console.warn('Failed to set display_name:', error.message)
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

      // ✅ ensure display name exists for older accounts
      await ensureDisplayNameAfterLogin()

      toast.add({ title: 'Welcome back', description: 'Logged in successfully.', color: 'success' })
    } else {
      // ✅ ALWAYS set display_name on signup (random if empty)
      const dn = normalizeDisplayName(displayName.value) || randomDisplayName()

      const { error } = await supabase.auth.signUp({
        email: email.value.trim(),
        password: password.value,
        options: {
          data: {
            display_name: dn
          }
        }
      })
      if (error) throw error

      toast.add({
        title: 'Account created',
        description: `Welcome, ${dn}! If email confirmation is enabled, please check your inbox.`,
        color: 'success'
      })
    }

    // go back to game-play URL
    navigateTo(nextUrl.value, { replace: true })
  } catch (e: any) {
    toast.add({
      title: 'Auth failed',
      description: e?.message || 'Please try again.',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

function continueBrowsing() {
  navigateTo('/', { replace: true })
}
</script>

<template>
  <div class="relative min-h-[calc(100dvh-64px)] overflow-hidden">
    <!-- background wash -->
    <div class="absolute inset-0 bg-black" />
    <div class="absolute inset-0 wash" aria-hidden="true" />
    <div class="absolute inset-0 noise" aria-hidden="true" />

    <!-- floating orbs -->
    <div class="orb orb-a" aria-hidden="true" />
    <div class="orb orb-b" aria-hidden="true" />
    <div class="orb orb-c" aria-hidden="true" />

    <UContainer class="relative py-10 md:py-14">
      <div class="grid gap-8 lg:grid-cols-2 items-center">
        <!-- Left: Brand panel -->
        <div class="max-w-xl">
          <div
              class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs opacity-90"
          >
            <UIcon name="i-heroicons-lock-closed" class="w-4 h-4" />
            Login required to play games
          </div>

          <h1 class="mt-4 text-4xl md:text-6xl font-semibold tracking-tight">
            Enter the
            <span class="grad">Arcade</span>
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

        <!-- Right: Auth card -->
        <div class="lg:justify-self-end w-full max-w-xl">
          <div class="card">
            <div class="cardHead">
              <div class="flex items-center justify-between">
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

                <!-- ✅ NEW: Display name only on signup -->
                <UFormGroup v-if="mode === 'signup'" label="Display name (optional)">
                  <UInput
                      v-model="displayName"
                      placeholder="e.g. Souvik / NeonRider1234"
                      autocomplete="nickname"
                      icon="i-heroicons-user"
                  />
                  <div class="mt-1 text-xs opacity-60">
                    Leave empty to auto-generate a fun name.
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
                  <span class="text-xs opacity-60">Illusion Arc</span>
                </div>

                <div class="text-xs opacity-70 leading-relaxed">
                  By continuing, you agree to basic fair-use rules for the Arcade.
                  (We can add Terms/Privacy pages later.)
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
.wash{
  background:
      radial-gradient(900px 600px at 15% 20%, rgba(34,211,238,.12), transparent 60%),
      radial-gradient(900px 600px at 85% 30%, rgba(168,85,247,.14), transparent 60%),
      radial-gradient(900px 700px at 55% 90%, rgba(16,185,129,.10), transparent 60%),
      linear-gradient(to bottom, rgba(255,255,255,.04), transparent 30%, rgba(255,255,255,.02));
}
.noise{
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='.18'/%3E%3C/svg%3E");
  opacity:.12;
  mix-blend-mode: overlay;
}

.orb{
  position:absolute;
  border-radius:9999px;
  filter: blur(24px);
  opacity:.55;
  transform: translateZ(0);
  animation: float 9s ease-in-out infinite;
}
.orb-a{
  width: 280px; height: 280px;
  left: -90px; top: 80px;
  background: radial-gradient(circle at 30% 30%, rgba(34,211,238,.55), rgba(34,211,238,.05) 60%, transparent 70%);
}
.orb-b{
  width: 320px; height: 320px;
  right: -120px; top: 120px;
  background: radial-gradient(circle at 30% 30%, rgba(168,85,247,.55), rgba(168,85,247,.05) 60%, transparent 70%);
  animation-delay: -2s;
}
.orb-c{
  width: 360px; height: 360px;
  left: 40%; bottom: -180px;
  background: radial-gradient(circle at 30% 30%, rgba(16,185,129,.45), rgba(16,185,129,.04) 60%, transparent 70%);
  animation-delay: -4s;
}

@keyframes float{
  0%,100%{ transform: translateY(0) scale(1); }
  50%{ transform: translateY(-14px) scale(1.02); }
}

.grad{
  background: linear-gradient(90deg, rgba(34,211,238,1), rgba(168,85,247,1), rgba(16,185,129,1));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.feature{
  display:flex;
  gap:.6rem;
  align-items:flex-start;
  padding:.85rem;
  border-radius: 1.25rem;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.04);
  transition: transform .18s ease, background .18s ease, border-color .18s ease;
}
.feature:hover{
  transform: translateY(-2px);
  border-color: rgba(255,255,255,.18);
  background: rgba(255,255,255,.06);
}

.card{
  border-radius: 1.5rem;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.05);
  box-shadow: 0 30px 80px rgba(0,0,0,.35);
  overflow:hidden;
  backdrop-filter: blur(10px);
}
.cardHead{
  padding: 1.1rem 1.1rem .9rem;
  border-bottom: 1px solid rgba(255,255,255,.10);
  background: rgba(0,0,0,.18);
}
.cardBody{ padding: 1.1rem; }

.toggle{
  display:flex;
  gap:.35rem;
  padding:.25rem;
  border-radius:9999px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.04);
}
.pill{
  padding: .45rem .75rem;
  font-size: .85rem;
  border-radius:9999px;
  color: rgba(255,255,255,.75);
  transition: background .16s ease, color .16s ease, transform .16s ease;
}
.pill:hover{ transform: translateY(-1px); }
.pill.on{
  background: rgba(255,255,255,.10);
  color: rgba(255,255,255,.95);
}

.divider{
  position:relative;
  padding: .6rem 0;
  display:flex;
  justify-content:center;
}
.divider::before{
  content:"";
  position:absolute;
  inset: 50% 0 auto;
  height:1px;
  background: rgba(255,255,255,.10);
}
.divider span{
  position:relative;
  padding: 0 .75rem;
  background: rgba(0,0,0,.18);
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 9999px;
}
</style>
