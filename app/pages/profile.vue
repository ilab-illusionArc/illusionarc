<script setup lang="ts">
useHead({
  title: 'Profile — Illusion Arc',
  meta: [{ name: 'description', content: 'Edit your Illusion Arc profile.' }]
})

const user = useSupabaseUser()
const supabase = useSupabaseClient()
const toast = useToast()
const router = useRouter()

definePageMeta({
  // Profile should require login (recommended)
  middleware: [
    () => {
      const u = useSupabaseUser()
      if (!u.value) return navigateTo('/login?next=/profile')
    }
  ]
})

const loading = ref(false)
const loadingProfile = ref(true)

const state = reactive({
  display_name: '',
  avatar_url: ''
})

const avatarFile = ref<File | null>(null)
const avatarPreview = ref<string>('')

// --- Helpers
function normalizeDisplayName(v: string) {
  const s = String(v || '').trim().replace(/\s+/g, ' ')
  // allow letters, numbers, space, underscore, dash
  const cleaned = s.replace(/[^\p{L}\p{N} _-]/gu, '')
  return cleaned.slice(0, 24)
}

function validate() {
  if (!state.display_name.trim()) return 'Please enter your display name.'
  if (normalizeDisplayName(state.display_name).length < 3) return 'Display name should be at least 3 characters.'
  return null
}

// --- Load existing profile
async function loadProfile() {
  if (!import.meta.client) return
  loadingProfile.value = true

  try {
    const u: any = user.value
    if (!u?.id) return

    // Fallback from auth metadata
    const fallbackName =
      u?.user_metadata?.display_name ||
      u?.user_metadata?.full_name ||
      u?.email?.split?.('@')?.[0] ||
      ''

    const fallbackAvatar = u?.user_metadata?.avatar_url || ''

    // Try profiles table first (if exists / allowed)
    const sb: any = supabase
    const { data, error } = await sb
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('user_id', u.id) // <-- keep your current schema
      .maybeSingle()

    // If table missing / RLS blocks select, just use fallback
    if (!error && data) {
      state.display_name = data.display_name || fallbackName
      state.avatar_url = data.avatar_url || fallbackAvatar
    } else {
      state.display_name = fallbackName
      state.avatar_url = fallbackAvatar
    }

    avatarPreview.value = state.avatar_url || ''
  } finally {
    loadingProfile.value = false
  }
}

onMounted(loadProfile)

// --- Avatar file selection
function onPickAvatar(e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  if (!f) return

  // basic checks
  if (!f.type.startsWith('image/')) {
    toast.add({ title: 'Invalid file', description: 'Please select an image.', color: 'warning' })
    return
  }
  if (f.size > 2 * 1024 * 1024) {
    toast.add({ title: 'Too large', description: 'Max 2MB image allowed.', color: 'warning' })
    return
  }

  avatarFile.value = f
  avatarPreview.value = URL.createObjectURL(f)
}

// --- Upload avatar to Supabase Storage and set avatar_url
async function uploadAvatarIfNeeded(): Promise<string | null> {
  const u: any = user.value
  if (!u?.id) throw new Error('Login required')

  if (!avatarFile.value) {
    // no new file picked; keep existing url (or empty)
    return state.avatar_url.trim() || null
  }

  const file = avatarFile.value
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
  const path = `${u.id}/${Date.now()}.${ext}`

  const { data, error } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type })

  if (error) throw error
  if (!data?.path) throw new Error('Upload failed')

  // If bucket is PUBLIC:
  const { data: pub } = supabase.storage.from('avatars').getPublicUrl(data.path)
  const url = pub?.publicUrl || ''
  if (!url) throw new Error('Could not get public URL')

  // set local state
  state.avatar_url = url
  return url
}

