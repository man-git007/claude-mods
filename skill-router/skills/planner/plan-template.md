# PLAN: <title>

Status: DRAFT
File: `plans/PLAN-<slug>.md` · Slug: `<slug>` · Source: <issue/ticket/BRD or none>
Run: `Use the executor skill: execute the next unchecked step in plans/PLAN-<slug>.md.`

## At a glance

**Goal:** <one sentence>

| Method | Path | Permission |
|---|---|---|
| <POST> | `<path>` | `<permission>` |

| Layer | New / changed files | Purpose | Step |
|---|---|---|---|
| Config / Constants | `<paths>` | <what> | 01 |
| Migration / Seeder | `<paths>` | <what> | 02 |
| Entities | `<paths>` | <what> | 01 |
| Repository | `<paths>` | <what> | 05 |
| DTOs | `<paths>` | <what> | 05 |
| Service | `<paths>` | <what> | 05 |
| Controller / Module | `<paths>` | <what> | 06 |
| Shared code changed | `<existing paths>` | <what> | 05 |
| Tests | unit: `<paths>` · e2e: `<path>` | RED baseline | 03, 04 |

**Flow:** Controller → Service → Repository (interface) → TypeORM → PostgreSQL
**Existing code touched:** `<paths>`
**Human gates:** <migration run, seed, test review, baseline>

## Progress

- [ ] Step 01: Foundation: <title>
- [ ] Step 02: Database: <title>
- [ ] Step 03: Tests (RED): <title>
- [ ] Step 04: Implementation (GREEN): <title>
- [ ] Step 05: Regression gate

## Dependency map

| Step | Phase | Depends on | Existing files modified | Human action | Model | Context |
|---|---|---|---|---|---|---|
| 01 | Foundation | none | `<path>` | before: <baseline> | flash | heavy |
| 02 | Database | 01 | none | after: run migration | flash | light |
| 03 | RED | 01, 02 | `<existing spec>` | after: review specs, commit | flash | heavy |
| 04 | GREEN | 03 | `<path>` | - | flash | heavy |
| 05 | Gate | 01-04 | none | after: full gate | flash | light |

## Human actions (not for the executor)

- **Before Step 01:** <baseline type-check passes; prerequisite landed; dependencies installed>
- **After Step 02:** review the migration, run `yarn migration:run`, then `yarn migration:generate --check`; needed by Step 03 (e2e RED) and Step 04.
- **After the last RED step:** review the specs, approve or edit them, and commit them as the RED baseline. Nothing is implemented until you approve.
- **Step NN** is tagged `model: pro`: run it on the stronger model.
- **After the last step:** run the full gate: `yarn lint && yarn test && yarn test:e2e`.
- Commit after each approved step; squash before the PR.

<!-- END-PROGRESS: everything above must stay within 140 lines -->

## Step 01 — Foundation: <title>
model: flash
Read: data-layer
Depends on: none
Context: heavy
Phase: FOUNDATION

### Files
- create `src/modules/<x>/<x>.constants.ts`
- create `src/modules/<x>/entities/<x>.entity.ts`
- create `src/modules/<x>/repository/<x>.repository.interface.ts` (interface and injection token only)
- modify `src/common/constants/<existing>.ts` (<what changes>)

### Contract
<Exact constants (names, values), types, entity columns and constraints, interface method
signatures, and the exact edits to existing constants. No behavior.>

### Impact
- Changed: `<existing symbol / constant / shape>`
- Dependents updated in this step: `<path>` (<what>)
- Checked, unaffected: `<path>` (<reason>)
- Existing specs that must still pass: `<spec file paths>`

### Verify
Verify: yarn oxlint <file paths>
Expect: no errors

---

## Step 02 — Database: <title> (migration and seeder)
model: flash
Read: data-layer
Depends on: 01
Context: light
Phase: DATABASE

### Files
- create `src/database/migrations/<timestamp>-<Name>.ts`
- modify `src/database/seeds/<existing>.ts` (<only if data changes>)

### Contract
<Exact SQL: tables, columns, constraints, indexes, FK actions, seed rows. The executor does not run the migration.>

### Verify
Verify: yarn oxlint src/database/migrations/<timestamp>-<Name>.ts
Expect: no errors

---

## Step 03 — Tests (RED): <slice>
model: flash
Read: testing
Depends on: 01, 02
Context: heavy
Phase: RED

### Files
- create `src/modules/<x>/<x>.service.spec.ts`
- create `test/<x>.e2e-spec.ts`
- create stub `src/modules/<x>/<x>.service.ts` (only if the spec cannot import its target; every method throws `new Error('not implemented')`)
- modify `<existing spec>` (<new expectation>)

### Contract (test design)
Setup: <mocks, fixtures, helper functions with exact paths>.

| it() title | Arrange | Act | Expected |
|---|---|---|---|
| <title> | <inputs, mock returns> | <call> | <value / status / message> |

### Expected RED
<Per spec: how many tests fail and why (module missing / stub throws / 404 on new route). Not acceptable: syntax errors, failing imports of existing modules, missing fixtures, unreachable database.>

### Verify
Verify-red: yarn vitest run src/modules/<x>/<x>.service.spec.ts --reporter=dot
Expect: <N> failing for the reasons above
Verify-red: yarn test:e2e test/<x>.e2e-spec.ts
Expect: <N> failing (404 on new routes)

---

## Step 04 — Implementation (GREEN): <title>
model: flash
Read: <cards for the code written>
Depends on: 03
Context: heavy
Phase: GREEN

### Files
- create `<repository, service, controller, module paths>`
- modify `<existing paths>` (<what changes>)

### Contract
<Exact signatures, ownership and permission rules, status codes, messages, SQL semantics, response fields and omitted fields. Everything needed; nothing to look up.>

### Turns green
- `src/modules/<x>/<x>.service.spec.ts` (<N> tests)
- `test/<x>.e2e-spec.ts` (<N> tests)

### Impact
- Changed: `<existing symbol>`
- Dependents updated in this step: `<path>` (<what>)
- Checked, unaffected: `<path>` (<reason>)
- Existing specs that must still pass: `<spec file paths>`

### Verify
Verify: yarn vitest run src/modules/<x>/<x>.service.spec.ts <impact spec paths> --reporter=dot --bail=1
Expect: all pass (<N> tests)
Verify: yarn test:e2e test/<x>.e2e-spec.ts
Expect: all pass (<N> tests)

---

## Step 05 — Regression gate (no new code)
Depends on: 01-04
Context: light
Phase: GATE

### Files
- none (do not edit code; report failures)

### Contract
Run the specs listed below, each file by its explicit path (from the Impact lists). Report each failure with its key error line and the earlier step that likely caused it. If the database is unreachable, report e2e as skipped.

### Verify
Verify: yarn vitest run <explicit spec file paths> --reporter=dot
Expect: all pass
Verify: yarn test:e2e <existing e2e file path> <new e2e file path>
Expect: all pass

---

## Background plan (human reference; the executor never reads this)

### Goal
### Acceptance Criteria
### Edge Cases
### Out of Scope
### Prerequisites
### Security & Access
### Assumptions / Open Questions