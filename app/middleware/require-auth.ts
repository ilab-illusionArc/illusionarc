export default defineNuxtRouteMiddleware(async (to) => {
  const supabase = useSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const next = to.fullPath.startsWith('/') ? to.fullPath : '/profile'
    return navigateTo(`/login?next=${encodeURIComponent(next)}`)
  }
})
