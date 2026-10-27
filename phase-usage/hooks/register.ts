const PANE = 'phase-usage'

// ---- CONFIG ---------------------------------------------------------------
// Session budget in non-cache tokens (input + output + cache-write). 0 = off.
// A toast fires at 80% and at 100%.
const BUDGET_TOKENS = 0

// USD per 1M tokens, matched by substring of the model name (case-insensitive).
// Fill from your provider's price list. Models with no entry show "cost n/a".
type Price = { in: number; out: number; cr: number; cc: number }
const PRICES: Record<string, Price> = {
  // 'sonnet': { in: 0, out: 0, cr: 0, cc: 0 },
}
// ---------------------------------------------------------------------------

type Counters = { in: number; out: number; cr: number; cc: number; n: number }
type TurnStat = { value: number; phase: string }

// usage[phase][model] = counters
let usage: Record<string, Record<string, Counters>> = {}
let lastTurn: TurnStat | null = null
let peakTurn: TurnStat | null = null
let warned80 = false
let warned100 = false

// ---- THE ONE THING TO ADAPT: where the active phase comes from ----------
// Tries env var CLAUDE_PHASE, then the file ~/.claude/phase. Edit to match
// however your phase-switch records the phase.
async function currentPhase($: any): Promise<string> {
  try {
    const fromEnv = await $.env.get('CLAUDE_PHASE')
    if (fromEnv) return String(fromEnv).trim()
  } catch { }
  try {
    const home = await $.env.get('HOME')
    const r = await $.fs.read(home + '/.claude/phase')
    const text = typeof r === 'string' ? r : (r && r.text) || ''
    if (text.trim()) return text.trim()
  } catch { }
  return 'unknown'
}
// --------------------------------------------------------------------------

function record(phase: string, model: string, u: any): void {
  const byModel = (usage[phase] ??= {})
  const m = (byModel[model] ??= { in: 0, out: 0, cr: 0, cc: 0, n: 0 })
  m.in += u.input_tokens ?? 0
  m.out += u.output_tokens ?? 0
  m.cr += u.cache_read_input_tokens ?? 0
  m.cc += u.cache_creation_input_tokens ?? 0
  m.n += 1
}

function phaseTotals(phase: string): Counters {
  const t: Counters = { in: 0, out: 0, cr: 0, cc: 0, n: 0 }
  for (const m of Object.values(usage[phase] ?? {})) {
    t.in += m.in
    t.out += m.out
    t.cr += m.cr
    t.cc += m.cc
    t.n += m.n
  }
  return t
}

// Non-cache-read tokens: the number that reflects real work and budget
const spent = (t: Counters): number => t.in + t.out + t.cc

const fmt = (n: number): string =>
  n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : String(Math.round(n))

const phases = (): string[] => Object.keys(usage).sort()

const sessionSpent = (): number => phases().reduce((s, p) => s + spent(phaseTotals(p)), 0)

// Share of input served from cache: higher is cheaper
function hitRate(t: Counters): number | null {
  const denom = t.in + t.cr + t.cc
  return denom > 0 ? Math.round((t.cr / denom) * 100) : null
}

function priceFor(model: string): Price | null {
  const name = model.toLowerCase()
  for (const [key, price] of Object.entries(PRICES)) {
    if (name.includes(key.toLowerCase())) return price
  }
  return null
}

// Returns USD, and whether any model had no price entry
function phaseCost(phase: string): { usd: number; missing: boolean } {
  let usd = 0
  let missing = false
  for (const [model, m] of Object.entries(usage[phase] ?? {})) {
    const p = priceFor(model)
    if (!p) { missing = true; continue }
    usd += (m.in * p.in + m.out * p.out + m.cr * p.cr + m.cc * p.cc) / 1e6
  }
  return { usd, missing }
}

const money = (usd: number): string => '$' + usd.toFixed(2)

function summary(): string {
  return phases()
    .map((p): [string, number] => [p, spent(phaseTotals(p))])
    .filter(([, v]) => v > 0)
    .map(([p, v]) => p + ' ' + fmt(v))
    .join(' · ')
}

function checkBudget($: any): void {
  if (BUDGET_TOKENS <= 0) return
  const used = sessionSpent()
  if (!warned100 && used >= BUDGET_TOKENS) {
    warned100 = true
    $.ui.toast('Token budget reached: ' + fmt(used) + ' / ' + fmt(BUDGET_TOKENS))
  } else if (!warned80 && used >= BUDGET_TOKENS * 0.8) {
    warned80 = true
    $.ui.toast('80% of token budget used: ' + fmt(used) + ' / ' + fmt(BUDGET_TOKENS))
  }
}

function resetAll(): void {
  usage = {}
  lastTurn = null
  peakTurn = null
  warned80 = false
  warned100 = false
}

