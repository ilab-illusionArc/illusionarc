// app/composables/useSubscriptions.ts  (your file name is fine)
export function useSubscription() {
  const me = () => {
    const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
    return $fetch('/api/subscriptions/me', { credentials: 'include', headers })
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
