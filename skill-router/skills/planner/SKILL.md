---
name: planner
description: Turns a user story, GitHub issue, ticket or BRD excerpt into an approved test-first plan file at plans/<slug>-plan.md - an at-a-glance architecture summary, a dependency map, and a few consolidated, self-contained steps in the order Foundation, Database, Tests (RED), Implementation (GREEN), Regression gate - that the executor skill runs one step at a time. Trigger on "plan", "scope", "spec out" for a NestJS/TypeScript feature, bug fix or task, or when a ticket is referenced and no approved plan exists.
---

# Planner

The plan is a contract. A separate, cheaper executor model implements it one step per turn with NO memory of other steps, asks no questions, and reads only its own step section, the reference cards the step lists, and the files the step names. Ambiguity left here becomes wrong code, wasted tokens, or a broken existing feature later.

Output: ONE file per feature, `plans/<slug>-plan.md`, built from `plan-template.md` in this skill's directory. `<slug>` is the feature name in kebab-case (lowercase letters, digits, hyphens, at most 40 characters). Create `plans/` if it is missing. Never write a `PLAN.md` in the project root.

## The five rules every plan must satisfy

1. **Test-first (TDD).** All test files (unit and e2e) are written and shown to the developer BEFORE any implementation code, and run once to establish a RED baseline. Phase order is fixed: Foundation → Database → Tests (RED) → Implementation (GREEN) → Regression gate. Details in "Test-first order".
2. **Actionable steps.** Every step names exact file paths and carries a complete Contract. No placeholders, no lookups for the executor. Details in "Actionable steps".
3. **At a glance first.** The plan opens with an "At a glance" section listing every layer the feature touches, its files, and the step that builds it, so the whole architecture can be read in one screen. Details in "At a glance".
4. **Consolidated steps.** Merge tightly coupled work into single steps (config and constants; migration and seeder; repository, service and controller where size allows). Typical plan: 6 to 10 steps, never more than 12. Details in "Consolidation".
5. **Scoped verification.** Every step has exact, compact verification commands on named paths. No whole-suite runs except the final gate. Details in "Verification commands".

## Workflow

1. **Gather input**: ask for the story, issue, ticket or BRD excerpt (whichever exists). If an issue number is given, fetch it with `gh issue view <n>` when available.
2. **Scan the codebase**: `CLAUDE.md` is already loaded. Read `src/modules/template/` and one comparable existing module. Record the real names and paths the steps will cite: auth guard and permission decorator, response envelope/interceptor, time helper, storage service, throttler config, shared utils, spec locations and mocking style, e2e bootstrap and helpers (`test/utils/...`), fixtures. If something the feature needs does not exist, it is a Prerequisite. Never invent a name.
3. **Resolve ambiguity**: one focused question at a time, each with a proposed default. Always settle, for every endpoint: required permission, ownership rule (404 vs 403 for "exists but not yours"), role-restricted response fields, rate limiting, and upload limits if any. Skip questions the input already answers.
4. **Separate prerequisites**: anything the feature needs that does not exist yet (auth guard, upstream migrations, storage service, seed grants, a new dependency, a throttler) is NOT part of this plan. List it under Prerequisites and recommend planning it as its own feature first.
5. **Check the baseline**: run the project's type-check once (the command in `CLAUDE.md`). If it fails today, add "fix the failing baseline" as a before-Step-01 Human action and make sure no `Verify:` can fail because of code outside the step's own files.
6. **Impact scan (mandatory)**: for every EXISTING file the plan modifies, and every existing exported symbol, constant, entity column, function signature or response shape it changes, Grep `src` and `test` for its usages. Collect every dependent: importers and callers, specs, fixtures and factories, mocks of the changed class, e2e specs asserting its responses or tables, seeders, DTO consumers, barrels. Each dependent ends up in exactly one place: (a) a step's Files as `modify` with the change stated, or (b) that step's Impact as "checked, unaffected: <reason>". A dependent in neither place is a plan bug. Cite paths, never line numbers.
7. **Design the steps**: first list every behavior and its test, then lay out the phases (Foundation → Database → Tests RED → Implementation GREEN → Gate), then consolidate under the limits below. Changes to existing behavior follow the same order: modified specs in a RED step, the code change in a GREEN step.
8. **Draft**: write `plans/<slug>-plan.md` from `plan-template.md` with `Status: DRAFT`. If the file exists, ask before replacing it; never overwrite a plan with checked steps without confirmation.
9. **Self-check before the checkpoint** (fix, do not just report):
   - **Rule 1:** every spec file the plan creates or modifies is created in a RED step; no GREEN step creates a spec; every GREEN step lists the specs it turns green and their test counts; every behavior in the acceptance criteria has a test.
   - **Rule 2:** no `<...>` placeholder or "TBD", "check", "find" or "mirror" instruction survives in any step; every path is a file path, not a directory; every constant a step uses is named.
   - **Rule 3:** "At a glance" exists, is complete, and its layer rows match the steps.
   - **Rule 4:** step count ≤ 12; no step is a merge candidate under "Consolidation"; no step breaks the size limits.
   - **Rule 5:** every `Verify:` and `Verify-red:` lists named paths and has an `Expect:` line; no `Verify:` runs a project-wide command; no whole-project type-check appears in more steps than allowed.
   - The dependency map equals every step's `Depends on:`; each step depends only on lower-numbered steps; every step that modifies existing code has an Impact section.
   - Could a model holding only one step section, its cards and its listed files implement it with zero questions? If not, put the answer in the step.
