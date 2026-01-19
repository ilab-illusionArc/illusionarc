<script setup lang="ts">
type Segment = {
  id: string
  title: string
  seconds: number
  done: boolean
}

const STORAGE_KEY = 'illusionarc.meeting_timer.v1'

/* ---------------- State ---------------- */
const running = ref(false)
const paused = ref(false)

const segments = ref<Segment[]>([])
const activeIndex = ref(0)

const remaining = ref(0) // seconds remaining for active segment
const totalRemaining = ref(0) // seconds remaining for whole agenda

const enableBeep = ref(true)
const enableVibrate = ref(true)
const autoNext = ref(true)

const showEditor = ref(false)

/* Editor fields */
const newTitle = ref('')
const newMinutes = ref<number | null>(5)

/* Timer */
let tick: any = null
let lastTick = 0

const toast = useToast()

/* ---------------- Utils ---------------- */
function uid() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function fmt(sec: number) {
  const s = Math.max(0, Math.floor(sec))
  const m = Math.floor(s / 60)
  const r = s % 60
  const hh = Math.floor(m / 60)
  const mm = m % 60
  if (hh > 0) return `${hh}:${String(mm).padStart(2, '0')}:${String(r).padStart(2, '0')}`
  return `${mm}:${String(r).padStart(2, '0')}`
}

function sumRemainingFrom(index: number) {
  let t = 0
  for (let i = index; i < segments.value.length; i++) {
    if (!segments.value[i].done) t += segments.value[i].seconds
  }
  return t
}

function save() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        segments: segments.value,
        activeIndex: activeIndex.value,
        remaining: remaining.value,
        settings: {
          enableBeep: enableBeep.value,
          enableVibrate: enableVibrate.value,
          autoNext: autoNext.value
        }
      })
    )
  } catch {
    // ignore
  }
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return false
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed?.segments)) segments.value = parsed.segments
    if (typeof parsed?.activeIndex === 'number') activeIndex.value = parsed.activeIndex
    if (typeof parsed?.remaining === 'number') remaining.value = parsed.remaining

    if (parsed?.settings) {
      enableBeep.value = !!parsed.settings.enableBeep
      enableVibrate.value = !!parsed.settings.enableVibrate
      autoNext.value = !!parsed.settings.autoNext
    }
    return true
  } catch {
    return false
  }
}

function beep() {
  if (!enableBeep.value) return
  try {
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.value = 0.05
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    setTimeout(() => {
      osc.stop()
      ctx.close?.()
    }, 180)
  } catch {
    // ignore
  }
}

function vibrate(ms = 120) {
  if (!enableVibrate.value) return
  try {
    navigator.vibrate?.(ms)
  } catch {
    // ignore
  }
}

/* ---------------- Setup defaults ---------------- */
function seedDefaultAgenda() {
  const s = (title: string, minutes: number): Segment => ({
    id: uid(),
    title,
    seconds: minutes * 60,
    done: false
  })

  segments.value = [
    s('Opening & updates', 5),
    s('Main discussion', 15),
    s('Decisions', 5),
    s('Action items', 5)
  ]
  activeIndex.value = 0
  remaining.value = segments.value[0].seconds
  recalcTotals()
  save()
}

function recalcTotals() {
  const current = segments.value[activeIndex.value]
  // if current exists and not done, remaining should not exceed current seconds
  if (current && !current.done) remaining.value = clamp(remaining.value || current.seconds, 0, current.seconds)
  totalRemaining.value =
    (current && !current.done ? remaining.value : 0) +
    sumRemainingFrom(activeIndex.value + 1)
}

/* ---------------- Timer control ---------------- */
function start() {
  if (!segments.value.length) seedDefaultAgenda()

  const cur = segments.value[activeIndex.value]
  if (!cur) return

  if (cur.done) {
    // jump to next active
    const next = segments.value.findIndex((x) => !x.done)
    if (next === -1) return
    activeIndex.value = next
    remaining.value = segments.value[next].seconds
  }

  running.value = true
  paused.value = false
  lastTick = performance.now()

  if (tick) clearInterval(tick)
  tick = setInterval(onTick, 250)

  recalcTotals()
  save()
}

function pause() {
  if (!running.value) return
  paused.value = true
  running.value = false
  if (tick) clearInterval(tick)
  tick = null
  save()
}

function resume() {
  if (running.value) return
  if (paused.value) {
    running.value = true
    paused.value = false
    lastTick = performance.now()
    if (tick) clearInterval(tick)
    tick = setInterval(onTick, 250)
  } else {
    start()
  }
}

