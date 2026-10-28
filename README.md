# Phase Tools for Claude Code

Two small [Claude Code mods](https://code.claude.com/docs/en/plugins/mods/overview) for a plan-then-execute workflow:

| Mod | What it does |
| :- | :- |
| **skill-router** | Switches the model automatically when the `planner` or `executor` skill loads. |
| **phase-meter** | Shows token usage per phase and per model. |

Use either one alone, or both together.

## Do you need skill-router?

Possibly not. skill-router may be redundant, depending on what you want automated.

**What Claude Code already does without a mod**

- `/model <alias|name>` switches the model for the whole session, manually. Switching mid-conversation re-reads the history without cache, the same cost as the mod's switches.
- The `opusplan` alias uses opus in Plan Mode and sonnet for execution. Toggle Plan Mode with Shift+Tab. Set it with `claude --model opusplan` or `/model opusplan`.
- `ANTHROPIC_DEFAULT_OPUS_MODEL` and `ANTHROPIC_DEFAULT_SONNET_MODEL` choose which concrete models `opusplan` uses.
- A subagent's `model:` field sets that subagent's model.

**What only skill-router does**

- Switches when a skill you name in the config loads (`/planner`, `/executor`), not when Plan Mode is toggled.
- Reads the planning and execution models from `.env` or the shell, per project.

That is all it does. It does not pass the plan file to the executor, return to planning on a blocked step, or draw a status line.

**Recommendation**

- If your workflow is plan in Plan Mode, approve, then execute, use `opusplan`. It is built in and needs no maintenance.
- Use skill-router only if you want a skill-driven workflow: a planner skill and an executor skill. It ships with both (see [Bundled skills](#bundled-skills)), and you can replace them with your own. The mod only acts when a skill with a matching name loads; otherwise it does nothing.
- The mod adds hooks you must maintain, and on organization-managed installs `skill.prompt` hooks may not fire for plugins you install yourself.
- phase-meter does not depend on skill-router, but it needs a phase source (see phase-meter below). Until you set `CLAUDE_PHASE` or `~/.claude/phase`, it groups usage under `unknown`.

---

## Requirements

- Claude Code v2.1.287 or later.
- **For skill-router:** a planner skill and an executor skill. Both are included in `skill-router/skills/` and available whenever the mod is loaded. To use your own skills instead, install them (for example `.claude/skills/<name>/SKILL.md`) and set `plannerSkill` and `executorSkill` to their names.

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

**How it works.** Loading a skill triggers the mod's `skill.prompt` hook, which records the phase. Its `turn.step` hook then sends that phase's model name with every request the main conversation makes. `/model` and your session setting are never changed.

**Behavior**

- Before any skill loads, your normal session model is used.
- The last skill loaded wins, so `/planner` after `/executor` switches back.
- Subagents keep their own model.
- The prompt cache is not shared between models, so the first request after a switch re-reads the full context at full price.
- It switches only when a skill whose name matches `plannerSkill` or `executorSkill` loads. The bundled skills match by default; with no matching skill it does nothing.
- The models must be available on the endpoint and plan your session started with. The mod cannot switch endpoints.
- On organization-managed installs, `skill.prompt` hooks may not run for plugins you install yourself. If the model does not switch, ask your admin to allow the plugin.

### Choose the models

Put these in a `.env` file in the project where you run Claude Code (the session's working directory, not the mod folder):

```bash
SKILL_ROUTER_PLANNING_MODEL=opus
SKILL_ROUTER_EXECUTION_MODEL=haiku
```

Or set them in the shell for one run:

```bash
SKILL_ROUTER_PLANNING_MODEL=opus SKILL_ROUTER_EXECUTION_MODEL=haiku \
  claude --plugin-dir ~/mods/claude-mods/skill-router
```

Either variable can be set alone. Order of precedence, per phase:

1. shell environment
2. `.env`
3. `/config` (`planningModel`, `executionModel`)
4. default (`opus` / `sonnet`)

Values are read once, on the first request, so changing them needs a restart. The mod reads only these two keys from `.env`, but it does read the whole file into memory, so keep `.env` out of git.

### Aliases and full IDs

The mod passes your string through unchanged. It does not look up or compare versions.

| You set | Result |
| :- | :- |
| `opus`, `sonnet`, `haiku` | An alias. Claude Code decides which version it means, and that can change when Claude Code updates. |
| `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-5-5` | A full ID. The version is pinned. |

Aliases are documented for subagents and `$.model.complete`; whether `turn.step` accepts them is unconfirmed. If an alias fails, use a full ID.

### Check it worked

Press Ctrl+O. On the first request you will see `skill-router: planning=... execution=...` with the models in use. After that, each switch logs `requested <your string>, ran <model>`. `ran` is the concrete model the API reports, so it shows which version actually answered.

### Bundled skills

skill-router includes a planner skill and an executor skill. You can use them as they are or edit them to fit your process.

```
skill-router/
├── .claude-plugin/plugin.json
├── hooks/                       # the mod (hooks.json, register.ts, tests)
└── skills/
    ├── planner/SKILL.md
    └── executor/SKILL.md
```

**Use them.** Load the mod, then run the planner skill, then the executor skill. Plugin skills are normally run with the plugin name as a prefix, so expect `/skill-router:planner` and `/skill-router:executor`. Type `/` to see the exact names.

**Modify them.** Edit the text of `skills/planner/SKILL.md` and `skills/executor/SKILL.md`. Keep these rules:

- The file must be named `SKILL.md`. A file named `CLAUDE.md` is not a skill.
- Keep the frontmatter (`name` and `description`) at the top.
- Keep each skill in its own folder under `skills/`.
- After editing, run `/reload-plugins` or restart Claude Code.

**Rename or replace them.** The mod switches models by matching the loaded skill's name against `plannerSkill` and `executorSkill` in `/config`. If you rename a skill, or use your own, change those settings to match.

**If the model does not switch.** The name Claude Code reports for a plugin skill may include the prefix (`skill-router:planner`). Set `plannerSkill` and `executorSkill` to the full prefixed names, then restart and check the `requested ..., ran ...` lines (Ctrl+O).

### Other settings

In `/config`: `plannerSkill` and `executorSkill`. Skills are set by name, not path.

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
- skill-router's tests cover phase selection only. The test engine has no environment or file API, so the `.env` and variable overrides are checked by hand (see below).

## Development

```bash
claude plugin validate ./skill-router
claude plugin test ./skill-router
claude --plugin-dir ./skill-router   # reloads when you save
```

To check the model overrides by hand: set `SKILL_ROUTER_PLANNING_MODEL` and `SKILL_ROUTER_EXECUTION_MODEL` in `.env`, restart, run `/planner x`, then `/executor x`, and confirm the `requested ..., ran ...` lines.

## License

Add a `LICENSE` file before publishing and name it here.