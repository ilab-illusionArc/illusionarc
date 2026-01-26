<script setup lang="ts">
useHead({
  title: 'Profile — illusion Arc',
  meta: [{ name: 'description', content: 'Edit your Illusion Arc profile.' }]
})

const supabase = useSupabaseClient()
const toast = useToast()
const router = useRouter()

definePageMeta({
  middleware: [
    async () => {
      const supabase = useSupabaseClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return navigateTo('/login?next=/profile')
    }
  ]
})

const loading = ref(false)
const loadingProfile = ref(true)

/** ✅ New: avatar upload loader */
const avatarUploading = ref(false)

const state = reactive({
  display_name: '',
  avatar_url: '' // internal only; saved to DB on Save
})

/** Hidden file input trigger */
const avatarInput = ref<HTMLInputElement | null>(null)

/** last saved avatar (from DB) */
const savedAvatarUrl = ref('')

/** pending upload (uploaded but not yet saved to DB) */
const pending = reactive({
  path: '' as string, // storage path
  url: '' as string   // public url
})

function normalizeDisplayName(v: string) {
  const s = String(v || '').trim().replace(/\s+/g, ' ')
  const cleaned = s.replace(/[^\p{L}\p{N} _-]/gu, '')
  return cleaned.slice(0, 24)
}

function validate() {
  const dn = normalizeDisplayName(state.display_name)
  if (!dn.trim()) return 'Please enter your display name.'
  if (dn.length < 3) return 'Display name should be at least 3 characters.'
  return null
}

function openAvatarPicker() {
  if (avatarUploading.value) return
  avatarInput.value?.click()
}

function resetAvatarInput() {
  if (avatarInput.value) avatarInput.value.value = ''
}

/**
 * Extract object path from public URL:
 * .../storage/v1/object/public/avatars/<PATH>
 */
function extractAvatarPathFromPublicUrl(url: string): string | null {
  const u = String(url || '').trim()
  if (!u) return null
  const marker = '/storage/v1/object/public/avatars/'
  const idx = u.indexOf(marker)
  if (idx === -1) return null
  return u.slice(idx + marker.length) || null
}

/** Delete only if it belongs to user's folder */
async function deleteAvatarIfOwned(urlOrPath: string, userId: string, isPath = false) {
  const path = isPath ? urlOrPath : extractAvatarPathFromPublicUrl(urlOrPath)
  if (!path) return
  if (!path.startsWith(`${userId}/`)) return
  const { error } = await supabase.storage.from('avatars').remove([path])
  if (error) console.warn('Avatar delete failed:', error.message)
}

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

    const { data, error } = await (supabase as any)
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('user_id', user.id)
      .maybeSingle()

    state.display_name = (data?.display_name || fallbackName || '').trim()
    state.avatar_url = (data?.avatar_url || fallbackAvatar || '').trim()

    savedAvatarUrl.value = state.avatar_url || ''
  } finally {
    loadingProfile.value = false
  }
}

onMounted(loadProfile)

/**
 * ✅ On file pick:
 * 1) show loader
 * 2) upload immediately so avatar updates instantly
 * 3) keep "pending" markers until Save
 */
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

    // delete previous pending upload if exists
    if (pending.path) {
      await deleteAvatarIfOwned(pending.path, user.id, true)
      pending.path = ''
      pending.url = ''
    }

    // upload to a "pending" folder
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
    // tiny delay feels smoother (optional)
    setTimeout(() => { avatarUploading.value = false }, 150)
  }
}

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
    const prevSaved = savedAvatarUrl.value

    const { error } = await (supabase as any)
      .from('profiles')
      .upsert(
        {
          user_id: user.id,
          display_name: displayName,
          avatar_url: nextAvatarUrl,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'user_id' }
      )

    if (error) {
      if ((error as any).code === '23505' || /duplicate key|unique/i.test(error.message)) {
        throw new Error('That display name is already taken. Try another one.')
      }
      throw error
    }

    const { error: metaErr } = await supabase.auth.updateUser({
      data: { display_name: displayName, avatar_url: nextAvatarUrl }
    })
    if (metaErr) console.warn(metaErr.message)

    await supabase.auth.refreshSession()

    // auto-delete old saved avatar if replaced
    if (prevSaved && nextAvatarUrl && prevSaved !== nextAvatarUrl) {
      await deleteAvatarIfOwned(prevSaved, user.id, false)
    }

    savedAvatarUrl.value = nextAvatarUrl || ''

    // pending is now committed
    pending.path = ''
    pending.url = ''

    toast.add({ title: 'Saved', description: 'Profile updated successfully.', color: 'success' })
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
</script>

