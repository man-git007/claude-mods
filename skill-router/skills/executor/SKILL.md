---
name: executor
description: Executes an approved PLAN.md one step at a time (NestJS/TypeScript, repository pattern, TypeORM, Vitest), then stops for the user's review before the next step. Trigger on "execute the next step", "run step N", "continue the plan", or any prompt that names PLAN.md. Expects a PLAN.md written by the planner skill.
---

# Executor

Executes ONE step of an approved `PLAN.md` per turn, then stops. Architecture and conventions come from `CLAUDE.md`; reference cards add task-specific rules and never override it. Does not re-scope, re-plan or re-litigate requirements. Never works on more than one step, and never starts the next without explicit approval.

## Each turn

1. **Read the head**: Read `PLAN.md` with limit 100 (header, Progress, Dependency map, Human actions). If it says `Status: DRAFT`, stop: the plan is not approved.
2. **Pick the step**: the step the user names, else the first `- [ ]` in Progress. If an earlier step is unchecked and the user named a later one, say so and wait. Check the step's `Depends on:` row in the Dependency map: every listed step must be `- [x]`, otherwise stop and report which are missing. If Human actions list something that must happen before this step (a migration run, a baseline fix), ask the user to confirm it is done before starting.
3. **Read only that step**: Grep `-n "^## Step "` in `PLAN.md`, then Read from that step's line to the line before the next `## Step` (or the `---` before the Background plan). Never read other steps or the Background plan. Then read the cards on its `Read:` line (`references/<name>.md` in this skill's directory) and the files it names under Files. Do not explore the codebase to fill gaps: if a path, signature or contract is missing, stop and report.
4. **Tests** (only if the step has Tests): write exactly those scenarios in the spec file the step names, one `it()` per scenario, titled as written. Do not run the spec before implementing. Do not invent extra scenarios or drop listed ones; flag a wrong one in the report.
5. **Implement** exactly the step's Contract and Files. Edit existing files with Edit and create new files with a single Write. Make independent reads in the same turn; do not re-read files that have not changed. Anything the step does not list (files, endpoints, abstractions, dependencies) is out of scope. If the contract cannot work as written, or the step needs a new dependency, stop and report instead of improvising.
   - **Impact list**: if the step has an Impact section, update every dependent it lists under "Dependents updated in this step". Do not touch files it lists as "checked, unaffected" unless the verify output proves they are affected.
   - **Ripple check**: if the step changes an existing exported symbol, constant, entity column, signature or response shape, Grep once for its name in `src` and `test`. Fix every dependent the change breaks (callers, specs, fixtures, mocks, e2e expectations) with minimal edits, even if it is not in Files, and list each under Deviations as "ripple fix". If more than 3 files outside the step's Files need changes, stop and report that the plan's Impact list is incomplete.
6. **Verify**: run each command on the step's `Verify:` line as its own Bash call (split on `&&`), appending `2>&1 | tail -40`. Never use parentheses, `sh -c`, `cd`, `;`, `set -o`, `node -e`, or `grep -r` on `node_modules`. Run every spec on the line, including the existing ones from the step's Impact. If an existing spec fails because of this step's change, fix the dependent. A failure caused by code outside this step and its Impact is a baseline issue: report it, do not fix it. Otherwise fix only what the output shows; if the same check fails twice, stop and report.
   - **Regression gate step** (no new code): do not edit code. Run the Verify commands and report each failure with its key error line and the earlier step that most likely caused it. If the e2e database is unreachable, report e2e as skipped with the error. Do not weaken or skip tests.
7. **Mark done**, only after Verify passes (for the Regression gate: only if everything passed or e2e was the only thing skipped): change that step's `- [ ]` to `- [x]` in Progress with one Edit. Change nothing else in `PLAN.md`. Do not commit, branch or push unless the user asks.
8. **Report and STOP** in exactly this format:
   - **Modified / Created Files:** exact paths
   - **Change Summary:** bullets of functions, classes and exports added or modified
   - **Verification Run:** the scoped command(s) and the result
   - **Deviations:** anything that differed from the step, or "none"; include every ripple fix
   - **Context advice:** `/clear recommended` or `Continue in this session`, with a one-line reason
   - Last line: *"Step X is ready for review. Let me know when you are ready to proceed to Step Y."*

   If the step is blocked, do not tick it. Report `Step X is blocked: <reason>` with the key error line, and stop. After the last step, the final line is instead: *"All steps are complete. Run the full gate listed under Human actions."*

## Context advice

Use the step's `Context:` hint: `heavy` means `/clear recommended`, `light` means `Continue in this session`. Override to `/clear recommended` if this step needed fix attempts, ripple fixes, or read many files. You cannot measure the context yourself, so tell the user to check `/context` when unsure; clearing above roughly 40k tokens is a good rule. Nothing is lost on `/clear`, because progress lives in `PLAN.md`.