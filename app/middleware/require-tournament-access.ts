export default defineNuxtRouteMiddleware(async (to) => {
    if (!to.path.startsWith('/tournaments/embed/')) return

    // must be logged in (client-side state might be empty on SSR)
    const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined

    // Check subscription (server will read cookies from headers)
    const s: any = await $fetch('/api/subscriptions/me', {
        credentials: 'include',
        headers
    })

    if (!s?.user?.id) {
        return navigateTo({ path: '/login', query: { next: to.fullPath } })
    }

    if (!s?.active) {
        return navigateTo({ path: '/subscribe', query: { next: to.fullPath } })
    }
})
