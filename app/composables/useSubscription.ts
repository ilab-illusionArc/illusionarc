export type SubscriptionMe = {
  user: { id: string } | null
  active: boolean
  subscription: any | null
}

export function useSubscription() {
  async function me() {
    return await $fetch<SubscriptionMe>('/api/subscriptions/me')
  }

  async function dummyActivate(planCode: '1d' | '7d' | '30d') {
    return await $fetch('/api/subscriptions/dummy-activate', {
      method: 'POST',
      body: { planCode }
    })
  }

  return { me, dummyActivate }
}
