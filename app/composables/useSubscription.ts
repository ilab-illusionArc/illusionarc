// app/composables/useSubscriptions.ts
export function useSubscription() {
  const me = () => {
    const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
    return $fetch('/api/subscriptions/me', {
      credentials: 'include',
      headers,
      // ✅ avoid any client-side caching behavior
      cache: 'no-store'
    })
  }

  const dummyActivate = (planCode: string) => {
    const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
    return $fetch('/api/subscriptions/activate', {
      method: 'POST',
      credentials: 'include',
      headers,
      body: { planCode }
    })
  }

  return { me, dummyActivate }
}
