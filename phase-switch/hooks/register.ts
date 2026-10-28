import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Phase } from '../types'

const phaseAtom = atom({ plugin: 'phase-switch', key: 'phase' } as const, 'off' as Phase)

export const register: Register = (on, options) => {
  const planningModel = String(options.planningModel ?? 'opus')
  const executionModel = String(options.executionModel ?? 'sonnet')
  const plannerSkill = String(options.plannerSkill ?? 'planner')
  const executorSkill = String(options.executorSkill ?? 'executor')

  const modelFor = (phase: Phase) =>
    phase === 'plan' ? planningModel : phase === 'exec' ? executionModel : undefined

  // Loading a skill sets the phase.
  on('skill.prompt', async ($, e, next) => {
    const result = await next(e)
    if (e.skill === plannerSkill) await update($, phaseAtom, () => 'plan')
    else if (e.skill === executorSkill) await update($, phaseAtom, () => 'exec')

    return result
  })

  // Every main-loop request uses the current phase's model.
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
}