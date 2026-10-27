import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

const SKILL = { frontmatter: {}, source: 'projectSettings' } as const

function capture(on: On) {
  const seen: string[] = []
  on('skill.prompt', ($, e) => ({ text: e.text }))
  on('ui.status', () => ({ value: undefined }) as never)
  on('ui.toast', () => ({ value: undefined }) as never)
  on('turn.step', async function* ($, e) {
    seen.push(e.model)
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: null }
  })
  return seen
}

async function step($: Engine) {
  const stream = $.turn.step({ turnId: 't', index: 0, model: 'session-model', messageCount: 1 })
  for await (const _ of stream) {
    // drain
  }
  await stream
}

test('no phase leaves the session model alone', async ($, on) => {
  const seen = capture(on)
  await step($)
  expect(seen).toEqual(['session-model'])
})

test('planner skill selects the planning model, executor the execution model', async ($, on) => {
  const seen = capture(on)
  await $.skill.prompt({ skill: 'planner', text: 'plan', ...SKILL } as never)
  await step($)
  await $.skill.prompt({ skill: 'executor', text: 'exec', ...SKILL } as never)
  await step($)
  expect(seen).toEqual(['opus', 'sonnet'])
})

test('configured models and skill names are honoured', {
  options: { planningModel: 'claude-opus-5-5', executionModel: 'haiku', plannerSkill: 'my-plan' },
}, async ($, on) => {
  const seen = capture(on)
  await $.skill.prompt({ skill: 'my-plan', text: 'plan', ...SKILL } as never)
  await step($)
  await $.skill.prompt({ skill: 'executor', text: 'exec', ...SKILL } as never)
  await step($)
  expect(seen).toEqual(['claude-opus-5-5', 'haiku'])
})

test('a blocked executor step switches back to planning', async ($, on) => {
  const seen = capture(on)
  on('turn.complete', $ => ({ text: '' }))
  on('prompt.fill', () => ({ isFilled: true }) as never)
  await $.skill.prompt({ skill: 'executor', text: 'exec', ...SKILL } as never)
  await $.turn.complete({
    turnId: 't',
    reason: 'answer',
    answer: 'Step 04 is blocked: entity has no tenant column',
    durationMs: 1,
    isAborted: false,
  })
  await step($)
  expect(seen).toEqual(['opus'])
})