10. **CHECKPOINT**: do not print the whole plan. Show: the file path, the At a glance section, the step list with phases, the Human actions (including the RED-test review gate), the existing files modified with their dependents, and open questions. Tell the user to review the plan file, then stop. On approval, replace the `Status: DRAFT` line with `Status: APPROVED <date>`; on requested changes, edit the file and re-summarize.
11. **Hand off**: tell the user to start the executor with: `Use the executor skill: execute the next unchecked step in plans/<slug>-plan.md.`

## Test-first order (rule 1)

Fixed phase order. A phase may hold several steps if limits require, but phases never interleave.

| Phase | Contains | Tests? | Verify |
|---|---|---|---|
| Foundation | config, constants, types, entities, repository interface and token, RBAC/seed constants. Contracts only, no behavior. | none | compile and lint |
| Database | migration and seeder, plus human run gate | none | compile and lint |
| Tests (RED) | every new or modified spec, unit and e2e, plus minimal stubs if imports need them | written here | `Verify-red:` |
| Implementation (GREEN) | repository, helpers, DTOs, service, controller, module wiring, changes to existing code | none written, only the RED specs turn green | `Verify:` |
| Regression gate | no new code | none | scoped, explicit files |

- A **Tests (RED) step** lists only spec files, fixtures and stubs. Its Contract is a test design: for each spec, a scenario table `it() title | arrange (inputs, mocks and their return values) | act | expected result, status code or message`. It has an "Expected RED" section stating how each spec must fail, and a `Verify-red:` line per spec file. Planners write at most 12 scenarios per RED step and at most 5 spec files; split into 03a/03b by slice (for example unit, then e2e) beyond that.
- **Accepted RED reasons:** the module or method under test does not exist ("Cannot find module" for the target file only), a stub throws `not implemented`, an assertion fails against a stub, a new route returns 404.
- **Not acceptable RED reasons:** syntax errors, imports of existing modules that fail, missing fixtures or helpers, an unreachable database, a failure in a spec the step did not write. The executor must fix or report these in the RED step.
- **Stubs:** when a spec cannot import its target, the RED step may create a minimal stub (empty class or function whose methods throw `new Error('not implemented')`). Stubs are listed under Files as `create stub`, and the matching GREEN step replaces them.
- **E2E in RED:** the e2e spec is written before the controller. It needs the migration applied; add a Human action before the e2e RED step, and say that if the database is unreachable the executor reports e2e RED as skipped.
- **Review gate:** after the last RED step, add a Human action: "Review the specs before proceeding; commit them as the RED baseline." The executor stops after every step anyway, so this is the point where the developer approves the tests.
- **GREEN steps** never create or edit specs written in a RED step. If a spec is wrong, the executor stops and reports it.
- **Existing behavior changes:** the modified expectation of an existing spec belongs to a RED step (state the new expected value), and the code change to a GREEN step.

## Actionable steps (rule 2)

