<script setup lang="ts">
useHead({ title: 'Subscribe' })

const user = useSupabaseUser()

const loading = ref(true)
const activating = ref<string | null>(null)
const state = ref<any>(null)
const errorMsg = ref<string | null>(null)
const okMsg = ref<string | null>(null)

async function refresh() {
  loading.value = true
  errorMsg.value = null
  try {
    state.value = await $fetch('/api/subscriptions/me', {
      credentials: 'include'
    })
  } catch (e: any) {
    errorMsg.value = e?.data?.message || e?.message || 'Failed to load subscription status'
  } finally {
    loading.value = false
  }
}

await refresh()

function fmt(dt: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(dt))
}

const plans = [
  { code: '1d', title: '1 Day', price: 'BDT 50', note: 'Perfect for one tournament day.' },
  { code: '7d', title: '7 Days', price: 'BDT 199', note: 'Weekly tournament access.' },
  { code: '30d', title: '30 Days', price: 'BDT 499', note: 'Full monthly access.' }
] as const

async function activate(planCode: typeof plans[number]['code']) {
  okMsg.value = null
  errorMsg.value = null

  if (!user.value) {
    errorMsg.value = 'Please log in first.'
    return
  }

  activating.value = planCode
  try {
    // ✅ EXACTLY what you requested
    await $fetch('/api/subscriptions/activate', {
      method: 'POST',
      credentials: 'include',
      body: { planCode }
    })

    okMsg.value = 'Subscription activated (dummy).'

    // ✅ refresh status exactly as requested
    await refresh()
  } catch (e: any) {
    errorMsg.value = e?.data?.message || e?.message || 'Activation failed'
  } finally {
    activating.value = null
  }
}
</script>

<template>
  <UContainer class="py-10">
    <div class="flex items-end justify-between gap-4">
      <div>
        <h1 class="text-3xl font-semibold">Subscription</h1>
        <p class="mt-2 opacity-80">Required to play tournaments. (Dummy activation for now.)</p>
      </div>
    </div>

    <div v-if="loading" class="mt-8 rounded-xl border border-white/10 bg-white/5 p-6 opacity-80">
      Loading…
    </div>

    <div v-else class="mt-8">
      <div v-if="okMsg" class="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm">
        {{ okMsg }}
      </div>
      <div v-if="errorMsg" class="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm">
        {{ errorMsg }}
      </div>

      <div class="rounded-xl border border-white/10 bg-white/5 p-5">
        <div class="text-lg font-semibold">Your Status</div>

        <div v-if="!user" class="mt-2 text-sm opacity-80">
          You are not logged in.
        </div>

        <div v-else-if="state?.active" class="mt-3 text-sm">
          ✅ Active subscription
          <div class="mt-2 opacity-80">
            Ends: <span class="font-medium">{{ fmt(state.subscription.ends_at) }}</span>
          </div>
          <div class="mt-1 opacity-80">
            Plan:
            <span class="font-medium">{{ state.subscription.subscription_plans?.title || '—' }}</span>
          </div>
        </div>

        <div v-else class="mt-3 text-sm opacity-80">
          ❌ No active subscription
        </div>

        <div class="mt-4">
          <UButton variant="soft" class="!rounded-full" @click="refresh">
            Refresh status
          </UButton>
        </div>
      </div>

      <div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="p in plans"
          :key="p.code"
          class="rounded-xl border border-white/10 bg-white/5 p-5"
        >
          <div class="text-lg font-semibold">{{ p.title }}</div>
          <div class="mt-1 text-2xl font-semibold">{{ p.price }}</div>
          <div class="mt-2 text-sm opacity-80">{{ p.note }}</div>

          <UButton
            class="mt-4 !rounded-full w-full"
            :loading="activating === p.code"
            @click="activate(p.code)"
          >
            Activate (Dummy)
          </UButton>
        </div>
      </div>

      <div class="mt-8 rounded-xl border border-white/10 bg-white/5 p-5 text-sm opacity-80">
        Later, we’ll replace “Dummy” with bKash/SSLCommerz and only activate after payment success.
      </div>
    </div>
  </UContainer>
</template>
