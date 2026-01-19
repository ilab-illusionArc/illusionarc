<script setup lang="ts">
type Mode = 'General' | 'Scientific'

const mode = ref<Mode>('General')
const expression = ref('')
const display = ref('0')
const lastWasEquals = ref(false)
const error = ref<string | null>(null)

/* ---------------- Helpers ---------------- */
function setError(msg: string) {
  error.value = msg
  setTimeout(() => {
    if (error.value === msg) error.value = null
  }, 1600)
}

function resetAll() {
  expression.value = ''
  display.value = '0'
  lastWasEquals.value = false
  error.value = null
}

function backspace() {
  if (lastWasEquals.value) return
  if (!expression.value) return
  expression.value = expression.value.slice(0, -1)
  display.value = expression.value || '0'
}

function append(raw: string) {
  if (lastWasEquals.value) {
    // start fresh if typing a number/const after equals
    if (/[0-9.]/.test(raw) || raw === '(' || raw === 'pi' || raw === 'e') {
      expression.value = ''
      display.value = '0'
    }
    lastWasEquals.value = false
  }

  // prevent multiple '.' in current number segment
  if (raw === '.') {
    const m = expression.value.match(/(\d+(\.\d*)?|\.\d+)$/)
    if (m && m[0].includes('.')) return
    if (!m) expression.value += '0'
  }

  // avoid starting with operator (except "-")
  if (/^[+*/^)]$/.test(raw) && !expression.value) return
  if (raw === '-' && !expression.value) {
    expression.value = '-'
    display.value = expression.value
    return
  }

  // replace consecutive operators
  if (/^[+\-*/^]$/.test(raw) && /[+\-*/^]$/.test(expression.value)) {
    expression.value = expression.value.slice(0, -1) + raw
    display.value = expression.value
    return
  }

  expression.value += raw
  display.value = expression.value || '0'
}

function appendConst(which: 'pi' | 'e') {
  const token = which === 'pi' ? 'pi' : 'e'
  if (lastWasEquals.value) {
    expression.value = ''
    lastWasEquals.value = false
  }
  // implicit multiply
  if (/[0-9)]$/.test(expression.value)) expression.value += '*'
  append(token)
}

function appendFunc(name: string) {
  if (lastWasEquals.value) {
    expression.value = display.value
    lastWasEquals.value = false
  }
  if (/[0-9)]$/.test(expression.value)) expression.value += '*'
  expression.value += `${name}(`
  display.value = expression.value
}

function toggleSign() {
  if (!expression.value) {
    expression.value = '-'
    display.value = expression.value
    return
  }
  if (lastWasEquals.value) {
    expression.value = display.value
    lastWasEquals.value = false
  }

  // Toggle sign of last number/const
  const re = /(pi|e|\d+(?:\.\d*)?|\.\d+)(?!.*(pi|e|\d+(?:\.\d*)?|\.\d+))/i
  const m = expression.value.match(re)
  if (!m) return

  const token = m[1]
  const idx = expression.value.lastIndexOf(token)
  const before = expression.value.slice(0, idx)
  const after = expression.value.slice(idx + token.length)

  const wrapStart = before.endsWith('(-')
  const wrapEnd = after.startsWith(')')
  if (wrapStart && wrapEnd) {
    expression.value = before.slice(0, -2) + token + after.slice(1)
  } else {
    expression.value = before + '(-' + token + ')' + after
  }
  display.value = expression.value
}

function percent() {
  if (!expression.value) return
  if (lastWasEquals.value) {
    expression.value = display.value
    lastWasEquals.value = false
  }
  const re = /(pi|e|\d+(?:\.\d*)?|\.\d+)(?!.*(pi|e|\d+(?:\.\d*)?|\.\d+))/i
  const m = expression.value.match(re)
  if (!m) return
  const token = m[1]
  const idx = expression.value.lastIndexOf(token)
  expression.value =
    expression.value.slice(0, idx) + `(${token}/100)` + expression.value.slice(idx + token.length)
  display.value = expression.value
}

/* ---------------- Parser (no eval) ---------------- */
type Tok =
  | { t: 'num'; v: number }
  | { t: 'op'; v: '+' | '-' | '*' | '/' | '^' }
  | { t: 'lpar' }
  | { t: 'rpar' }
  | { t: 'func'; v: string }

function factorial(n: number) {
  if (!Number.isFinite(n)) throw new Error('Invalid number')
  if (n < 0) throw new Error('Factorial needs n ≥ 0')
  if (Math.floor(n) !== n) throw new Error('Factorial needs integer')
  if (n > 170) throw new Error('Too large')
  let r = 1
  for (let i = 2; i <= n; i++) r *= i
  return r
}

