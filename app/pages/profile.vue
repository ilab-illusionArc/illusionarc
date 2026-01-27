<script setup lang="ts">
import { onBeforeRouteLeave } from 'vue-router'

useHead({
  title: 'Profile — illusion Arc',
  meta: [{ name: 'description', content: 'Edit your Illusion Arc profile.' }]
})

definePageMeta({
  middleware: ['require-auth'] // ✅ use real middleware file
})

const supabase = useSupabaseClient()
const toast = useToast()
const router = useRouter()
const route = useRoute()
const user = useSupabaseUser()

const loading = ref(false)
const loadingProfile = ref(true)
const avatarUploading = ref(false)

const state = reactive({
  display_name: '',
  avatar_url: '',
  phone: '' // E.164 in DB
})

const avatarInput = ref<HTMLInputElement | null>(null)

const savedAvatarUrl = ref('')
const savedPhone = ref('')

const pending = reactive({
  path: '' as string,
  url: '' as string
})

/* ---------------- Country code + phone (UNICODE FLAGS) ---------------- */
type CountryOpt = {
  label: string // "BD +880"
  dial: string  // "+880"
  iso: string   // "BD"
  flag: string  // "🇧🇩"
}

function flagEmojiFromIso(iso: string) {
  const cc = String(iso || '').toUpperCase()
  if (cc.length !== 2) return '🏳️'
  const A = 0x1f1e6
  const codePoints = [...cc].map(ch => A + (ch.charCodeAt(0) - 65))
  return String.fromCodePoint(codePoints[0], codePoints[1])
}

function makeCountry(iso: string, dial: string): CountryOpt {
  const up = iso.toUpperCase()
  return { iso: up, dial, label: `${up} ${dial}`, flag: flagEmojiFromIso(up) }
}

const COUNTRY_CODES: CountryOpt[] = [
  makeCountry('US', '+1'),
  makeCountry('GB', '+44'),
  makeCountry('CA', '+1'),
  makeCountry('AU', '+61'),
  makeCountry('DE', '+49'),
  makeCountry('FR', '+33'),
  makeCountry('IT', '+39'),
  makeCountry('ES', '+34'),
  makeCountry('NL', '+31'),
  makeCountry('SE', '+46'),
  makeCountry('NO', '+47'),
  makeCountry('DK', '+45'),

  makeCountry('BR', '+55'),
  makeCountry('MX', '+52'),
  makeCountry('AR', '+54'),

  makeCountry('IN', '+91'),
  makeCountry('PK', '+92'),
  makeCountry('BD', '+880'),
  makeCountry('LK', '+94'),
  makeCountry('NP', '+977'),

  makeCountry('JP', '+81'),
  makeCountry('KR', '+82'),
  makeCountry('CN', '+86'),
  makeCountry('SG', '+65'),
  makeCountry('MY', '+60'),
  makeCountry('TH', '+66'),
  makeCountry('ID', '+62'),
  makeCountry('PH', '+63'),

  makeCountry('AE', '+971'),
  makeCountry('SA', '+966'),
  makeCountry('EG', '+20'),
  makeCountry('ZA', '+27')
]

const selectedCountry = ref<CountryOpt>(COUNTRY_CODES.find((c) => c.iso === 'BD') || COUNTRY_CODES[0])
const phoneLocal = ref('')

function onlyDigits(v: string) {
  return String(v || '').replace(/[^\d]/g, '')
}

function toE164(dial: string, local: string) {
  const d = String(dial || '').trim()
  let n = onlyDigits(local).replace(/^0+/, '')
  if (!d.startsWith('+')) return ''
  if (!n) return ''
  return `${d}${n}`
}

function validatePhoneLocal(local: string) {
  const n = onlyDigits(local).replace(/^0+/, '')
  if (n.length < 6 || n.length > 14) return 'Please enter a valid phone number.'
  return null
}

function parseE164IntoUi(e164: string) {
  const p = String(e164 || '').trim()
  if (!p.startsWith('+') || p.length < 4) return
  const list = [...COUNTRY_CODES].sort((a, b) => b.dial.length - a.dial.length)
  const found = list.find((c) => p.startsWith(c.dial))
  if (!found) return
  selectedCountry.value = found
  phoneLocal.value = p.slice(found.dial.length)
}

const phonePreview = computed(() => toE164(selectedCountry.value.dial, phoneLocal.value))

/* ---------------- Required phone gate ---------------- */
const mustHavePhone = computed(() => !String(savedPhone.value || '').trim())
const mustCompleteBecauseRedirected = computed(() => String(route.query.needPhone || '') === '1')

