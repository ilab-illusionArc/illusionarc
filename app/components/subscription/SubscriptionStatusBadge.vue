<script setup lang="ts">
defineProps<{
  active: boolean
  endsAt?: string | null
}>()

function fmt(dt?: string | null) {
  if (!dt) return ''
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(dt))
}
</script>

<template>
  <div
    class="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs"
    :class="active ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-white/10 bg-white/5 text-white/70'"
  >
    <span>{{ active ? 'Subscription Active' : 'Subscription Required' }}</span>
    <span v-if="active && endsAt" class="opacity-80">· Ends {{ fmt(endsAt) }}</span>
  </div>
</template>