function tokenize(input: string): Tok[] {
  const s = input.replace(/\s+/g, '')
  const out: Tok[] = []
  let i = 0

  while (i < s.length) {
    const ch = s[i]

    if (ch === '(') {
      out.push({ t: 'lpar' })
      i++
      continue
    }
    if (ch === ')') {
      out.push({ t: 'rpar' })
      i++
      continue
    }

    // postfix factorial
    if (ch === '!') {
      out.push({ t: 'func', v: 'fact' })
      i++
      continue
    }

    // operators (unary - -> inject 0 - ...)
    if (/[+\-*/^]/.test(ch)) {
      if (ch === '-') {
        const prev = out[out.length - 1]
        if (!prev || prev.t === 'op' || prev.t === 'lpar') out.push({ t: 'num', v: 0 })
      }
      out.push({ t: 'op', v: ch as any })
      i++
      continue
    }

    // constants
    if (s.slice(i, i + 2).toLowerCase() === 'pi') {
      out.push({ t: 'num', v: Math.PI })
      i += 2
      continue
    }
    if (s[i].toLowerCase() === 'e') {
      out.push({ t: 'num', v: Math.E })
      i += 1
      continue
    }

    // functions
    const funcMatch = s
      .slice(i)
      .match(/^(asin|acos|atan|sin|cos|tan|sqrt|ln|log|abs|exp)\b/i)
    if (funcMatch) {
      out.push({ t: 'func', v: funcMatch[1].toLowerCase() })
      i += funcMatch[1].length
      continue
    }

    // number
    const numMatch = s.slice(i).match(/^\d+(\.\d*)?|\.\d+/)
    if (numMatch) {
      out.push({ t: 'num', v: Number(numMatch[0]) })
      i += numMatch[0].length
      continue
    }

    throw new Error(`Unexpected: ${ch}`)
  }

  return out
}

function precedence(op: Tok & { t: 'op' }) {
  switch (op.v) {
    case '^':
      return 4
    case '*':
    case '/':
      return 3
    case '+':
    case '-':
      return 2
  }
}
function rightAssoc(op: Tok & { t: 'op' }) {
  return op.v === '^'
}

function toRpn(tokens: Tok[]) {
  const out: Tok[] = []
  const stack: Tok[] = []

  for (const tok of tokens) {
    if (tok.t === 'num') out.push(tok)
    else if (tok.t === 'func') stack.push(tok)
    else if (tok.t === 'op') {
      while (stack.length) {
        const top = stack[stack.length - 1]
        if (top.t === 'op') {
          const p1 = precedence(tok)
          const p2 = precedence(top)
          if (p2 > p1 || (p2 === p1 && !rightAssoc(tok))) out.push(stack.pop()!)
          else break
        } else if (top.t === 'func') out.push(stack.pop()!)
        else break
      }
      stack.push(tok)
    } else if (tok.t === 'lpar') stack.push(tok)
    else if (tok.t === 'rpar') {
      while (stack.length && stack[stack.length - 1].t !== 'lpar') out.push(stack.pop()!)
      if (!stack.length) throw new Error('Mismatched parentheses')
      stack.pop()
      if (stack.length && stack[stack.length - 1].t === 'func') out.push(stack.pop()!)
    }
  }

  while (stack.length) {
    const t = stack.pop()!
    if (t.t === 'lpar' || t.t === 'rpar') throw new Error('Mismatched parentheses')
    out.push(t)
  }
  return out
}

function applyFunc(name: string, x: number) {
  switch (name) {
    case 'sin':
      return Math.sin(x)
    case 'cos':
      return Math.cos(x)
    case 'tan':
      return Math.tan(x)
    case 'asin':
      return Math.asin(x)
    case 'acos':
      return Math.acos(x)
    case 'atan':
      return Math.atan(x)
    case 'sqrt':
      if (x < 0) throw new Error('sqrt needs x ≥ 0')
      return Math.sqrt(x)
    case 'ln':
      if (x <= 0) throw new Error('ln needs x > 0')
      return Math.log(x)
    case 'log':
      if (x <= 0) throw new Error('log needs x > 0')
      return Math.log10(x)
    case 'abs':
      return Math.abs(x)
    case 'exp':
      return Math.exp(x)
    case 'fact':
      return factorial(x)
    default:
      throw new Error(`Unknown function: ${name}`)
  }
}

function evalRpn(rpn: Tok[]) {
  const st: number[] = []
  for (const tok of rpn) {
    if (tok.t === 'num') st.push(tok.v)
    else if (tok.t === 'op') {
      const b = st.pop()
      const a = st.pop()
      if (a === undefined || b === undefined) throw new Error('Invalid expression')
      switch (tok.v) {
        case '+':
          st.push(a + b)
          break
        case '-':
          st.push(a - b)
          break
        case '*':
          st.push(a * b)
          break
        case '/':
          if (b === 0) throw new Error('Division by zero')
          st.push(a / b)
          break
        case '^':
          st.push(Math.pow(a, b))
          break
      }
    } else if (tok.t === 'func') {
      const x = st.pop()
      if (x === undefined) throw new Error('Invalid function input')
      st.push(applyFunc(tok.v, x))
    }
  }
  if (st.length !== 1) throw new Error('Invalid expression')
  return st[0]
}

