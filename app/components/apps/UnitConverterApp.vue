<script setup lang="ts">
type Category =
  | 'Length'
  | 'Weight'
  | 'Temperature'
  | 'Area'
  | 'Volume'
  | 'Speed'
  | 'Time'
  | 'Data'

type UnitDef = {
  key: string
  label: string
  toBase?: number
}

type SelectItem = { label: string; value: string }

const STORAGE_KEY = 'illusionarc.unit_converter.v1'
const toast = useToast()

/* ---------------- Units ---------------- */
// Base units:
// Length: meter
// Weight: kilogram
// Area: square meter
// Volume: liter
// Speed: meter/second
// Time: second
// Data: byte

const units: Record<Exclude<Category, 'Temperature'>, UnitDef[]> = {
  Length: [
    { key: 'm', label: 'Meter (m)', toBase: 1 },
    { key: 'km', label: 'Kilometer (km)', toBase: 1000 },
    { key: 'cm', label: 'Centimeter (cm)', toBase: 0.01 },
    { key: 'mm', label: 'Millimeter (mm)', toBase: 0.001 },
    { key: 'in', label: 'Inch (in)', toBase: 0.0254 },
    { key: 'ft', label: 'Foot (ft)', toBase: 0.3048 },
    { key: 'yd', label: 'Yard (yd)', toBase: 0.9144 },
    { key: 'mi', label: 'Mile (mi)', toBase: 1609.344 }
  ],
  Weight: [
    { key: 'kg', label: 'Kilogram (kg)', toBase: 1 },
    { key: 'g', label: 'Gram (g)', toBase: 0.001 },
    { key: 'mg', label: 'Milligram (mg)', toBase: 0.000001 },
    { key: 'lb', label: 'Pound (lb)', toBase: 0.45359237 },
    { key: 'oz', label: 'Ounce (oz)', toBase: 0.028349523125 }
  ],
  Area: [
    { key: 'm2', label: 'Square meter (m²)', toBase: 1 },
    { key: 'km2', label: 'Square kilometer (km²)', toBase: 1_000_000 },
    { key: 'cm2', label: 'Square centimeter (cm²)', toBase: 0.0001 },
    { key: 'ha', label: 'Hectare (ha)', toBase: 10_000 },
    { key: 'acre', label: 'Acre', toBase: 4046.8564224 },
    { key: 'ft2', label: 'Square foot (ft²)', toBase: 0.09290304 }
  ],
  Volume: [
    { key: 'l', label: 'Liter (L)', toBase: 1 },
    { key: 'ml', label: 'Milliliter (mL)', toBase: 0.001 },
    { key: 'm3', label: 'Cubic meter (m³)', toBase: 1000 },
    { key: 'gal', label: 'US Gallon (gal)', toBase: 3.785411784 },
    { key: 'qt', label: 'US Quart (qt)', toBase: 0.946352946 },
    { key: 'pt', label: 'US Pint (pt)', toBase: 0.473176473 },
    { key: 'cup', label: 'US Cup', toBase: 0.2365882365 },
    { key: 'floz', label: 'US Fluid ounce (fl oz)', toBase: 0.0295735295625 }
  ],
  Speed: [
    { key: 'mps', label: 'Meters/second (m/s)', toBase: 1 },
    { key: 'kph', label: 'Kilometers/hour (km/h)', toBase: 0.2777777777778 },
    { key: 'mph', label: 'Miles/hour (mph)', toBase: 0.44704 },
    { key: 'knot', label: 'Knot (kn)', toBase: 0.514444 }
  ],
  Time: [
    { key: 's', label: 'Second (s)', toBase: 1 },
    { key: 'min', label: 'Minute (min)', toBase: 60 },
    { key: 'h', label: 'Hour (h)', toBase: 3600 },
    { key: 'day', label: 'Day', toBase: 86400 },
    { key: 'week', label: 'Week', toBase: 604800 }
  ],
  Data: [
    { key: 'b', label: 'Byte (B)', toBase: 1 },
    { key: 'kb', label: 'Kilobyte (KB)', toBase: 1000 },
    { key: 'mb', label: 'Megabyte (MB)', toBase: 1_000_000 },
    { key: 'gb', label: 'Gigabyte (GB)', toBase: 1_000_000_000 },
    { key: 'tb', label: 'Terabyte (TB)', toBase: 1_000_000_000_000 },
    { key: 'kib', label: 'Kibibyte (KiB)', toBase: 1024 },
    { key: 'mib', label: 'Mebibyte (MiB)', toBase: 1_048_576 },
    { key: 'gib', label: 'Gibibyte (GiB)', toBase: 1_073_741_824 }
  ]
}

