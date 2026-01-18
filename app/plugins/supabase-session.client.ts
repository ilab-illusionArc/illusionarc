export default defineNuxtPlugin(async () => {
  const supabase = useSupabaseClient()

  // Try to hydrate session early
  const { data } = await supabase.auth.getSession()
  if (data.session) {
    // triggers reactive user updates in Nuxt
    await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token
    })
  }

  // Debug (remove later)
  const user = useSupabaseUser()
  watchEffect(() => {
    console.log('[bootstrap] user:', user.value?.id || null)
  })
})