function prettyNumber(x: number) {
  if (!Number.isFinite(x)) return 'Error'
  const s = x.toPrecision(14)
  return String(Number(s))
}

function equals() {
  try {
    if (!expression.value.trim()) return
    error.value = null
    const toks = tokenize(expression.value)
    const rpn = toRpn(toks)
    const result = evalRpn(rpn)
    display.value = prettyNumber(result)
    expression.value = display.value
    lastWasEquals.value = true
  } catch (e: any) {
    setError(e?.message || 'Invalid expression')
  }
}

/* ---------------- Keyboard ---------------- */
function onKey(e: KeyboardEvent) {
  const k = e.key
  if (k === 'Enter' || k === '=') {
    e.preventDefault()
    equals()
    return
  }
  if (k === 'Backspace') {
    e.preventDefault()
    backspace()
    return
  }
  if (k === 'Escape') {
    e.preventDefault()
    resetAll()
    return
  }

  if (/[0-9]/.test(k)) return append(k)
  if (k === '.') return append('.')
  if (k === '+') return append('+')
  if (k === '-') return append('-')
  if (k === '*') return append('*')
  if (k === '/') return append('/')
  if (k === '^') return append('^')
  if (k === '(') return append('(')
  if (k === ')') return append(')')
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

/* ---------------- UI Data ---------------- */
type Key = {
  label: string
  onClick: () => void
  kind?: 'num' | 'op' | 'util' | 'eq'
  wide?: boolean
}

const mainKeys = computed<Key[]>(() => [
  { label: 'AC', onClick: resetAll, kind: 'util' },
  { label: '⌫', onClick: backspace, kind: 'util' },
  { label: '±', onClick: toggleSign, kind: 'util' },
  { label: '÷', onClick: () => append('/'), kind: 'op' },

  { label: '7', onClick: () => append('7'), kind: 'num' },
  { label: '8', onClick: () => append('8'), kind: 'num' },
  { label: '9', onClick: () => append('9'), kind: 'num' },
  { label: '×', onClick: () => append('*'), kind: 'op' },

  { label: '4', onClick: () => append('4'), kind: 'num' },
  { label: '5', onClick: () => append('5'), kind: 'num' },
  { label: '6', onClick: () => append('6'), kind: 'num' },
  { label: '−', onClick: () => append('-'), kind: 'op' },

  { label: '1', onClick: () => append('1'), kind: 'num' },
  { label: '2', onClick: () => append('2'), kind: 'num' },
  { label: '3', onClick: () => append('3'), kind: 'num' },
  { label: '+', onClick: () => append('+'), kind: 'op' },

  { label: '0', onClick: () => append('0'), kind: 'num', wide: true },
  { label: '.', onClick: () => append('.'), kind: 'num' },
  { label: '=', onClick: equals, kind: 'eq' }
])

const sciKeys = computed<Key[]>(() => [
  { label: 'π', onClick: () => appendConst('pi'), kind: 'util' },
  { label: 'e', onClick: () => appendConst('e'), kind: 'util' },
  { label: '(', onClick: () => append('('), kind: 'util' },
  { label: ')', onClick: () => append(')'), kind: 'util' },

  { label: 'sin', onClick: () => appendFunc('sin'), kind: 'util' },
  { label: 'cos', onClick: () => appendFunc('cos'), kind: 'util' },
  { label: 'tan', onClick: () => appendFunc('tan'), kind: 'util' },
  { label: 'xʸ', onClick: () => append('^'), kind: 'op' },

  { label: 'asin', onClick: () => appendFunc('asin'), kind: 'util' },
  { label: 'acos', onClick: () => appendFunc('acos'), kind: 'util' },
  { label: 'atan', onClick: () => appendFunc('atan'), kind: 'util' },
  { label: 'n!', onClick: () => append('!'), kind: 'util' },

  { label: '√', onClick: () => appendFunc('sqrt'), kind: 'util' },
  { label: 'x²', onClick: () => append('^2'), kind: 'util' },
  { label: 'ln', onClick: () => appendFunc('ln'), kind: 'util' },
  { label: 'log', onClick: () => appendFunc('log'), kind: 'util' },

  { label: 'abs', onClick: () => appendFunc('abs'), kind: 'util' },
  { label: 'eˣ', onClick: () => appendFunc('exp'), kind: 'util' },
  { label: '%', onClick: percent, kind: 'util' },
  { label: '^', onClick: () => append('^'), kind: 'op' }
])

function btnVariant(k: Key) {
  if (k.kind === 'eq') return 'solid'
  if (k.kind === 'op') return 'soft'
  if (k.kind === 'util') return 'soft'
  return 'solid'
}
function btnColor(k: Key) {
  if (k.kind === 'eq') return 'primary'
  if (k.kind === 'op') return 'gray'
  if (k.kind === 'util') return 'gray'
  return 'gray'
}
</script>

<template>
  <div class="mx-auto w-full max-w-3xl">
    <div
      class="rounded-3xl border border-black/10 bg-white/60 p-5 shadow-sm backdrop-blur
             dark:border-white/10 dark:bg-black/20"
    >
      <!-- Header -->
      <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 class="text-2xl font-semibold">Calculator</h2>
          <p class="mt-1 text-sm text-black/60 dark:text-white/60">
            General + Scientific modes (no broken selector).
          </p>
        </div>

        <!-- ✅ Reliable segmented toggle -->
        <div
          class="inline-flex overflow-hidden rounded-2xl border border-black/10 bg-white/70 p-1
                 dark:border-white/10 dark:bg-black/25"
        >
          <button
            class="rounded-xl px-4 py-2 text-sm font-medium transition"
            :class="
              mode === 'General'
                ? 'bg-black text-white dark:bg-white dark:text-black'
                : 'text-black/70 hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/5'
            "
            @click="mode = 'General'"
          >
            General
          </button>
          <button
            class="rounded-xl px-4 py-2 text-sm font-medium transition"
            :class="
              mode === 'Scientific'
                ? 'bg-black text-white dark:bg-white dark:text-black'
                : 'text-black/70 hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/5'
            "
            @click="mode = 'Scientific'"
          >
            Scientific
          </button>
        </div>
      </div>

      <!-- Display -->
      <div
        class="mt-5 rounded-3xl border border-black/10 bg-white/70 p-5
               dark:border-white/10 dark:bg-black/25"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-h-[22px] break-words text-sm text-black/60 dark:text-white/60">
            {{ expression || ' ' }}
          </div>
          <UButton variant="soft" size="sm" icon="i-heroicons-arrow-path" @click="resetAll">
            Reset
          </UButton>
        </div>

        <div class="mt-3 flex items-end justify-between gap-3">
          <div class="text-xs">
            <span v-if="error" class="text-red-600 dark:text-red-400">{{ error }}</span>
            <span v-else class="text-black/50 dark:text-white/50">Keyboard: Enter, Backspace, Esc</span>
          </div>

          <div class="text-right text-4xl font-semibold tabular-nums tracking-tight">
            {{ display }}
          </div>
        </div>
      </div>

      <!-- Keypads -->
      <div class="mt-6 grid gap-4 md:grid-cols-12">
        <!-- Scientific -->
        <div v-if="mode === 'Scientific'" class="md:col-span-5">
          <div
            class="rounded-3xl border border-black/10 bg-white/50 p-4
                   dark:border-white/10 dark:bg-black/15"
          >
            <div class="mb-3 text-xs uppercase tracking-wide text-black/50 dark:text-white/50">
              Scientific
            </div>

            <div class="grid grid-cols-4 gap-2">
              <UButton
                v-for="k in sciKeys"
                :key="k.label"
                :variant="btnVariant(k)"
                :color="btnColor(k)"
                class="h-11 rounded-2xl"
                @click="k.onClick"
              >
                {{ k.label }}
              </UButton>
            </div>

            <div class="mt-3 text-xs text-black/55 dark:text-white/55">
              Trig uses radians. Example: <span class="font-medium">sin(</span>0.5<span class="font-medium">)</span>
            </div>
          </div>
        </div>

        <!-- Main -->
        <div :class="mode === 'Scientific' ? 'md:col-span-7' : 'md:col-span-12'">
          <div
            class="rounded-3xl border border-black/10 bg-white/50 p-4
                   dark:border-white/10 dark:bg-black/15"
          >
            <div class="mb-3 text-xs uppercase tracking-wide text-black/50 dark:text-white/50">
              Keypad
            </div>

            <div class="grid grid-cols-4 gap-2">
              <UButton
                v-for="k in mainKeys"
                :key="k.label"
                :variant="btnVariant(k)"
                :color="k.kind === 'eq' ? 'primary' : 'gray'"
                class="h-12 rounded-2xl text-base"
                :class="k.wide ? 'col-span-2' : ''"
                @click="k.onClick"
              >
                {{ k.label }}
              </UButton>
            </div>
          </div>
        </div>
      </div>

      <!-- tiny footer -->
      <div class="mt-4 text-xs text-black/50 dark:text-white/50">
        Supports: + − × ÷, parentheses, powers (^), factorial (!), ln/log, √, sin/cos/tan, π, e.
      </div>
    </div>
  </div>
</template>