// Session-level numbers from Claude Code: context window, plan limits, elapsed
async function sessionLines($: any, Text: any): Promise<any[]> {
  const out: any[] = []
  let s: any = null
  try { s = await $.session.usage() } catch { }

  const ctx = s && s.context
  if (ctx && ctx.window > 0) {
    const hasTokens = Number.isFinite(ctx.tokens)
    const pct = hasTokens
      ? Math.round((ctx.tokens / ctx.window) * 100)
      : Number.isFinite(ctx.percent) ? Math.round(ctx.percent) : null
    if (pct !== null) {
      out.push(Text({
        children: ['context  ' + pct + '%  (' + (hasTokens ? fmt(ctx.tokens) : '?') + ' / ' + fmt(ctx.window) + ')'],
      }))
    }
  }

  for (const rl of (s && s.rateLimits) || []) {
    const reset = rl.resetsAt ? new Date(rl.resetsAt) : null
    const at = reset && !isNaN(reset.getTime())
      ? '  resets ' + reset.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : ''
    out.push(Text({ children: ['limit    ' + rl.kind + ' ' + Math.round(rl.percentUsed) + '%' + at] }))
  }

  if (lastTurn || peakTurn) {
    const l = lastTurn ? 'last ' + fmt(lastTurn.value) + ' (' + lastTurn.phase + ')' : ''
    const p = peakTurn ? 'peak ' + fmt(peakTurn.value) + ' (' + peakTurn.phase + ')' : ''
    out.push(Text({ children: ['turn     ' + [l, p].filter(Boolean).join(' · ')] }))
  }

  const total = sessionSpent()
  if (BUDGET_TOKENS > 0) {
    out.push(Text({
      children: ['budget   ' + fmt(total) + ' / ' + fmt(BUDGET_TOKENS) + '  ' + Math.round((total / BUDGET_TOKENS) * 100) + '%'],
    }))
  }

  const started = s && s.startedAt ? new Date(s.startedAt).getTime() : NaN
  if (!isNaN(started) && total > 0) {
    const mins = Math.max((Date.now() - started) / 60000, 1)
    out.push(Text({ children: ['pace     ' + fmt(total / mins) + ' tok/min over ' + Math.round(mins) + ' min'] }))
  }

  if (s && typeof s.cost === 'number') {
    out.push(Text({ children: ['cost     ' + money(s.cost) + ' (Claude Code estimate, Anthropic pricing)'] }))
  }
  return out
}

export function register(on: any): void {
  on('session.start', async ($: any, e: any, next: any) => {
    await $.command.register({
      name: 'phase-usage',
      description: 'Show token usage, cache efficiency and cost by phase',
      immediate: true,
    })
    return next(e)
  })

  on('command.run', { command: 'phase-usage' }, async ($: any) => {
    await $.ui.open({ id: PANE, title: 'Phase usage', focus: true, closeOnEscape: true })
    return {}
  })

  // Record usage of every request, tagged with the phase active when it was sent
  on('turn.step', async function* ($: any, e: any, next: any) {
    const phase = await currentPhase($)
    const result = yield* next(e)
    const u = result && result.usage
    if (u) {
      record(phase, u.model ?? result.model ?? e.model ?? 'unknown', u)
      checkBudget($)
      $.ui.invalidate('ui.render')
    }
    return result
  })

  // Track the last and the most expensive main-conversation turn
  on('turn.complete', async ($: any, e: any, next: any) => {
    const u = e.usage
    if (u && !e.agentId) {
      const value = (u.input_tokens ?? 0) + (u.output_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0)
      const stat = { value, phase: await currentPhase($) }
      lastTurn = stat
      if (!peakTurn || value > peakTurn.value) peakTurn = stat
      $.ui.invalidate('ui.render')
    }
    return next(e)
  })

  // Live readout beside the spinner
  on('ui.render', { component: 'Spinner' }, async ($: any, e: any, next: any) => {
    const s = summary()
    if (!s) return next(e)
    return next({ ...e, props: { ...e.props, suffix: ' · ' + s + '…' } })
  })

  on('ui.render', { component: 'Pane' }, async ($: any, e: any, next: any) => {
    if (e.requestId !== PANE) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)

    const names = phases()
    const total = sessionSpent()

    // Share of spend per phase
    const bars =
      total === 0
        ? [Text({ children: ['No usage recorded yet this session.'] })]
        : names.map((p) => {
          const v = spent(phaseTotals(p))
          const pct = Math.round((v / total) * 100)
          const filled = Math.round(pct / 5)
          return Text({
            children: [
              p.padEnd(8) + '█'.repeat(filled) + '░'.repeat(20 - filled) +
              ' ' + String(pct).padStart(3) + '%  ' + fmt(v),
            ],
          })
        })

    // Per-phase detail: requests, token types, cache efficiency, cost
    const detail: any[] = []
    for (const p of names) {
      const t = phaseTotals(p)
      const hit = hitRate(t)
      const cost = phaseCost(p)
      const costText = Object.keys(PRICES).length === 0
        ? 'cost n/a (set PRICES)'
        : (cost.missing ? '≥ ' : '') + money(cost.usd) + (cost.missing ? ' (a model has no price)' : '')
      detail.push(Text({
        children: [
          p + ': ' + t.n + ' req · avg out ' + fmt(t.n ? t.out / t.n : 0) +
          ' · in ' + fmt(t.in) + ' · out ' + fmt(t.out) + ' · cache-write ' + fmt(t.cc),
        ],
      }))
      detail.push(Text({
        children: [
          '  cache-read ' + fmt(t.cr) + ' · hit ' + (hit === null ? 'n/a' : hit + '%') + ' · ' + costText,
        ],
        dimColor: true,
      }))
    }

    const session = await sessionLines($, Text)

    return Box({
      flexDirection: 'column',
      children: [
        Text({ children: ['Spend = input + output + cache-write (cache reads excluded)'], dimColor: true }),
        ...bars,
        Text({ children: [' '] }),
        ...detail,
        Text({ children: [' '] }),
        ...session,
        Text({ children: [' '] }),
        Button({
          key: 'reset',
          label: 'Reset',
          hotkey: 'r',
          onPress: () => {
            resetAll()
            $.ui.invalidate('ui.render')
          },
        }),
      ],
    })
  })
}