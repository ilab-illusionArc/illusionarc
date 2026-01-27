<script setup lang="ts">
const supabase = useSupabaseClient()
const user = useSupabaseUser()
const route = useRoute()
const toast = useToast()

type CountryOpt = { label: string; dial: string; iso: string }

/** Keep it light. You can expand later (or load from a JSON). */
const COUNTRY_CODES: CountryOpt[] = [
  { label: '🇺🇸 United States (+1)', dial: '+1', iso: 'US' },
  { label: '🇬🇧 United Kingdom (+44)', dial: '+44', iso: 'GB' },
  { label: '🇨🇦 Canada (+1)', dial: '+1', iso: 'CA' },
  { label: '🇦🇺 Australia (+61)', dial: '+61', iso: 'AU' },
  { label: '🇩🇪 Germany (+49)', dial: '+49', iso: 'DE' },
  { label: '🇫🇷 France (+33)', dial: '+33', iso: 'FR' },
  { label: '🇮🇹 Italy (+39)', dial: '+39', iso: 'IT' },
  { label: '🇪🇸 Spain (+34)', dial: '+34', iso: 'ES' },
  { label: '🇳🇱 Netherlands (+31)', dial: '+31', iso: 'NL' },
  { label: '🇸🇪 Sweden (+46)', dial: '+46', iso: 'SE' },
  { label: '🇳🇴 Norway (+47)', dial: '+47', iso: 'NO' },
  { label: '🇩🇰 Denmark (+45)', dial: '+45', iso: 'DK' },
  { label: '🇧🇷 Brazil (+55)', dial: '+55', iso: 'BR' },
  { label: '🇲🇽 Mexico (+52)', dial: '+52', iso: 'MX' },
  { label: '🇦🇷 Argentina (+54)', dial: '+54', iso: 'AR' },
  { label: '🇮🇳 India (+91)', dial: '+91', iso: 'IN' },
  { label: '🇵🇰 Pakistan (+92)', dial: '+92', iso: 'PK' },
  { label: '🇧🇩 Bangladesh (+880)', dial: '+880', iso: 'BD' },
  { label: '🇱🇰 Sri Lanka (+94)', dial: '+94', iso: 'LK' },
  { label: '🇳🇵 Nepal (+977)', dial: '+977', iso: 'NP' },
  { label: '🇯🇵 Japan (+81)', dial: '+81', iso: 'JP' },
  { label: '🇰🇷 South Korea (+82)', dial: '+82', iso: 'KR' },
  { label: '🇨🇳 China (+86)', dial: '+86', iso: 'CN' },
  { label: '🇸🇬 Singapore (+65)', dial: '+65', iso: 'SG' },
  { label: '🇲🇾 Malaysia (+60)', dial: '+60', iso: 'MY' },
  { label: '🇹🇭 Thailand (+66)', dial: '+66', iso: 'TH' },
  { label: '🇮🇩 Indonesia (+62)', dial: '+62', iso: 'ID' },
  { label: '🇵🇭 Philippines (+63)', dial: '+63', iso: 'PH' },
  { label: '🇦🇪 UAE (+971)', dial: '+971', iso: 'AE' },
  { label: '🇸🇦 Saudi Arabia (+966)', dial: '+966', iso: 'SA' },
  { label: '🇪🇬 Egypt (+20)', dial: '+20', iso: 'EG' },
  { label: '🇿🇦 South Africa (+27)', dial: '+27', iso: 'ZA' }
]

const selectedCountry = ref<CountryOpt>(COUNTRY_CODES.find(c => c.iso === 'BD') || COUNTRY_CODES[0])
const phoneLocal = ref('')

const open = ref(false)
const loading = ref(false)
const checking = ref(false)
const errMsg = ref('')

function onlyDigits(v: string) {
  return String(v || '').replace(/[^\d]/g, '')
}

function toE164(dial: string, local: string) {
  const d = String(dial || '').trim()
  let n = onlyDigits(local)

  // Small UX polish: strip leading 0s (common local format)
  n = n.replace(/^0+/, '')

  if (!d.startsWith('+')) return ''
  if (!n) return ''
  return `${d}${n}`
}

function validateLocal(local: string) {
  const n = onlyDigits(local).replace(/^0+/, '')
  // Reasonable global bounds
  if (n.length < 6 || n.length > 14) return 'Please enter a valid phone number.'
  return null
}

