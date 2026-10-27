# phase-usage

A [Claude Code mod](https://code.claude.com/docs/en/plugins/mods/overview) that shows token usage split by **phase** (for example `plan` and `exec`) and by model, so you can see where your tokens go and stay inside your limits.

Claude Code's built-in `/usage` and `/cost` give session totals. They don't know about your workflow phases. This mod tags every model request with the phase that was active when it was sent, then reports per-phase spend, cache efficiency, and cost.

> **Status:** early. It loads and runs on the documented mods API, but a few field shapes (noted under [Limitations](#limitations)) are assumptions. Issues and fixes welcome.

## Features

- **Live readout** beside the spinner while Claude works: `plan 12.4k · exec 40.1k…`
- **`/phase-usage` pane** with:
  - a percentage bar of spend per phase
  - per phase: request count, average output per request, fresh input, output, cache-write, cache-read, cache hit rate, and estimated cost
  - session: context-window fill, plan rate-limit percentages and reset times, last and peak turn size, token pace, budget progress, and Claude Code's own cost estimate
- **Budget toasts** at 80% and 100% of a token budget you set
- **Reset button** (`r`) to clear the session's numbers

## Requirements

- Claude Code **v2.1.287 or later** (mods are on by default from that version)
- Terminal, Desktop app, or VS Code extension for the pane. Hooks also run in `claude -p`, but nothing draws there.

## Install

Clone the repository and load it for a session:

```bash
git clone <your-repo-url> ~/mods/phase-usage
claude --plugin-dir ~/mods/phase-usage
```

To load it every time, set `CLAUDE_CODE_PLUGIN_DIRS` (absolute paths, separated by `:`):

```bash
export CLAUDE_CODE_PLUGIN_DIRS="$HOME/mods/phase-usage"
```

To load it alongside other mods, repeat the flag:

```bash
claude --plugin-dir ~/mods/phase-switch --plugin-dir ~/mods/phase-usage
```

Run `/plugin` and look for `mods active` to confirm it loaded.

### Security

A mod is code that runs with your permissions, inside Claude Code. It can read your session and environment. Before loading any mod, list what it does:

```bash
claude plugin validate ~/mods/phase-usage
```

This mod reads the `CLAUDE_PHASE` environment variable and `$HOME`, reads `~/.claude/phase`, and makes no network requests.

## Usage

1. Start Claude Code with the plugin loaded.
2. Work as usual. The spinner shows spend per phase.
3. Type `/phase-usage` to open the pane. Press `Esc` to close it, `r` to reset.

Numbers are **per session** and held in memory. They reset when you restart Claude Code.

## Configuration

Edit the constants at the top of `hooks/register.ts`.

### Phase source

`currentPhase()` decides which phase a request belongs to. By default it reads, in order:

1. the `CLAUDE_PHASE` environment variable
2. the first line of `~/.claude/phase`
3. otherwise `unknown`

Make whatever switches your phase write one of those, or edit `currentPhase()` to read your own source. The phase is read when a request is **sent**, so a switch mid-request doesn't misattribute it.

### Token budget

```ts
const BUDGET_TOKENS = 0 // non-cache tokens per session. 0 = off
```

Counts input + output + cache-write tokens. A toast appears at 80% and 100%.

### Prices

Cost is only shown for models you price. Prices are USD per 1M tokens, matched by a case-insensitive substring of the model name:

```ts
const PRICES: Record<string, Price> = {
  'sonnet': { in: 3, out: 15, cr: 0.3, cc: 3.75 }, // example shape, use your provider's real prices
}
```

If a phase used a model with no entry, its cost is shown as a lower bound. With `PRICES` empty, the pane shows `cost n/a`.

## What the numbers mean

| Stat | Definition |
| :- | :- |
| Spend | `input + output + cache-write`. Cache reads are excluded because they dominate volume and are billed far lower. |
| Cache hit rate | `cache-read ÷ (input + cache-read + cache-write)`. A falling rate usually means something is breaking your prompt cache. |
| Last / peak turn | Spend of the most recent and the largest main-conversation turn (subagent turns excluded). |
| Context | Tokens in the context window ÷ window size, from `$.session.usage()`. |
| Limits | Plan rate-limit percent used and reset time, from `$.session.usage()`. |
| Cost (Claude Code) | Claude Code's own session estimate, computed at Anthropic pricing. Ignore it if a phase routes to a non-Anthropic backend. |

## How it works

| Event | What the mod does |
| :- | :- |
| `turn.step` | Reads `result.usage` after each request, tags it with the phase and model, checks the budget |
| `turn.complete` | Records last and peak turn size |
| `ui.render` (Spinner) | Adds the per-phase readout |
| `ui.render` (Pane) | Draws the `/phase-usage` pane |
| `session.start` / `command.run` | Registers and opens `/phase-usage` |

Layout:

```
phase-usage/
├── .claude-plugin/plugin.json
└── hooks/
    ├── hooks.json      # {"modules": ["./register.ts"]}
    └── register.ts
```

## Limitations

- **Per session only.** Nothing is persisted. The mods `$.store` is shared across sessions and writes race, so persistence needs per-key writes.
- **Subagents** are included in the phase totals but not in last/peak turn.
- **Non-Anthropic backends:** token counts are only as accurate as what the backend reports. Treat dollar figures from Claude Code's own estimate as invalid in that case.
- **Assumed field shapes:** the docs state `result.usage` has `input_tokens`, `output_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens`, plus the model, but not where the model name sits. This mod reads `usage.model`, then `result.model`, then `e.model`. `turn.complete`'s `e.usage` is assumed to use the same field names.
- **Pane width:** lines are long. In a narrow pane they may truncate or scroll.
- **Context percentage:** if `$.session.usage().context.tokens` is missing, the context line may be wrong or absent.

## Development

```bash
claude plugin validate ./phase-usage      # check manifest, events, and calls
claude --plugin-dir ./phase-usage         # reloads the hooks module when you save
```

Mods can be tested without a session with `claude plugin test`. See [Test a mod](https://code.claude.com/docs/en/plugins/mods/test).

## Contributing

Issues and pull requests are welcome. If a number looks wrong, attach the output of a debug line such as:

```ts
$.ui.log('usage=' + JSON.stringify(result?.usage))
```

## License

Add a `LICENSE` file before publishing and name it here.