import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

const SKILL = { frontmatter: {}, source: 'projectSettings' } as const

function capture(on: On) {
  const seen: string[] = []
  on('skill.prompt', ($, e) => ({ text: e.text }))
  on('turn.step', async function* ($, e) {
    seen.push(e.model)
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: null }
  })
  return seen
}

async function step($: Engine, extra: object = {}) {
  const stream = $.turn.step({ turnId: 't', index: 0, model: 'session-model', messageCount: 1, ...extra } as never)
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

test('an unrelated skill does not change the model', async ($, on) => {
  const seen = capture(on)
  await $.skill.prompt({ skill: 'other', text: 'x', ...SKILL } as never)
  await step($)
  expect(seen).toEqual(['session-model'])
})

test('the last skill loaded wins', async ($, on) => {
  const seen = capture(on)
  await $.skill.prompt({ skill: 'executor', text: 'exec', ...SKILL } as never)
  await step($)
  await $.skill.prompt({ skill: 'planner', text: 'plan', ...SKILL } as never)
  await step($)
  expect(seen).toEqual(['sonnet', 'opus'])
})

test('subagent requests keep their own model', async ($, on) => {
  const seen = capture(on)
  await $.skill.prompt({ skill: 'planner', text: 'plan', ...SKILL } as never)
  await step($, { agentId: 'sub-1' })
  expect(seen).toEqual(['session-model'])
})