async function fetchMyPhone(userId: string) {
  try {
    const client: any = supabase
    const { data, error } = await client
      .from('profiles')
      .select('phone')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) return ''
    return String(data?.phone || '').trim()
  } catch {
    return ''
  }
}

async function enforce() {
  // Don’t show on login page
  if (route.path.startsWith('/login')) return

  const u: any = user.value
  if (!u?.id) return

  if (checking.value) return
  checking.value = true
  try {
    const phone = await fetchMyPhone(u.id)
    if (phone) {
      open.value = false
      return
    }

    // Prefill from metadata if available
    const md = u.user_metadata || {}
    const metaPhone = String(md.phone || '').trim()
    if (metaPhone.startsWith('+')) {
      // basic parse: dial code best-effort (keeps things simple)
      // user can still edit
    }

    open.value = true
  } finally {
    checking.value = false
  }
}

watch(() => user.value?.id, enforce, { immediate: true })
watch(() => route.path, enforce)

async function savePhone() {
  errMsg.value = ''
  const vErr = validateLocal(phoneLocal.value)
  if (vErr) {
    errMsg.value = vErr
    return
  }

  const u: any = user.value
  if (!u?.id) return

  const e164 = toE164(selectedCountry.value.dial, phoneLocal.value)
  if (!e164) {
    errMsg.value = 'Please enter a valid phone number.'
    return
  }

  loading.value = true
  try {
    const client: any = supabase
    const { error } = await client
      .from('profiles')
      .update({ phone: e164, updated_at: new Date().toISOString() })
      .eq('user_id', u.id)

    if (error) {
      if ((error as any).code === '23505' || /duplicate key|unique/i.test(error.message)) {
        throw new Error('This phone number is already used by another account.')
      }
      throw error
    }

    // keep in auth metadata too (optional but useful)
    const { error: metaErr } = await supabase.auth.updateUser({ data: { phone: e164 } })
    if (metaErr) console.warn(metaErr.message)

    await supabase.auth.refreshSession()

    toast.add({ title: 'Saved', description: 'Phone number added successfully.', color: 'success' })
    open.value = false
  } catch (e: any) {
    errMsg.value = e?.message || 'Failed to save phone number.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UModal v-model="open" :prevent-close="true">
    <div class="p-4 sm:p-5">
      <div class="flex items-start gap-3">
        <div class="mt-0.5 grid place-items-center h-10 w-10 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
          <UIcon name="i-heroicons-device-phone-mobile" class="h-5 w-5 opacity-80" />
        </div>

        <div class="min-w-0">
          <div class="text-lg font-semibold text-black dark:text-white">Phone number required</div>
          <div class="mt-1 text-sm text-black/60 dark:text-white/60">
            To continue, please add a unique phone number to your profile. You can’t skip this step.
          </div>
        </div>
      </div>

      <div class="mt-4 grid gap-3 sm:grid-cols-[220px_1fr]">
        <UFormGroup label="Country code" required>
          <USelectMenu v-model="selectedCountry" :options="COUNTRY_CODES" searchable class="w-full">
            <template #label>
              <span class="truncate">{{ selectedCountry.label }}</span>
            </template>
            <template #option="{ option }">
              <span class="truncate">{{ option.label }}</span>
            </template>
          </USelectMenu>
        </UFormGroup>

        <UFormGroup label="Phone number" required>
          <UInput
            v-model="phoneLocal"
            class="w-full"
            placeholder="Your phone number"
            autocomplete="tel"
            icon="i-heroicons-phone"
          />
          <div class="mt-1 text-xs opacity-60">
            We’ll store it like: <span class="opacity-100">{{ selectedCountry.dial }}{{ phoneLocal.replace(/[^\d]/g, '').replace(/^0+/, '') }}</span>
          </div>
        </UFormGroup>
      </div>

      <div v-if="errMsg" class="mt-2 text-sm text-red-600 dark:text-red-400">
        {{ errMsg }}
      </div>

      <div class="mt-4 flex items-center justify-end">
        <UButton color="primary" variant="solid" :loading="loading" @click="savePhone">
          Save phone
        </UButton>
      </div>
    </div>
  </UModal>
</template>