onBeforeRouteLeave((to) => {
  // ✅ If user is already logged out, NEVER block leaving
  if (!user.value?.id) return true

  // ✅ Always allow navigating to login
  if (to.path.startsWith('/login')) return true

  // ✅ Block leaving only when logged in AND phone missing
  if (mustHavePhone.value) {
    toast.add({
      title: 'Phone number required',
      description: 'Please add your phone number and Save changes to continue.',
      color: 'warning'
    })
    return false
  }

  return true
})


/* ---------------- Display name helpers ---------------- */
function normalizeDisplayName(v: string) {
  const s = String(v || '').trim().replace(/\s+/g, ' ')
  const cleaned = s.replace(/[^\p{L}\p{N} _-]/gu, '')
  return cleaned.slice(0, 24)
}

function validate() {
  const dn = normalizeDisplayName(state.display_name)
  if (!dn.trim()) return 'Please enter your display name.'
  if (dn.length < 3) return 'Display name should be at least 3 characters.'

  const p = phonePreview.value
  if (!p) return 'Phone number is required.'
  const pErr = validatePhoneLocal(phoneLocal.value)
  if (pErr) return pErr

  return null
}

/* ---------------- Avatar helpers ---------------- */
function openAvatarPicker() {
  if (avatarUploading.value) return
  avatarInput.value?.click()
}

function resetAvatarInput() {
  if (avatarInput.value) avatarInput.value.value = ''
}

function extractAvatarPathFromPublicUrl(url: string): string | null {
  const u = String(url || '').trim()
  if (!u) return null
  const marker = '/storage/v1/object/public/avatars/'
  const idx = u.indexOf(marker)
  if (idx === -1) return null
  return u.slice(idx + marker.length) || null
}

async function deleteAvatarIfOwned(urlOrPath: string, userId: string, isPath = false) {
  const path = isPath ? urlOrPath : extractAvatarPathFromPublicUrl(urlOrPath)
  if (!path) return
  if (!path.startsWith(`${userId}/`)) return
  const { error } = await supabase.storage.from('avatars').remove([path])
  if (error) console.warn('Avatar delete failed:', error.message)
}

/* ---------------- Load profile ---------------- */
async function loadProfile() {
  if (!import.meta.client) return
  loadingProfile.value = true

  try {
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user?.id) return

    const fallbackName =
      (user.user_metadata as any)?.display_name ||
      (user.user_metadata as any)?.full_name ||
      (user.email?.split?.('@')?.[0] ?? '') ||
      ''

    const fallbackAvatar = (user.user_metadata as any)?.avatar_url || ''
    const fallbackPhone = (user.user_metadata as any)?.phone || ''

    const { data } = await (supabase as any)
      .from('profiles')
      .select('display_name, avatar_url, phone')
      .eq('user_id', user.id)
      .maybeSingle()

    state.display_name = (data?.display_name || fallbackName || '').trim()
    state.avatar_url = (data?.avatar_url || fallbackAvatar || '').trim()
    state.phone = (data?.phone || fallbackPhone || '').trim()

    savedAvatarUrl.value = state.avatar_url || ''
    savedPhone.value = state.phone || ''

    if (state.phone) parseE164IntoUi(state.phone)
  } finally {
    loadingProfile.value = false
  }
}

onMounted(loadProfile)

/* ✅ If user logs out from anywhere, leave this page immediately */
watch(
  () => user.value?.id,
  (id) => {
    if (!id) navigateTo('/login?next=/profile', { replace: true })
  }
)

/* ---------------- Avatar upload ---------------- */
async function onPickAvatar(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  avatarUploading.value = true
  try {
    if (!file.type.startsWith('image/')) {
      toast.add({ title: 'Invalid file', description: 'Please select an image.', color: 'warning' })
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.add({ title: 'Too large', description: 'Max 2MB image allowed.', color: 'warning' })
      return
    }

    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user?.id) throw new Error('Login required')

    if (pending.path) {
      await deleteAvatarIfOwned(pending.path, user.id, true)
      pending.path = ''
      pending.url = ''
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
    const path = `${user.id}/pending/${Date.now()}.${ext}`

    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (error) throw error
    if (!data?.path) throw new Error('Upload failed')

    const { data: pub } = supabase.storage.from('avatars').getPublicUrl(data.path)
    const url = pub?.publicUrl || ''
    if (!url) throw new Error('Could not get public URL')

    pending.path = data.path
    pending.url = url
    state.avatar_url = url
  } catch (err: any) {
    toast.add({ title: 'Upload failed', description: err?.message || 'Try again.', color: 'error' })
  } finally {
    resetAvatarInput()
    setTimeout(() => { avatarUploading.value = false }, 150)
  }
}

