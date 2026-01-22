export default defineNuxtRouteMiddleware(async (to) => {
  // Only protect tournament embed routes
  if (!String(to.path).startsWith('/tournaments/embed/')) return

  const user = useSupabaseUser()
  if (!user.value) return navigateTo('/login')

  // use server endpoint so it stays consistent
  const state = await $fetch<{ active: boolean }>('/api/subscriptions/me')
  if (!state.active) return navigateTo('/subscribe')
})