function stop() {
  running.value = false
  paused.value = false
  if (tick) clearInterval(tick)
  tick = null
  // reset remaining to current segment full time
  const cur = segments.value[activeIndex.value]
  if (cur) remaining.value = cur.seconds
  recalcTotals()
  save()
}

function onTick() {
  const now = performance.now()
  const dt = (now - lastTick) / 1000
  lastTick = now
  if (!running.value) return

  remaining.value = Math.max(0, remaining.value - dt)
  recalcTotals()

  if (remaining.value <= 0.02) {
    // segment ended
    onSegmentEnd()
  }
}

function onSegmentEnd() {
  // finalize
  const cur = segments.value[activeIndex.value]
  if (!cur) return
  cur.done = true
  remaining.value = 0
  beep()
  vibrate()

  toast.add({ title: 'Segment finished', description: cur.title })

  if (autoNext.value) {
    nextSegment(true)
  } else {
    pause()
  }
  save()
}

function nextSegment(fromAuto = false) {
  const next = segments.value.findIndex((x, idx) => idx > activeIndex.value && !x.done)
  if (next === -1) {
    // done
    running.value = false
    paused.value = false
    if (tick) clearInterval(tick)
    tick = null
    toast.add({ title: 'Meeting complete', description: 'All segments finished.' })
    return
  }

  activeIndex.value = next
  remaining.value = segments.value[next].seconds
  recalcTotals()

  if (fromAuto && running.value) {
    // keep running
  } else if (!running.value && !paused.value) {
    // noop
  }
}

function prevSegment() {
  const prev = [...segments.value]
    .map((x, idx) => ({ x, idx }))
    .filter((o) => o.idx < activeIndex.value && !o.x.done)
    .map((o) => o.idx)
    .pop()

  if (prev == null) return
  activeIndex.value = prev
  remaining.value = segments.value[prev].seconds
  recalcTotals()
  save()
}

function selectSegment(idx: number) {
  const s = segments.value[idx]
  if (!s || s.done) return
  activeIndex.value = idx
  remaining.value = s.seconds
  recalcTotals()
  save()
}

function markDone(idx: number) {
  const s = segments.value[idx]
  if (!s) return
  s.done = true
  if (idx === activeIndex.value) {
    remaining.value = 0
    recalcTotals()
    if (autoNext.value) nextSegment()
  }
  save()
}

function resetAgenda() {
  running.value = false
  paused.value = false
  if (tick) clearInterval(tick)
  tick = null

  for (const s of segments.value) s.done = false
  activeIndex.value = 0
  remaining.value = segments.value[0]?.seconds || 0
  recalcTotals()
  save()
}

/* ---------------- Editor ---------------- */
function addSegment() {
  const title = newTitle.value.trim()
  const mins = Number(newMinutes.value || 0)
  if (!title) return toast.add({ title: 'Title required', description: 'Give the segment a name.' })
  if (!Number.isFinite(mins) || mins <= 0) return toast.add({ title: 'Invalid time', description: 'Minutes must be > 0.' })

  segments.value.push({
    id: uid(),
    title,
    seconds: Math.round(mins * 60),
    done: false
  })

  if (segments.value.length === 1) {
    activeIndex.value = 0
    remaining.value = segments.value[0].seconds
  }

  newTitle.value = ''
  newMinutes.value = 5
  recalcTotals()
  save()
}

function deleteSegment(id: string) {
  const idx = segments.value.findIndex((s) => s.id === id)
  if (idx === -1) return
  segments.value.splice(idx, 1)
  if (activeIndex.value >= segments.value.length) activeIndex.value = Math.max(0, segments.value.length - 1)
  remaining.value = segments.value[activeIndex.value]?.seconds || 0
  recalcTotals()
  save()
}

/* ---------------- Presets ---------------- */
function applyPreset(kind: 'Standup' | 'Sync 30' | 'Retro 45' | 'Deep 60') {
  const make = (title: string, min: number): Segment => ({
    id: uid(),
    title,
    seconds: min * 60,
    done: false
  })

  if (kind === 'Standup') {
    segments.value = [make('Updates', 8), make('Blockers', 4), make('Next steps', 3)]
  } else if (kind === 'Sync 30') {
    segments.value = [make('Context', 5), make('Discussion', 18), make('Decisions', 5), make('Action items', 2)]
  } else if (kind === 'Retro 45') {
    segments.value = [make('What went well', 12), make('What to improve', 12), make('Ideas', 12), make('Actions', 9)]
  } else {
    segments.value = [make('Context', 10), make('Discussion', 35), make('Decisions', 10), make('Actions', 5)]
  }

  activeIndex.value = 0
  remaining.value = segments.value[0].seconds
  running.value = false
  paused.value = false
  if (tick) clearInterval(tick)
  tick = null
  recalcTotals()
  save()

  toast.add({ title: 'Preset applied', description: kind })
}

