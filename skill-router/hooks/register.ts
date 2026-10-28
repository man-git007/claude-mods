import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Phase } from '../types'

const phaseAtom = atom({ plugin: 'skill-router', key: 'phase' } as const, 'off' as Phase)

// Models for each phase. `planning` / `execution` stay undefined until the first request.
type Models = {
  configPlanning: string
  configExecution: string
  planning?: string
  execution?: string
}

// Minimal .env parser: KEY=VALUE, optional `export`, quotes, # comments.
function parseDotenv(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of text.split(/\r?\n/)) {
    const eq = line.indexOf('=')
    if (eq < 1) continue
    const key = line.slice(0, eq).trim().replace(/^export\s+/, '')
    if (!/^\w+$/.test(key)) continue
    let value = line.slice(eq + 1).trim()
    const quote = value[0]
    if ((quote === '"' || quote === "'") && value.length > 1 && value.endsWith(quote)) {
      value = value.slice(1, -1)
    } else {
      const hash = value.search(/\s#/)
      if (hash >= 0) value = value.slice(0, hash).trim()
    }
    out[key] = value
  }
  return out
}

async function readDotenv($: EngineInterface): Promise<Record<string, string>> {
  try {
    if (!(await $.fs.exists('.env'))) return {}
    return parseDotenv(await $.fs.read('.env'))
  } catch {
    return {}
  }
}

// Launch-time models, resolved once per session on the first request. Order:
// process environment, then ./.env in the session's working directory,
// then /config, then the default. Variables: SKILL_ROUTER_PLANNING_MODEL,
// SKILL_ROUTER_EXECUTION_MODEL.
async function resolveModels($: EngineInterface, models: Models): Promise<void> {
  if (models.planning !== undefined && models.execution !== undefined) return
  const dotenv = await readDotenv($)
  const fromEnvPlanning = (await $.env.get('SKILL_ROUTER_PLANNING_MODEL'))?.trim()
  const fromEnvExecution = (await $.env.get('SKILL_ROUTER_EXECUTION_MODEL'))?.trim()
  models.planning = fromEnvPlanning || dotenv.SKILL_ROUTER_PLANNING_MODEL?.trim() || models.configPlanning
  models.execution = fromEnvExecution || dotenv.SKILL_ROUTER_EXECUTION_MODEL?.trim() || models.configExecution
  $.ui.log('skill-router: planning=' + models.planning + ' execution=' + models.execution)
}

export const register: Register = (on, options) => {
  const plannerSkill = String(options.plannerSkill ?? 'planner')
  const executorSkill = String(options.executorSkill ?? 'executor')
  const models: Models = {
    configPlanning: String(options.planningModel ?? 'opus'),
    configExecution: String(options.executionModel ?? 'sonnet'),
  }

  const modelFor = (phase: Phase) => {
    if (phase === 'plan') return models.planning
    if (phase === 'exec') return models.execution
    return undefined
  }

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
    await resolveModels($, models)
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
