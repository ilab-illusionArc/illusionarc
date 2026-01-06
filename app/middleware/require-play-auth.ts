export default defineNuxtRouteMiddleware((to) => {
  // Only guard "play mode" on arcade game pages
  const isArcadeGame = to.path.startsWith('/arcade/')
  const wantsPlay = String(to.query.play || '') === '1'
  if (!isArcadeGame || !wantsPlay) return

  const user = useSupabaseUser()

  // If not logged in → go to /login and come back to this exact URL after login
  if (!user.value) {
    return navigateTo({ path: '/login', query: { next: to.fullPath } })
  }
})
