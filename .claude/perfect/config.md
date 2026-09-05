---
product: "PoF (Pillars of Fortune)"
stack: "a Next.js 16 + React 19 + TypeScript + Tailwind 4 + Zustand 5 app (SQLite at ~/.pof/pof.db via better-sqlite3) that is an AI-powered UE5 C++ game-development assistant"
vault: ["C:/Users/kazda/Documents/Obsidian/pof"]
vault_subdir: Perfect
base_branch: master
wave_size: 3
lot_caps: {}
pool_target: 10
round_shape: pool
cooldown_rounds: 2
commit_format: "feat(<context>): <title>"
context_map: context-map.json
active_runs_ledger: ""
locale_count: 1
---

# perfect overlay - pof

This repo hosts **parallel sessions**: `git status` shows foreign WIP files; never sweep them into your
commits. Builders share one harness scratchpad.

## Gates
- always: `npm run validate` (typecheck + lint + vitest)
- when catalog-pipeline step components/registries touched: `npm run test:e2e`
- slow: none
- builder: `npx tsc --noEmit` | `npm run lint` (no new warnings in files you touched) | targeted
  `npx vitest run <files>`; then drive the actual flow on the dev server (port **3001**, NOT 3000) and
  report what you COULD NOT verify honestly.

## Class B
- `src/components/layout-lab/steps/index.ts`
- `src/lib/module-registry.ts`
- `src/lib/feature-definitions.ts`
- barrel `index.ts` exports
- `docs/README.md` doc map

## Class C
- the git index
- `context-map.json`
- `step-facts.json`
- any generated artifact under `generated/`
- PoF has **no locale codegen and no ts-rs bindings** - the locale-conflict machinery other projects
  need does not apply here; say so in briefs rather than importing it. Builders report what they need;
  the Director applies it once at quiescence.

## Repo law
Authority: `.claude/CLAUDE.md` (read it first). The Shared Component Manifest there is the first place
to look before building anything.
- Imports via `@/` alias, never relative `../../`. No raw `console.*` - use `logger` from
  `@/lib/logger` (console.error allowed). No hardcoded hex colors - `@/lib/chart-colors` or CSS
  variables. Timing constants from `UI_TIMEOUTS` in `@/lib/constants.ts`.
- API routes return the `{ success, data|error }` envelope via `apiSuccess`/`apiError`
  (`@/lib/api-utils`); client calls use `apiFetch`/`tryApiFetch` with RELATIVE urls. Fallible ops use
  `Result<T,E>` from `@/types/result.ts`.
- REUSE before building: the Shared Component Manifest in `.claude/CLAUDE.md` (CliProduce, StepFrame,
  ChartPanel, CandidateGallery, GlbViewer, DataTable, controls) and the `ui/` primitives (Modal, TabBar,
  MeterBar, StatusToken, RangeSlider, ChartLegend, Tooltip...). Never hand-roll a
  spinner/modal/tooltip/status chip.
- Catalog pipeline steps follow View/Produce/Acceptance (CLAUDE.md Rules 1-5): CliProduce for the
  Produce face, derived Acceptance from truth (never a manual toggle), <=200 LOC per generated file,
  camelCase hierarchy-encoding filenames.
- Zustand v5: never persist transient state; modules are LRU-suspended - use `useSuspendableEffect`
  for timers/polling.
- Tests in `src/__tests__/` (vitest, jsdom): NO jest-dom matchers (assert plain DOM), add your own
  `afterEach(cleanup)`, mock react-window if virtualized, assert inline colors via rgb not hex. Never
  put a measurement harness or temp script under `src/__tests__/` - the gate executes it.
- Structural changes update the matching `docs/architecture/*` or `docs/catalog/*` file in the SAME
  commit (CLAUDE.md law) - plus `docs/README.md`'s doc map if a doc is added or removed.
- Review conventions (Director): `@/` imports, `logger` not console, no hex colors, `UI_TIMEOUTS`,
  `Result<T,E>`, API envelope, the shared-component manifest, <=200 LOC per generated pipeline file.
- Out-of-scope walls: none beyond CLAUDE.md. Push only when the user says so.

