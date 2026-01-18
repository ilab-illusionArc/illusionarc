type RoleResponse = { role: 'admin' | 'user' | null; found: boolean }

export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.path.startsWith('/admin')) return

  const supabase = useSupabaseClient()

  // ✅ Always get session directly (this is the truth)
  const { data, error } = await supabase.auth.getSession()
  const session = data?.session

  if (error) {
    console.warn('getSession error:', error.message)
  }

  if (!session) {
    return navigateTo({ path: '/login', query: { next: to.fullPath } }, { replace: true })
  }

  // ✅ Role check (server decides)
  const res = await $fetch<RoleResponse>('/api/auth/role', { credentials: 'include' })
  if (res.role !== 'admin') {
    return navigateTo('/', { replace: true })
  }
})