/* ---------------- Save ---------------- */
async function save() {
  const err = validate()
  if (err) {
    toast.add({ title: 'Check the form', description: err, color: 'warning' })
    return
  }

  loading.value = true
  try {
    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user?.id) throw new Error('Login required')

    const displayName = normalizeDisplayName(state.display_name)
    const nextAvatarUrl = state.avatar_url.trim() || null
    const phoneE164 = phonePreview.value.trim()

    const prevSavedAvatar = savedAvatarUrl.value

    const { error } = await (supabase as any)
      .from('profiles')
      .upsert(
        {
          user_id: user.id,
          display_name: displayName,
          avatar_url: nextAvatarUrl,
          phone: phoneE164,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'user_id' }
      )

    if (error) {
      if ((error as any).code === '23505' || /duplicate key|unique/i.test(error.message)) {
        const m = String(error.message || '').toLowerCase()
        if (m.includes('phone')) throw new Error('This phone number is already used. Try another.')
        if (m.includes('display')) throw new Error('That display name is already taken. Try another one.')
        throw new Error('Duplicate data detected. Please try again.')
      }
      throw error
    }

    const { error: metaErr } = await supabase.auth.updateUser({
      data: { display_name: displayName, avatar_url: nextAvatarUrl, phone: phoneE164 }
    })
    if (metaErr) console.warn(metaErr.message)

    await supabase.auth.refreshSession()

    if (prevSavedAvatar && nextAvatarUrl && prevSavedAvatar !== nextAvatarUrl) {
      await deleteAvatarIfOwned(prevSavedAvatar, user.id, false)
    }

    savedAvatarUrl.value = nextAvatarUrl || ''
    savedPhone.value = phoneE164 || ''
    state.phone = phoneE164

    pending.path = ''
    pending.url = ''

    toast.add({ title: 'Saved', description: 'Profile updated successfully.', color: 'success' })

    const next = typeof route.query.next === 'string' && route.query.next.startsWith('/') ? route.query.next : ''
    if (next) return navigateTo(next, { replace: true })
  } catch (e: any) {
    toast.add({ title: 'Failed', description: e?.message || 'Try again.', color: 'error' })
  } finally {
    loading.value = false
  }
}

async function clearAvatar() {
  if (avatarUploading.value) return
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.id && pending.path) {
      avatarUploading.value = true
      await deleteAvatarIfOwned(pending.path, user.id, true)
      pending.path = ''
      pending.url = ''
    }
  } finally {
    state.avatar_url = ''
    setTimeout(() => { avatarUploading.value = false }, 150)
  }
}

async function cancel() {
  if (mustHavePhone.value) {
    toast.add({
      title: 'Phone number required',
      description: 'Please add your phone number and Save changes to continue.',
      color: 'warning'
    })
    return
  }

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.id && pending.path) {
      await deleteAvatarIfOwned(pending.path, user.id, true)
      pending.path = ''
      pending.url = ''
    }
  } finally {
    router.push('/')
  }
}

function initials(name: string) {
  const s = String(name || '').trim()
  if (!s) return 'IA'
  const parts = s.split(/\s+/).slice(0, 2)
  return parts.map(p => p[0]?.toUpperCase() || '').join('') || 'IA'
}
</script>

