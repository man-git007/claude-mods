import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Phase } from '../types'

const phaseAtom = atom({ plugin: 'phase-switch', key: 'phase' } as const, 'off' as Phase)
const planPathAtom = atom({ plugin: 'phase-switch', key: 'planPath' } as const, '')

// The planner skill writes plans/<slug>-plan.md; the executor reports "Step X is blocked: <reason>".
const PLAN_FILE = /(^|\/)plans\/[a-z0-9-]+-plan\.md$/
const BLOCKED = /Step [\w.-]+ is blocked:\s*(.*)/i

function showStatus($: EngineInterface, text: string | undefined) {
  $.ui.status(text)
}

export const register: Register = (on, options) => {
  const planningModel = String(options.planningModel ?? 'opus')
  const executionModel = String(options.executionModel ?? 'sonnet')
  const plannerSkill = String(options.plannerSkill ?? 'planner')
  const executorSkill = String(options.executorSkill ?? 'executor')
  const autoReplan = options.autoReplan !== false

  const modelFor = (phase: Phase) =>
    phase === 'plan' ? planningModel : phase === 'exec' ? executionModel : undefined

  const statusFor = (phase: Phase) =>
    phase === 'off' ? undefined : `phase: ${phase} · ${modelFor(phase)}`

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'phase',
      description: 'Show or set the phase: /phase [plan|exec|off]',
    })
    showStatus($, statusFor(await read($, phaseAtom)))

    return next(e)
  })

  on('command.run', { command: 'phase' }, async ($, e) => {
    const wanted = e.args.trim()
    if (wanted === 'plan' || wanted === 'exec' || wanted === 'off') {
      await update($, phaseAtom, () => wanted)
    } else if (wanted !== '') {
      return { text: 'Usage: /phase [plan|exec|off]' }
    }
    const phase = await read($, phaseAtom)
    showStatus($, statusFor(phase))
    const planPath = await read($, planPathAtom)

    return {
      text: `Phase: ${phase}${phase === 'off' ? ' (session model)' : ` (${modelFor(phase)})`}. Plan: ${planPath || 'none recorded'}.`,
    }
  })

  // Skill activation drives the phase: planner -> planning model, executor -> execution model.
  on('skill.prompt', async ($, e, next) => {
    const result = await next(e)
    if (e.skill !== plannerSkill && e.skill !== executorSkill) return result

    const phase: Phase = e.skill === plannerSkill ? 'plan' : 'exec'
    await update($, phaseAtom, () => phase)
    showStatus($, statusFor(phase))

    const planPath = await read($, planPathAtom)
    if (phase !== 'exec' || planPath === '') return result

    // Hand the executor the plan the planner wrote in this session.
    return {
      ...result,
      text: `${result.text}\n\nActive plan (written by the ${plannerSkill} skill this session): ${planPath}. Use it unless the user names another plan file.`,
    }
  })

  // The model switch itself: every main-loop request of the current phase names its model.
  let lastRan = ''

  on('turn.step', async function* ($, e, next) {
    const model = e.agentId === undefined ? modelFor(await read($, phaseAtom)) : undefined

    const result = yield* next(model === undefined ? e : { ...e, model })

    const ran = result.usage?.model
    if (model !== undefined && ran && ran !== lastRan) {
      lastRan = ran
      $.ui.log('requested ' + model + ', ran ' + ran)
    }
    return result
  })

  // Remember the plan file the planner writes, for the executor's hand-off.
  on('tool.call', { tool: 'Write' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny === undefined && ran.isError !== true && PLAN_FILE.test(e.file_path)) {
      await update($, planPathAtom, () => e.file_path)
    }

    return ran
  }).catch(($, e, next) => next(e))

  // A blocked executor step sends the session back to planning.
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (!autoReplan || e.agentId !== undefined || e.reason !== 'answer') return result
    if ((await read($, phaseAtom)) !== 'exec') return result

    const blocked = BLOCKED.exec(e.answer)
    if (blocked === null) return result

    await update($, phaseAtom, () => 'plan')
    showStatus($, statusFor('plan'))
    $.ui.toast(`Executor blocked; switched to planning (${planningModel}).`)
    const planPath = (await read($, planPathAtom)) || 'the active plan'
    await $.prompt.fill({
      text: `Use the ${plannerSkill} skill: revise ${planPath} to resolve this blocker: ${(blocked[1] ?? '').trim()}`,
    })

    return result
  })
}