const tempUnits: UnitDef[] = [
  { key: 'c', label: 'Celsius (°C)' },
  { key: 'f', label: 'Fahrenheit (°F)' },
  { key: 'k', label: 'Kelvin (K)' }
]

/* ---------------- State ---------------- */
const category = ref<Category>('Length')
const fromUnit = ref('m')
const toUnit = ref('km')
const input = ref('1')
const precision = ref(6)

const lastEdited = ref<'input' | 'result'>('input')
const resultInput = ref('')

/* ---------------- Persistence ---------------- */
function save() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        category: category.value,
        fromUnit: fromUnit.value,
        toUnit: toUnit.value,
        input: input.value,
        precision: precision.value
      })
    )
  } catch {}
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const s = JSON.parse(raw)
    if (s?.category) category.value = s.category
    if (s?.fromUnit) fromUnit.value = s.fromUnit
    if (s?.toUnit) toUnit.value = s.toUnit
    if (typeof s?.input === 'string') input.value = s.input
    if (typeof s?.precision === 'number') precision.value = s.precision
  } catch {}
}

/* ---------------- Select items ---------------- */
const categoryItems = computed<SelectItem[]>(() => {
  const cats: Category[] = ['Length', 'Weight', 'Temperature', 'Area', 'Volume', 'Speed', 'Time', 'Data']
  return cats.map((c) => ({ label: c, value: c }))
})

const unitItems = computed<SelectItem[]>(() => {
  const list = category.value === 'Temperature'
    ? tempUnits
    : units[category.value as Exclude<Category, 'Temperature'>]

  return list.map((u) => ({ label: u.label, value: u.key }))
})

function getUnitDef(key: string): UnitDef | null {
  if (category.value === 'Temperature') return tempUnits.find((u) => u.key === key) || null
  return units[category.value as Exclude<Category, 'Temperature'>].find((u) => u.key === key) || null
}

/* ---------------- Math ---------------- */
function parseNum(s: string) {
  const x = Number(String(s).replaceAll(',', '').trim())
  return Number.isFinite(x) ? x : null
}

function formatNum(x: number) {
  if (!Number.isFinite(x)) return ''
  const p = Math.max(0, Math.min(12, precision.value))
  const s = x.toFixed(p)
  return s.replace(/\.?0+$/, '')
}

function convertTemperature(x: number, from: string, to: string) {
  let c: number
  if (from === 'c') c = x
  else if (from === 'f') c = (x - 32) * (5 / 9)
  else c = x - 273.15

  if (to === 'c') return c
  if (to === 'f') return c * (9 / 5) + 32
  return c + 273.15
}

function convertLinear(x: number, from: string, to: string) {
  const f = getUnitDef(from)
  const t = getUnitDef(to)
  if (!f?.toBase || !t?.toBase) return null
  const base = x * f.toBase
  return base / t.toBase
}

const computedResult = computed(() => {
  const x = parseNum(input.value)
  if (x == null) return ''
  if (category.value === 'Temperature') return formatNum(convertTemperature(x, fromUnit.value, toUnit.value))
  const y = convertLinear(x, fromUnit.value, toUnit.value)
  return y == null ? '' : formatNum(y)
})

const computedBack = computed(() => {
  const x = parseNum(resultInput.value)
  if (x == null) return ''
  if (category.value === 'Temperature') return formatNum(convertTemperature(x, toUnit.value, fromUnit.value))
  const y = convertLinear(x, toUnit.value, fromUnit.value)
  return y == null ? '' : formatNum(y)
})

function swapUnits() {
  const a = fromUnit.value
  fromUnit.value = toUnit.value
  toUnit.value = a

  const aIn = input.value
  input.value = resultInput.value || computedResult.value || aIn
  resultInput.value = aIn

  save()
}