## Context sources
- `context-map.json` is written by the Personas app's context scan (`"generator":
  "personas-context-scan"`), NOT by this repo - it can be arbitrarily stale or come from a peer device.
  Print `generator`, `generated_at`, `stats` at Phase 0 and compare against `git log -1`.
- Use the map for the QUEUE; use the **local app DB's `dev_contexts` names** for anything the app
  anchors to (outbox `context`). `.personas/contexts.txt`, `.claude/codebase-context.md` and the local
  app DB can all disagree with the map - shape is not provenance.

## Smoke
- Dev server: port **3001** (`:3000` is Vibeman, not PoF). Verify a new-code marker first - never
  trust a stale port.
- Primary diagnostic: read-only sqlite - `sqlite3 "file:$HOME/.pof/pof.db?mode=ro"`; one `GROUP BY`
  over `pipeline_artifacts` / `judge_verdicts` beats an hour of DOM archaeology.
- Record verified / not-driven / fixes in `sessions/<date>-smoke`; run after every ~2 waves.

## Opportunity arcs
- Judged from context-map metadata, `docs/architecture/*`, `docs/catalog/*`, and memory.
- Active arcs: transparency / judge campaigns, the UE truth ladder, the catalog pipeline program.
- Engine-depth contexts (most directions architecture-level): pipelines, acceptance engines, the
  harness, judges, the UE bridge.

## Vetoes
- The MEMORY.md campaign ledger is dense: shipped programs, "honest ceiling" verdicts, retired
  subsystems - many "obvious" ideas are already DONE. Check before proposing.

## User taste
- Accepts **outcome-value work** (features / optimizations with a visible payoff); rejects **cosmetic
  churn**. Pre-filter the slate and say so.
- Default depth is the engine, not the chrome; UI surfacing at most once-twice per slate unless steered.

## Skill improvement log
- (migrate the existing entries from `$VAULT/Perfect/config.md` on the first 2.3 run, then append here)
- 2026-09-04 (wave 26): **The vault drifted for 16 days without anyone noticing** — wave 25 wrapped into fleet-memory but not into the vault, so Phase 0 read a pool that overstated by 4 and would have re-dispatched a shipped direction (mcp-feature-matrix-scope, named "the first thing wave 25 should take"). Add to Phase 0: `git log --since=<Perfect.md updated>` and grep every `status: accepted` direction's signature symbol before trusting the pool. Cost: ~10 minutes of reconciliation, zero re-builds.
- 2026-09-04: **Builders each spent the session's fleet-memory quota.** All three lots appended 2 lines + pruned (the file sits at the 200 cap), so the Director had none left and one lot's pruning could have removed a sibling's fresh line. Next round's brief: "fleet-memory is Director-only in a wave; report your one-line DELIVERED in the final report."
- 2026-09-04: **The overlay's "port 3001 = PoF" was false** (Gravitone held it) and `npm run validate` was OOM-killed mid-lint (722 MB free of 64 GB from foreign python/WSL processes). Run the gate in stages (typecheck → lint → `vitest run --maxWorkers=3`) when memory is tight; the e2e walker needs `PLAYWRIGHT_PORT=<free>`.
- 2026-09-04: Zero redos, zero DECISION NEEDED across 9 directions — briefs that carried Director-re-verified line numbers, the governing registry technique by name, and an explicit "phase-1 slice if it overruns" clause produced full-scope ships (lot B took bp-write-verify to full scope instead of the slice).
- 2026-09-05 (waves 27-29): **Never run a dev-server-backed e2e (the Rule 5 walker) while builders are mid-edit in the same tree.** The wave-28 walker started while wave 29 was building; Next compiled two siblings' half-written files (`browserOnly is not defined`, an AssetForgeView syntax error) and 27 of 64 specs failed on page-ready — pure transient state, 17 minutes lost. vitest survives this (each file imports at its own moment); a live dev server does not. Run the walker ONCE at quiescence, after the last lot reports.
- 2026-09-05 (wave 29): **Two things only the walker can see, and two Director tooling failures.** (1) A `use client` component importing a constant from a lib that imports the UE runner put `node:child_process` in the browser bundle — the root page would not build; tsgo and vitest are blind to bundle boundaries, so the walker is a per-wave gate, not a Rule-5 formality. (2) A builder wrote a literal U+0000 into source and git flagged the file `Bin`; my review greps only `^[+-]` lines, so a `Bin` line must itself be treated as a finding. (3) My gate chains used `cmd | grep … | head` joined with `&&`, so a red test still returned 0 and I committed a broken state once (`b3971949`) — capture the summary line and test for `failed` explicitly. (4) Writing an escape sequence through the bash tool mangled it three ways; a script FILE built with `String.fromCharCode` was the only reliable form.
