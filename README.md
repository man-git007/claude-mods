# Phase Tools for Claude Code

Two small [Claude Code mods](https://code.claude.com/docs/en/plugins/mods/overview) for a plan-then-execute workflow:

| Mod | What it does |
| :- | :- |
| **skill-router** | Switches the model automatically when the `planner` or `executor` skill loads. |
| **phase-meter** | Shows token usage per phase and per model. |

Use either one alone, or both together.

## Requirements

Claude Code v2.1.287 or later.

## Install

```bash
git clone <your-repo-url> ~/mods/claude-mods
```

Load both mods:

```bash
claude --plugin-dir ~/mods/claude-mods/skill-router --plugin-dir ~/mods/claude-mods/phase-meter
```

To load them every time, add this to your shell profile (absolute paths, separated by `:`):

```bash
export CLAUDE_CODE_PLUGIN_DIRS="$HOME/mods/claude-mods/skill-router:$HOME/mods/claude-mods/phase-meter"
```

Or use an alias:

```bash
alias claude='claude --plugin-dir ~/mods/claude-mods/skill-router --plugin-dir ~/mods/claude-mods/phase-meter'
```

Run `/plugin` and look for `2 mods active` to confirm both loaded.

Mods run with your permissions. Before loading one, list what it does:

```bash
claude plugin validate ~/mods/claude-mods/skill-router
claude plugin validate ~/mods/claude-mods/phase-meter
```

---

## skill-router

You do not need to run `/model` to change models.

- `/planner ...` switches to the planning model (default `opus`).
- `/executor ...` switches to the execution model (default `sonnet`).

This also works when Claude loads the skill itself.

**How it works.** Loading a skill triggers the mod's `skill.prompt` hook, which records the phase. Its `turn.step` hook then names that phase's model on every request the main conversation makes. `/model` and your session setting are never changed.

**Behavior**

- Before any skill loads, your normal session model is used.
- The last skill loaded wins, so `/planner` after `/executor` switches back.
- Subagents keep their own model.
- The prompt cache is not shared between models, so the first request after a switch re-reads the full context at full price.
- On organization-managed installs, `skill.prompt` hooks may not run for plugins you install yourself. If the model does not switch, ask your admin to allow the plugin.

**Settings** (in `/config`): `planningModel`, `executionModel`, `plannerSkill`, `executorSkill`. Skills are set by name, not path.

**Check it worked.** Press Ctrl+O and look for a line like `requested opus, ran claude-opus-...`.

---

## phase-meter

Claude Code's `/usage` and `/cost` show session totals only. phase-meter tags each model request with the active phase and reports per-phase tokens, cache hit rate, and cost.

1. Work as usual. The spinner shows spend per phase, like `plan 12.4k · exec 40.1k`.
2. Type `/phase-meter` to open the pane. `Esc` closes it, `r` resets.

The pane shows spend per phase, requests, cache hit rate, estimated cost, context-window fill, plan limits, and token budget progress. Numbers are per session and reset on restart.

**Configuration.** Edit the constants at the top of `phase-meter/hooks/register.ts`.

Token budget (input + output + cache-write tokens; `0` turns it off). A toast appears at 80% and 100%:

```ts
const BUDGET_TOKENS = 0
```

Prices (USD per 1M tokens, matched by a case-insensitive part of the model name). Cost shows only for models you price:

```ts
const PRICES: Record<string, Price> = {
  'sonnet': { in: 3, out: 15, cr: 0.3, cc: 3.75 }, // example, use real prices
}
```

**Phase source.** phase-meter reads the phase from the `CLAUDE_PHASE` environment variable, then the first line of `~/.claude/phase`, otherwise `unknown`. skill-router keeps its phase in memory and does not write either, so until you set one, usage is grouped under `unknown`.

**What the numbers mean**

| Stat | Definition |
| :- | :- |
| Spend | input + output + cache-write. Cache reads are excluded. |
| Cache hit rate | cache-read ÷ (input + cache-read + cache-write). A falling rate usually means something is breaking your cache. |
| Last / peak turn | Spend of the latest and largest main-conversation turn. |
| Cost (Claude Code) | Claude Code's own estimate at Anthropic prices. Ignore it for non-Anthropic backends. |

---

## Limitations

- phase-meter is per session only. Nothing is saved.
- Subagent requests count toward phase totals but not last/peak turn.
- phase-meter reads the model name from `usage.model`, then `result.model`, then `e.model`. These field shapes are assumptions.
- Long lines may truncate in a narrow pane.

## Development

```bash
claude plugin validate ./skill-router
claude plugin test ./skill-router
claude --plugin-dir ./skill-router   # reloads when you save
```

## License

Add a `LICENSE` file before publishing and name it here.