<template>
  <UContainer class="py-10 md:py-14">
    <div class="mx-auto max-w-5xl">
      <!-- Header -->
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="text-3xl md:text-5xl font-semibold tracking-tight text-black dark:text-white">Profile</h1>
          <p class="mt-2 text-sm md:text-base text-black/70 dark:text-white/70">
            Manage your display name, phone number and avatar.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <UButton variant="soft" icon="i-heroicons-arrow-left" :disabled="loading || avatarUploading" @click="cancel">
            Back
          </UButton>

          <UButton
            color="primary"
            variant="solid"
            icon="i-heroicons-check-circle"
            :loading="loading"
            :disabled="loadingProfile || avatarUploading"
            @click="save"
          >
            Save changes
          </UButton>
        </div>
      </div>

      <!-- Required phone banner -->
      <div
        v-if="mustHavePhone"
        class="mt-6 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4"
      >
        <div class="flex items-start gap-3">
          <div class="mt-0.5 h-10 w-10 rounded-2xl border border-amber-500/25 bg-amber-500/10 grid place-items-center">
            <UIcon name="i-heroicons-exclamation-triangle" class="h-5 w-5 opacity-90" />
          </div>
          <div class="min-w-0">
            <div class="font-semibold text-black dark:text-white">Phone number required</div>
            <div class="text-sm mt-1 text-black/70 dark:text-white/70">
              Please add your phone number and save changes to continue.
            </div>
          </div>
        </div>
      </div>

      <div class="mt-8 grid gap-6 lg:grid-cols-[360px_1fr] items-start">
        <!-- Left card: avatar -->
        <UCard class="border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur">
          <template #header>
            <div class="flex items-center justify-between">
              <div class="font-semibold text-black dark:text-white">Avatar</div>
              <div v-if="loadingProfile" class="text-xs text-black/60 dark:text-white/60">Loading…</div>
            </div>
          </template>

          <div class="grid gap-4">
            <div class="flex items-center gap-4">
              <div class="relative h-20 w-20 rounded-full overflow-hidden border border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/30">
                <img
                  v-if="state.avatar_url"
                  :src="state.avatar_url"
                  class="h-full w-full object-cover"
                  alt="Avatar"
                  referrerpolicy="no-referrer"
                />
                <div v-else class="h-full w-full grid place-items-center font-semibold text-black/70 dark:text-white/70">
                  {{ initials(state.display_name) }}
                </div>

                <div v-if="avatarUploading" class="absolute inset-0 grid place-items-center bg-black/60">
                  <span class="i-heroicons-arrow-path-20-solid animate-spin text-xl text-white"></span>
                </div>
              </div>

              <div class="min-w-0 flex-1">
                <div class="text-xs text-black/60 dark:text-white/60">Display name</div>
                <div class="mt-1 text-lg font-semibold text-black dark:text-white truncate">
                  {{ state.display_name || '—' }}
                </div>
                <div class="mt-2 text-xs text-black/60 dark:text-white/60">Phone</div>
                <div class="mt-1 text-sm font-medium text-black dark:text-white tabular-nums truncate">
                  {{ phonePreview || '—' }}
                </div>
              </div>
            </div>

            <input ref="avatarInput" class="hidden" type="file" accept="image/*" @change="onPickAvatar" />

            <div class="grid gap-2">
              <UButton
                variant="soft"
                icon="i-heroicons-arrow-up-tray"
                :disabled="avatarUploading || loadingProfile || loading"
                @click="openAvatarPicker"
              >
                Upload
              </UButton>

              <UButton
                v-if="state.avatar_url"
                variant="ghost"
                icon="i-heroicons-x-mark"
                :disabled="avatarUploading || loadingProfile || loading"
                @click="clearAvatar"
              >
                Clear
              </UButton>
            </div>
          </div>
        </UCard>

        <!-- Right card: form -->
        <UCard class="border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur">
          <template #header>
            <div class="font-semibold text-black dark:text-white">Profile details</div>
          </template>

          <div class="grid gap-5">
            <!-- ✅ Label before input -->
            <div class="grid gap-2">
              <div class="text-xs font-medium text-black/70 dark:text-white/70">Display name</div>
              <UInput
                v-model="state.display_name"
                placeholder="Your display name"
                icon="i-heroicons-user"
                :disabled="loadingProfile || avatarUploading || loading"
              />
            </div>

            <div class="grid gap-3 sm:grid-cols-[190px_1fr]">
              <!-- ✅ Label before input -->
              <div class="grid gap-2">
                <div class="text-xs font-medium text-black/70 dark:text-white/70">Country code</div>

                <!-- ✅ UNICODE flags shown inside selector -->
                <USelectMenu
                  v-model="selectedCountry"
                  :items="COUNTRY_CODES"
                  value-key="iso"
                  class="w-full"
                  :ui="{ width: 'w-full' }"
                  :search-input="{ placeholder: 'Search…', icon: 'i-heroicons-magnifying-glass' }"
                  :disabled="loadingProfile || loading || avatarUploading"
                >
                  <template #label>
                    <span class="inline-flex items-center gap-2 truncate tabular-nums">
                      <span class="flag">{{ selectedCountry.flag }}</span>
                      <span class="truncate">{{ selectedCountry.label }}</span>
                    </span>
                  </template>

                  <template #option="{ option }">
                    <span class="inline-flex items-center gap-2 truncate tabular-nums">
                      <span class="flag">{{ option.flag }}</span>
                      <span class="truncate">{{ option.label }}</span>
                    </span>
                  </template>
                </USelectMenu>
              </div>

              <!-- ✅ Label before input -->
              <div class="grid gap-2">
                <div class="text-xs font-medium text-black/70 dark:text-white/70">Phone number</div>
                <UInput
                  v-model="phoneLocal"
                  placeholder="Phone number"
                  autocomplete="tel"
                  icon="i-heroicons-phone"
                  :disabled="loadingProfile || loading || avatarUploading"
                />
              </div>
            </div>

            <div v-if="mustCompleteBecauseRedirected || mustHavePhone" class="text-xs text-amber-700 dark:text-amber-300">
              Phone is mandatory to continue.
            </div>
          </div>
        </UCard>
      </div>
    </div>
  </UContainer>
</template>

<style scoped>
.flag{
  font-size: 16px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
}
</style>