// --- Save profile (profiles + auth metadata)
async function save() {
  const err = validate()
  if (err) {
    toast.add({ title: 'Check the form', description: err, color: 'warning' })
    return
  }

  loading.value = true
  try {
    // ✅ Reliable auth check (no hydration race)
    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user?.id) throw new Error('Login required')

    const displayName = state.display_name.trim()

    // ✅ Save in profiles (UPSERT = create row if missing)
    const { error } = await (supabase as any)
      .from('profiles')
      .upsert(
        {
          user_id: user.id,
          display_name: displayName,
          avatar_url: state.avatar_url.trim() || null,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'user_id' }
      )

    if (error) {
      // Unique violation => duplicate name
      if ((error as any).code === '23505' || /duplicate key|unique/i.test(error.message)) {
        throw new Error('That display name is already taken. Try another one.')
      }
      throw error
    }

    // ✅ Update auth metadata too (so navbar updates immediately)
    const { error: metaErr } = await supabase.auth.updateUser({
      data: { display_name: displayName, avatar_url: state.avatar_url.trim() || null }
    })
    if (metaErr) console.warn(metaErr.message)

    // ✅ Force refresh session so UI updates now
    await supabase.auth.refreshSession()

    toast.add({ title: 'Saved', description: 'Profile updated successfully.', color: 'success' })
  } catch (e: any) {
    toast.add({ title: 'Failed', description: e?.message || 'Try again.', color: 'error' })
  } finally {
    loading.value = false
  }
}


function cancel() {
  router.push('/')
}
</script>

<template>
  <UContainer class="py-10 md:py-14">
    <div class="max-w-2xl">
      <h1 class="text-3xl md:text-5xl font-semibold tracking-tight">Profile</h1>
      <p class="mt-3 text-sm md:text-base opacity-80">
        Update your display name and avatar. This will show on leaderboards.
      </p>

      <UCard class="mt-6 bg-white/5 border-white/10">
        <template #header>
          <div class="flex items-center justify-between">
            <div class="text-lg font-semibold">Edit profile</div>
            <div v-if="loadingProfile" class="text-xs opacity-70">Loading…</div>
          </div>
        </template>

        <div class="grid gap-5">
          <!-- Avatar preview -->
          <div class="flex items-center gap-4">
            <div class="h-16 w-16 rounded-full overflow-hidden border border-white/10 bg-black/30">
              <img
                v-if="avatarPreview"
                :src="avatarPreview"
                class="h-full w-full object-cover"
                alt="Avatar preview"
                referrerpolicy="no-referrer"
              />
              <div v-else class="h-full w-full grid place-items-center text-sm opacity-70">
                N/A
              </div>
            </div>

            <div class="flex-1">
              <div class="text-sm font-semibold">Avatar</div>
              <div class="text-xs opacity-60 mt-1">
                Upload an image (max 2MB). Or paste an avatar URL below.
              </div>

              <div class="mt-3 flex flex-wrap items-center gap-2">
                <label class="inline-flex">
                  <input class="hidden" type="file" accept="image/*" @change="onPickAvatar" />
                  <UButton variant="soft" size="sm" icon="i-heroicons-arrow-up-tray">
                    Upload
                  </UButton>
                </label>

                <UButton
                  v-if="avatarPreview"
                  variant="ghost"
                  size="sm"
                  icon="i-heroicons-x-mark"
                  @click="avatarFile = null; avatarPreview = ''; state.avatar_url = ''"
                >
                  Clear
                </UButton>
              </div>
            </div>
          </div>

          <UFormGroup label="Display name" required>
            <UInput v-model="state.display_name" placeholder="Your display name" />
            <div class="mt-1 text-xs opacity-60">
              Must be unique. Letters/numbers/space/_/- only.
            </div>
          </UFormGroup>

          <UFormGroup label="Avatar URL (optional)">
            <UInput v-model="state.avatar_url" placeholder="https://..." />
          </UFormGroup>

          <div class="flex items-center justify-end gap-2">
            <UButton variant="ghost" @click="cancel">Cancel</UButton>
            <UButton color="primary" variant="solid" :loading="loading" @click="save">
              Save changes
            </UButton>
          </div>
        </div>
      </UCard>
    </div>
  </UContainer>
</template>
