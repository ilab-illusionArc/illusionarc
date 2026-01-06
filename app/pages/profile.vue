<script setup lang="ts">
useHead({
  title: 'Profile — Illusion Arc',
  meta: [{ name: 'description', content: 'Edit your Illusion Arc profile.' }]
})

const user = useSupabaseUser()
const supabase = useSupabaseClient()
const toast = useToast()

const loading = ref(false)

const state = reactive({
  display_name: '',
  avatar_url: ''
})

watchEffect(() => {
  const u: any = user.value
  state.display_name =
    u?.user_metadata?.display_name ||
    u?.user_metadata?.full_name ||
    u?.email?.split?.('@')?.[0] ||
    ''
  state.avatar_url = u?.user_metadata?.avatar_url || ''
})

function validate() {
  if (!state.display_name.trim()) return 'Please enter your name.'
  return null
}

async function save() {
  const err = validate()
  if (err) {
    toast.add({ title: 'Check the form', description: err, color: 'warning' })
    return
  }

  loading.value = true
  try {
    const payload = {
      display_name: state.display_name.trim(),
      avatar_url: state.avatar_url.trim()
    }

    const { error } = await supabase.auth.updateUser({ data: payload })
    if (error) throw error

    // ✅ Force Nuxt Supabase composables to update immediately
    await supabase.auth.refreshSession()

    // ✅ Extra safety for Safari/iOS (sometimes refreshSession isn't enough)
    await supabase.auth.getUser()

    toast.add({ title: 'Saved', description: 'Profile updated successfully.', color: 'success' })
  } catch (e: any) {
    toast.add({ title: 'Failed', description: e?.message || 'Try again.', color: 'error' })
  } finally {
    loading.value = false
  }
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
          <div class="text-lg font-semibold">Edit profile</div>
        </template>

        <div class="grid gap-4">
          <UFormGroup label="Display name" required>
            <UInput v-model="state.display_name" placeholder="Your name" />
          </UFormGroup>

          <UFormGroup label="Avatar URL (optional)">
            <UInput v-model="state.avatar_url" placeholder="https://..." />
            <div class="mt-2 text-xs opacity-60">
              Tip: later we can add an “Upload avatar” button using Supabase Storage.
            </div>
          </UFormGroup>

          <div class="flex items-center justify-end gap-2">
            <UButton variant="ghost" to="/">Cancel</UButton>
            <UButton color="primary" variant="solid" :loading="loading" @click="save">
              Save changes
            </UButton>
          </div>
        </div>
      </UCard>
    </div>
  </UContainer>
</template>
