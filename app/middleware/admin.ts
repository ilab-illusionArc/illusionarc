type RoleResponse = { role: 'admin' | 'user' | null; found: boolean }

export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.path.startsWith('/admin')) return

  const supabase = useSupabaseClient()

  // 🟡 WAIT for auth to be ready (ONLY once per navigation)
  let ready = false
  const { data: listener } = supabase.auth.onAuthStateChange(() => {
    ready = true
  })

  if (!ready) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }

  listener?.subscription?.unsubscribe()

  // 1) Must have session
  const {
    data: { session }
  } = await supabase.auth.getSession()

  if (!session) {
    return navigateTo(
      { path: '/login', query: { next: to.fullPath } },
      { replace: true }
    )
  }

  // 2) Must be admin (SERVER decides)
  const res = await $fetch<RoleResponse>('/api/auth/role', {
    credentials: 'include'
  })

  if (res.role !== 'admin') {
    return navigateTo('/', { replace: true })
  }
})
