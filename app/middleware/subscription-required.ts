// app/middleware/subscription-required.ts
export default defineNuxtRouteMiddleware(async (to) => {
  // Only protect tournament embed routes
  if (!String(to.path).startsWith('/tournaments/embed/')) return

  // ✅ Always use API state (server knows auth from cookie)
  const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined

  let state: { user: { id: string } | null; active: boolean } | null = null
  try {
    state = await $fetch('/api/subscriptions/me', {
      credentials: 'include',
      headers,
      cache: 'no-store'
    })
  } catch {
    state = { user: null, active: false }
  }

  // Not logged in
  if (!state?.user) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }

  // Not subscribed
  if (!state.active) {
    return navigateTo(`/subscribe?redirect=${encodeURIComponent(to.fullPath)}`)
  }
})
