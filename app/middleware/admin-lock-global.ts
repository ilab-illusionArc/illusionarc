type RoleResponse = { role: 'admin' | 'user' | null; found: boolean }

export default defineNuxtRouteMiddleware(async (to) => {
  if (process.server) return

  // allow these always
  const allow = [
    '/admin',
    '/login',
    '/logout',
  ]

  // Allow all /api routes (important)
  if (to.path.startsWith('/api')) return

  // If route is /admin or any subpage, allow
  if (to.path.startsWith('/admin')) return

  // If route is explicitly allowed
  if (allow.some((p) => to.path === p)) return

  // Only act when logged in
  const supabase = useSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  // Ask server role
  const res = await $fetch<RoleResponse>('/api/auth/role')
  if (res.role === 'admin') {
    // ✅ lock admin inside admin area
    return navigateTo('/admin', { replace: true })
  }
})