<template>
  <UContainer class="py-10 md:py-14">
    <div class="max-w-2xl">
      <h1 class="text-3xl md:text-5xl font-semibold tracking-tight">Profile</h1>
      <p class="mt-3 text-sm md:text-base opacity-80">
        Update your display name and avatar. Avatar shows instantly after upload, and saves on “Save changes”.
      </p>

      <UCard class="mt-6 bg-white/5 border-white/10">
        <template #header>
          <div class="flex items-center justify-between">
            <div class="text-lg font-semibold">Edit profile</div>
            <div v-if="loadingProfile" class="text-xs opacity-70">Loading…</div>
          </div>
        </template>

        <div class="grid gap-5">
          <!-- Avatar -->
          <div class="flex items-center gap-4">
            <div class="relative h-16 w-16 rounded-full overflow-hidden border border-white/10 bg-black/30">
              <img
                v-if="state.avatar_url"
                :src="state.avatar_url"
                class="h-full w-full object-cover"
                alt="Avatar"
                referrerpolicy="no-referrer"
              />
              <div v-else class="h-full w-full grid place-items-center text-sm opacity-70">N/A</div>

              <!-- ✅ Loader overlay -->
              <div
                v-if="avatarUploading"
                class="absolute inset-0 grid place-items-center bg-black/60"
              >
                <div class="flex flex-col items-center gap-1">
                  <span class="i-heroicons-arrow-path-20-solid animate-spin text-xl"></span>
                  <span class="text-[10px] opacity-90">Uploading…</span>
                </div>
              </div>
            </div>

            <div class="flex-1">
              <div class="text-sm font-semibold">Avatar</div>
              <div class="text-xs opacity-60 mt-1">
                Upload shows instantly. If you cancel, the temp avatar is deleted automatically.
              </div>

              <input
                ref="avatarInput"
                class="hidden"
                type="file"
                accept="image/*"
                @change="onPickAvatar"
              />

              <div class="mt-3 flex flex-wrap items-center gap-2">
                <UButton
                  variant="soft"
                  size="sm"
                  icon="i-heroicons-arrow-up-tray"
                  type="button"
                  :disabled="avatarUploading || loadingProfile"
                  @click="openAvatarPicker"
                >
                  Upload
                </UButton>

                <UButton
                  v-if="state.avatar_url"
                  variant="ghost"
                  size="sm"
                  icon="i-heroicons-x-mark"
                  type="button"
                  :disabled="avatarUploading || loadingProfile"
                  @click="clearAvatar"
                >
                  Clear
                </UButton>
              </div>

              <div v-if="pending.url" class="mt-2 text-xs opacity-60">
                Uploaded (not saved yet)
              </div>
            </div>
          </div>

          <UFormGroup label="Display name" required>
            <UInput
              v-model="state.display_name"
              placeholder="Your display name"
              :disabled="loadingProfile || avatarUploading"
            />
            <div class="mt-1 text-xs opacity-60">
              Must be unique. Letters/numbers/space/_/- only.
            </div>
          </UFormGroup>

          <div class="flex items-center justify-end gap-2">
            <UButton
              variant="ghost"
              type="button"
              :disabled="loading || avatarUploading"
              @click="cancel"
            >
              Cancel
            </UButton>

            <UButton
              color="primary"
              variant="solid"
              :loading="loading"
              :disabled="loadingProfile || avatarUploading"
              type="button"
              @click="save"
            >
              Save changes
            </UButton>
          </div>
        </div>
      </UCard>
    </div>
  </UContainer>
</template>
