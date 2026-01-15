type RoleResponse = { role: 'admin' | 'user' | null; found: boolean }

export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.path.startsWith('/admin')) return

  // Client-only guard (since /admin is ssr:false)
  const supabase = useSupabaseClient()

  // 1) Must have session
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return navigateTo({ path: '/login', query: { next: to.fullPath } })
  }

  // 2) Must be admin
  const res = await $fetch<RoleResponse>('/api/auth/role')
  if (res.role !== 'admin') {
    // redirect BEFORE page paints
    return navigateTo('/', { replace: true })
  }
})