/* ---------------- Computed ---------------- */
const active = computed(() => segments.value[activeIndex.value] || null)

const activeProgress = computed(() => {
  const a = active.value
  if (!a) return 0
  const done = a.seconds - remaining.value
  return a.seconds ? clamp(done / a.seconds, 0, 1) : 0
})

const overallSeconds = computed(() => {
  const total = segments.value.reduce((acc, s) => acc + s.seconds, 0)
  return total
})

const overallDoneSeconds = computed(() => {
  let done = 0
  for (let i = 0; i < segments.value.length; i++) {
    const s = segments.value[i]
    if (s.done) done += s.seconds
    else if (i === activeIndex.value) done += Math.max(0, s.seconds - remaining.value)
  }
  return done
})

const overallProgress = computed(() => {
  const total = overallSeconds.value
  if (!total) return 0
  return clamp(overallDoneSeconds.value / total, 0, 1)
})

/* ---------------- Init ---------------- */
onMounted(() => {
  const ok = load()
  if (!ok || segments.value.length === 0) seedDefaultAgenda()
  recalcTotals()
})

watch([segments, activeIndex, remaining, enableBeep, enableVibrate, autoNext], () => {
  recalcTotals()
  save()
}, { deep: true })

onBeforeUnmount(() => {
  if (tick) clearInterval(tick)
})
</script>