- Every step has Files, Contract and Verify. Files lists exact file paths with `create`, `modify`, `create stub` or `read`. Never a directory.
- Contract: copy the exact signatures, DTO fields and validators, status codes, error messages, constants (named, with their file path), SQL, and the paths of helpers, guards and interceptors the step uses. Never "see plan" or "see Background".
- No placeholders. Where a value depends on runtime data (an existing row id, a role name), give the exact query or fixture to obtain it.
- No lookups: if a step would say "check", "grep", "find" or "mirror", resolve it while planning. A step may name at most 2 existing files to `read` for a pattern, by exact path, and says which part to read.
- Security goes in the Contract: controller steps state the permission decorator, ownership rule, identity source and omitted response fields; service steps state the ownership and role-restriction checks.
- Plan the denial paths: for every service method that reads or writes a resource, include scenarios for not-owner, not-found and role restriction.
- `Read:` lists a reference card only when the step writes code of that type, and is omitted for steps that write none:

  | Step writes | Card |
  |---|---|
  | entity, migration, repository, query, transaction | `data-layer` |
  | controller, DTO, guard/permission, upload | `http-boundary` |
  | service method | `service-logic` |
  | any spec file | `testing` |
  | external call, or a side effect after commit | `ops-hardening` |

- Model tag: `model: flash` by default; `model: pro` only for genuinely hard steps. Add a Human action naming each pro step.
- Context hint: `heavy` if the step reads or modifies more than 3 files or its Contract is long; otherwise `light`.

## At a glance (rule 3)

The first section of the plan, before Progress. It contains: a one-sentence goal; an endpoints table (method, path, permission); a layers table with one row per layer the feature touches (Config/Constants, Migration/Seeder, Entities, Repository, DTOs, Service, Controller/Module, Shared code changed, Tests) giving the new or changed files, the purpose, and the step that builds it; the request flow (`Controller → Service → Repository (interface) → TypeORM → PostgreSQL`); existing code touched; and human gates. Layers the feature does not touch are omitted. At most 45 lines.

## Consolidation (rule 4)

Merge into one step when work is tightly coupled and within limits:
- constants, types, config and contracts that other layers import;
- an entity and its migration (names and constraints must match), and a seeder with them;
- a repository, its service and its controller, when together they stay within the limits below;
- changes to one existing module's shared code that serve the same feature.

Never merge across: the RED/GREEN boundary, a human gate (for example a migration run), different model tags, or work whose Impact is large enough that a failure should be isolated.

Limits per step: at most 10 files, and the step section at most ~2,500 tokens. If a layer exceeds them, split that layer by sub-slice, not by file type. A step should take the executor 8 to 15 requests. Features of 5 files or fewer use three steps: Foundation, Tests (RED), Implementation (GREEN), plus the gate.

## Verification commands (rule 5)

- Each step has one or two `Verify:` commands (or `Verify-red:` lines in RED steps), on named paths, each followed by an `Expect:` line giving the pass count or the expected failures.
- Allowed forms, all with explicit paths:
  - `yarn vitest run <spec file paths> --reporter=dot` (add `--bail=1` for GREEN steps)
  - `yarn oxlint <file paths>`
  - `yarn test:e2e <single e2e spec path>`
  - the project type-check from `CLAUDE.md`, only in steps that change an existing exported signature, entity, or wiring (and in the gate). Do not run it in every step.
- Forbidden outside the gate: `yarn lint`, `yarn test`, `yarn build`, directory-wide `vitest`, several e2e files.
- No pipes and no `tail` in the plan; the executor adds output truncation itself.
- Regression gate: list explicit spec file paths from the Impact lists, not directories. The final full-suite run (`yarn lint && yarn test && yarn test:e2e`) is a Human action.
- Migrations are not run by the executor. Add Human actions: review the migration, run `yarn migration:run`, then `yarn migration:generate --check` if the CLI supports it; say which later step needs it.

## Plan file structure rules

- Top block (everything above the `<!-- END-PROGRESS -->` marker): title, status, file, run line, At a glance, Progress, Dependency map, Human actions. At most 140 lines.
- Step headings are exactly `## Step NN — <Phase>: <title>`; Progress items are exactly `- [ ] Step NN: <Phase>: <title>`, in the same order.
- The run line and file line contain the exact plan path.
- Background plan: short, at the bottom, human-only. Goal, acceptance criteria, edge cases, out of scope, prerequisites, security summary, assumptions. No test lists, file lists or sequence.