function ensureDefaultsForCategory() {
  if (category.value === 'Length') {
    fromUnit.value = 'm'; toUnit.value = 'km'
  } else if (category.value === 'Weight') {
    fromUnit.value = 'kg'; toUnit.value = 'lb'
  } else if (category.value === 'Temperature') {
    fromUnit.value = 'c'; toUnit.value = 'f'
  } else if (category.value === 'Area') {
    fromUnit.value = 'm2'; toUnit.value = 'ft2'
  } else if (category.value === 'Volume') {
    fromUnit.value = 'l'; toUnit.value = 'ml'
  } else if (category.value === 'Speed') {
    fromUnit.value = 'kph'; toUnit.value = 'mph'
  } else if (category.value === 'Time') {
    fromUnit.value = 'min'; toUnit.value = 's'
  } else {
    fromUnit.value = 'mb'; toUnit.value = 'gb'
  }
  input.value = '1'
  resultInput.value = ''
}

function copyResult() {
  const txt = computedResult.value
  if (!txt) return
  navigator.clipboard
    ?.writeText(txt)
    .then(() => toast.add({ title: 'Copied', description: 'Result copied to clipboard.' }))
    .catch(() => toast.add({ title: 'Copy failed', description: 'Clipboard permission denied.' }))
}

onMounted(() => load())

watch(category, () => {
  ensureDefaultsForCategory()
  save()
})

watch([fromUnit, toUnit, precision], save)

watch(computedResult, (v) => {
  if (lastEdited.value === 'input') resultInput.value = v
})

watch(computedBack, (v) => {
  if (lastEdited.value === 'result') input.value = v
})

function onInputFocus() {
  lastEdited.value = 'input'
}
function onResultFocus() {
  lastEdited.value = 'result'
}
</script>

<template>
  <div class="mx-auto w-full max-w-4xl">
    <div
      class="rounded-3xl border border-black/10 bg-white/60 p-5 shadow-sm backdrop-blur
             dark:border-white/10 dark:bg-black/20"
    >
      <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 class="text-2xl font-semibold">Unit Converter</h2>
          <p class="mt-1 text-sm text-black/60 dark:text-white/60">
            Fast conversions across common units. Works offline.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <!-- ✅ FIX: use :items (not :options) -->
          <USelect v-model="category" :items="categoryItems" class="w-48" />

          <div
            class="flex items-center gap-2 rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm
                   dark:border-white/10 dark:bg-black/25"
          >
            <span class="text-black/60 dark:text-white/60">Precision</span>
            <input
              v-model.number="precision"
              type="number"
              min="0"
              max="12"
              class="w-14 bg-transparent text-right outline-none"
            />
          </div>

          <UButton variant="soft" icon="i-heroicons-clipboard" @click="copyResult">
            Copy
          </UButton>
        </div>
      </div>

      <div class="mt-6 grid gap-4 md:grid-cols-12">
        <div class="md:col-span-5">
          <div class="rounded-3xl border border-black/10 bg-white/70 p-4 dark:border-white/10 dark:bg-black/25">
            <div class="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">From</div>

            <div class="mt-3 grid gap-3">
              <UInput v-model="input" inputmode="decimal" placeholder="Enter value" @focus="onInputFocus" />
              <!-- ✅ FIX -->
              <USelect v-model="fromUnit" :items="unitItems" />
            </div>
          </div>
        </div>

        <div class="md:col-span-2 grid place-items-center">
          <UButton
            variant="soft"
            icon="i-heroicons-arrows-right-left"
            class="rounded-2xl"
            @click="swapUnits"
          >
            Swap
          </UButton>
        </div>

        <div class="md:col-span-5">
          <div class="rounded-3xl border border-black/10 bg-white/70 p-4 dark:border-white/10 dark:bg-black/25">
            <div class="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">To</div>

            <div class="mt-3 grid gap-3">
              <UInput v-model="resultInput" inputmode="decimal" placeholder="Result" @focus="onResultFocus" />
              <!-- ✅ FIX -->
              <USelect v-model="toUnit" :items="unitItems" />
            </div>

            <div class="mt-3 text-xs text-black/55 dark:text-white/55">
              Tip: You can edit the result field to convert back.
            </div>
          </div>
        </div>
      </div>

      <div class="mt-4 text-xs text-black/50 dark:text-white/50">
        Temperature uses proper formula; others use linear scaling against a base unit.
      </div>
    </div>
  </div>
</template>