<template>
  <div class="mx-auto w-full max-w-4xl">
    <div class="rounded-3xl border border-black/10 bg-white/60 p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-black/20">
      <!-- Header -->
      <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 class="text-2xl font-semibold">Meeting Timer</h2>
          <p class="mt-1 text-sm text-black/60 dark:text-white/60">
            Agenda-based meeting timer with presets, progress, and alerts.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <UButton variant="soft" @click="showEditor = !showEditor" icon="i-heroicons-adjustments-horizontal">
            {{ showEditor ? 'Hide' : 'Edit agenda' }}
          </UButton>

          <UButton variant="soft" icon="i-heroicons-arrow-path" @click="resetAgenda">
            Reset agenda
          </UButton>
        </div>
      </div>

      <!-- Presets -->
      <div class="mt-4 flex flex-wrap gap-2">
        <UButton variant="soft" @click="applyPreset('Standup')">Standup (15)</UButton>
        <UButton variant="soft" @click="applyPreset('Sync 30')">Sync (30)</UButton>
        <UButton variant="soft" @click="applyPreset('Retro 45')">Retro (45)</UButton>
        <UButton variant="soft" @click="applyPreset('Deep 60')">Deep (60)</UButton>
      </div>

      <!-- Main -->
      <div class="mt-6 grid gap-4 lg:grid-cols-12">
        <!-- Left: big timer -->
        <div class="lg:col-span-5">
          <div class="rounded-3xl border border-black/10 bg-white/70 p-5 dark:border-white/10 dark:bg-black/25">
            <div class="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">Current segment</div>

            <div class="mt-2 text-lg font-semibold">
              {{ active?.title || '—' }}
            </div>

            <div class="mt-4 text-5xl font-semibold tabular-nums tracking-tight">
              {{ fmt(remaining) }}
            </div>

            <!-- Segment progress -->
            <div class="mt-4">
              <div class="flex items-center justify-between text-xs text-black/55 dark:text-white/55">
                <span>Segment</span>
                <span>{{ Math.round(activeProgress * 100) }}%</span>
              </div>
              <div class="mt-2 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                <div class="h-full rounded-full bg-black/60 dark:bg-white/70" :style="{ width: `${activeProgress * 100}%` }" />
              </div>
            </div>

            <!-- Overall progress -->
            <div class="mt-4">
              <div class="flex items-center justify-between text-xs text-black/55 dark:text-white/55">
                <span>Overall</span>
                <span>{{ Math.round(overallProgress * 100) }}%</span>
              </div>
              <div class="mt-2 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                <div class="h-full rounded-full bg-black/40 dark:bg-white/50" :style="{ width: `${overallProgress * 100}%` }" />
              </div>
              <div class="mt-2 text-xs text-black/55 dark:text-white/55">
                Remaining total: <span class="font-medium">{{ fmt(totalRemaining) }}</span>
              </div>
            </div>

            <!-- Controls -->
            <div class="mt-5 grid grid-cols-2 gap-2">
              <UButton
                v-if="!running && !paused"
                icon="i-heroicons-play"
                @click="start"
              >
                Start
              </UButton>

              <UButton
                v-if="paused"
                icon="i-heroicons-play"
                @click="resume"
              >
                Resume
              </UButton>

              <UButton
                v-if="running"
                variant="soft"
                icon="i-heroicons-pause"
                @click="pause"
              >
                Pause
              </UButton>

              <UButton variant="soft" icon="i-heroicons-stop" @click="stop">
                Stop
              </UButton>

              <UButton variant="soft" icon="i-heroicons-chevron-left" @click="prevSegment">
                Prev
              </UButton>

              <UButton variant="soft" icon="i-heroicons-chevron-right" @click="nextSegment">
                Next
              </UButton>
            </div>

            <div class="mt-4 grid gap-2">
              <UCheckbox v-model="autoNext" label="Auto move to next segment" />
              <UCheckbox v-model="enableBeep" label="Beep on segment end" />
              <UCheckbox v-model="enableVibrate" label="Vibrate on segment end (mobile)" />
            </div>
          </div>
        </div>

        <!-- Right: agenda list + editor -->
        <div class="lg:col-span-7">
          <div class="rounded-3xl border border-black/10 bg-white/50 p-4 dark:border-white/10 dark:bg-black/15">
            <div class="flex items-center justify-between">
              <div class="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">
                Agenda
              </div>
              <div class="text-xs text-black/55 dark:text-white/55">
                Click a segment to jump
              </div>
            </div>

            <div class="mt-3 grid gap-2">
              <button
                v-for="(s, idx) in segments"
                :key="s.id"
                class="w-full rounded-2xl border border-black/10 bg-white/60 p-3 text-left transition
                       hover:bg-white/80 dark:border-white/10 dark:bg-black/20 dark:hover:bg-black/25"
                :class="[
                  idx === activeIndex && !s.done ? 'ring-2 ring-black/20 dark:ring-white/20' : '',
                  s.done ? 'opacity-60' : ''
                ]"
                @click="selectSegment(idx)"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <div class="flex items-center gap-2">
                      <UBadge v-if="s.done" variant="soft" size="xs">Done</UBadge>
                      <UBadge v-else-if="idx === activeIndex" variant="soft" size="xs">Active</UBadge>
                      <div class="truncate font-medium">{{ s.title }}</div>
                    </div>
                    <div class="mt-1 text-xs text-black/55 dark:text-white/55">
                      {{ fmt(s.seconds) }}
                      <span v-if="idx === activeIndex && !s.done"> • remaining: {{ fmt(remaining) }}</span>
                    </div>
                  </div>

                  <div class="flex shrink-0 items-center gap-1.5">
                    <UButton
                      variant="ghost"
                      icon="i-heroicons-check"
                      :disabled="s.done"
                      @click.stop="markDone(idx)"
                    />
                    <UButton
                      v-if="showEditor"
                      variant="ghost"
                      color="red"
                      icon="i-heroicons-trash"
                      @click.stop="deleteSegment(s.id)"
                    />
                  </div>
                </div>
              </button>

              <div v-if="segments.length === 0" class="text-sm text-black/60 dark:text-white/60">
                No segments yet.
              </div>
            </div>

            <!-- Editor -->
            <div v-if="showEditor" class="mt-5 rounded-2xl border border-black/10 bg-white/60 p-4 dark:border-white/10 dark:bg-black/20">
              <div class="text-sm font-medium">Add segment</div>

              <div class="mt-3 grid gap-2 md:grid-cols-12">
                <div class="md:col-span-7">
                  <UInput v-model="newTitle" placeholder="Segment title (e.g., Decisions)" />
                </div>
                <div class="md:col-span-3">
                  <UInput v-model="newMinutes" type="number" min="1" placeholder="Minutes" />
                </div>
                <div class="md:col-span-2">
                  <UButton block @click="addSegment">Add</UButton>
                </div>
              </div>

              <div class="mt-2 text-xs text-black/55 dark:text-white/55">
                Tip: Use “Action items” as last segment so meeting always ends with owners.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="mt-4 text-xs text-black/50 dark:text-white/50">
        Offline-first. Saves agenda + progress + settings in local storage.
      </div>
    </div>
  </div>
</template>
