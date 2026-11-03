# Game workspaces

PoF manages more than one game. A **game** is a code-registered workspace that owns canon profiles, a
pipeline manifest and an engine binding. PoF's own ARPG is game `pof`; **GTAI: Uprising** (a top-down
open-city crime sandbox) is game `gtai`, the first non-ARPG game. Introduced by spark
`gtai-uprising-project` (2026-11-01).

Sources of truth: `src/lib/games/` (`types.ts`, `registry.ts`, `pof.ts`, `gtai.ts`, `ueBinding.ts`,
`gameRoot.ts`, `godot/evidenceTypes.ts`, `godot/readEvidence.ts`), `src/lib/harness/godot-gates.ts`,
`src/lib/catalog/canon/profiles.ts`, `src/app/api/catalog-entities/route.ts`,
`src/lib/catalog/acceptance/staticVerify.ts`. Tests: `src/__tests__/lib/games/`,
`src/__tests__/api/catalog-entities-provenance.test.ts`, `src/__tests__/games/godot/`,
`src/__tests__/lib/harness/godot-gates.test.ts`.

## What a game is

`GameDef` (`src/lib/games/types.ts`):

| Field | Meaning |
|-------|---------|
| `id` | A minted `GameId` (`'pof' \| 'gtai'`), never a display name, so identity survives a rename. |
| `title` | Display name. |
| `canonProfiles` | The canon profiles whose entities belong to this game. The **first** is the profile new entities are authored under (`authoringProfileOf`). |
| `manifest` | Which pipelines the game uses: `'all'` (PoF) or a list of `ManifestEntry`. |
| `engine` | `{ kind: 'ue5', root: string \| null }`, `{ kind: 'godot', version, root: string \| null }` (a locked non-UE engine; `root` is the game's own repo relative to the PoF repo root. L2 reads its evidence, see "Engine evidence (Godot)"; the runtime tiers are UE-only and defer with an adapter-missing reason) or `{ kind: 'undecided' }`. |
| `designDir` | Repo-relative folder holding the game's versioned design truth (`games/gtai`). |

Games are registered in code (`GAMES` in `registry.ts`), not in the DB. The registry is pure (no Node
imports), so client and server resolve a game the same way. `getGame(id)` **throws** on an unknown id,
and `gameOfProfile(profile)` throws on a profile no game lists. Silently resolving either to PoF would
put one game's entities on another game's board with nothing to say so. This is the same rule as
`rulesForProfile`.

## The derived-game rule

Nothing stores a game id on an entity or an artifact. The game is **derived**:

```
gameOfEntity(e) = gameOfProfile(canonProfileOf(e))      // canonProfileOf(e) = e.provenance?.canonProfile ?? 'pof'
```

- Code seeds carry no provenance, so they belong to `pof`.
- `diablo1` is a canon profile **inside** game `pof`. The `/diablo` loop replicates Diablo I into PoF's
  tree and UE project; it is not a second game.
- `gtai` entities carry `canonProfile: 'gtai'` (authored provenance, below).
- An artifact inherits its entity's game. `catalog_entities` and `pipeline_artifacts` need no migration
  and no game column.

Intake-minted entity ids are prefixed `<gameId>-` because the entity PK `(catalog_id, entity_id)` is
global across games.

## The pipeline manifest

A `ManifestEntry` is `{ catalogId, fit, note?, expected? }`:

- `reuse`: the pipeline is genre-neutral and is used as it is.
- `reskin`: the pipeline's shape fits but its ARPG content does not. The `note` says how it is reworked,
  e.g. `quests -> hitman contracts`.
- `planned`: a genre pipeline the game needs that does not exist yet. `catalogId` is the slug it will
  take (`vehicles`, `wanted-heat`, `traffic`, `city-blocks`, `contracts`, `radio`, `firearms`,
  `top-down-camera`, `garages`).

`catalogsForGame(id, registered)` splits the registered pipelines into `inManifest` (manifest order),
`offManifest` (shown only under "show all pipelines") and `planned`. PoF's `manifest: 'all'` keeps the
existing view: every registered pipeline, in registration order.

GTAI's manifest classifies all 33 registered pipelines. 14 are `reuse`, 14 are `reskin`, and 5 ARPG-only
ones (`affixes`, `loot-tables`, `items`, `crafting-recipes`, `codex`) are deliberately omitted. The
omissions are listed with their reasons in `GTAI_OMITTED`, beside the manifest. A coverage test
(`gtaiManifest.test.ts`) fails when a registered pipeline is in neither list, so a new pipeline has to
be classified for every game with an explicit manifest.

## The absent-value convention

This convention applies once, everywhere in the games layer.

- **Omit the key** for "not applicable": `expected`, `note`, `designDir`. An absent `expected` means
  "no target declared". It is not zero, and coverage for that pipeline reads "no target declared".
- `engine.root: null` is a **claim**: "no engine project bound". It renders as "unbound", never as zero
  or as a failure.
- An unmeasured readiness reads "unmeasured", never R0.

## The engine binding

`ueRootForGame(id)` (`src/lib/games/ueBinding.ts`) is server-only. It reaches `fs` lazily through
`ueStaticCheckers`, so it never pulls `node:fs` into a client chunk.

| Game | Returns |
|------|---------|
| `pof` | `resolveUeRoot()`, the existing chain: `POF_UE_ROOT`, else the default PoF UE project. |
| engine `undecided` | `null` |
| engine `godot` (gtai, locked 2026-11-02) | `null`; a godot game's L2 reads its own repo through `gameRootFor` instead (next section), and `unboundReason` names the runtime tiers that still have no Godot adapter |
| `ue5` with `root: null` (other than pof) | `null` |
| `ue5` with a root | that root if it exists on disk, else `null` |

A `null` root means **unbound**. A UE-dependent acceptance for that game's entity is `deferred` with
`unboundReason(id)` (`no engine project bound for game gtai`). It is never `fail`, and it is never
graded against PoF's UE root, because that would grade one game against another game's engine tree.

Wired seam: the L2 static sweep. `verifyStaticAll` takes an optional `entityGame` dep
(`entityGameFor` → `gameOfEntity` of the seeded/persisted entity). A pof row reads the sweep's one
`resolveUeRoot()` exactly as before. Any other UE game reads its own binding, resolved once per sweep, and
an unbound game short-circuits to `unboundStaticVerdict` without running a checker. A godot game never runs
the UE checkers; its L2 comes from evidence (next section). `staticVerdictFor`
(which the packaging sweep folds in) resolves the root the same way. Not yet game-aware: the packaging
sweep's own disk check (`packageArtifacts.ts`), the L3/L4 drain and `audio-import-preflight`. They
still read `resolveUeRoot()` directly.

## Engine evidence (Godot)

PoF's engine bridge is UE-only. For a game on Godot (gtai), the game writes its own run results as files
and PoF reads them: the `pof.godot-evidence/1` contract (spark `gtai-phase-2`, WP2). PoF never observes
the run, so every file is dated against the game repo's HEAD. Sources: `src/lib/games/gameRoot.ts`,
`src/lib/games/godot/evidenceTypes.ts`, `src/lib/games/godot/readEvidence.ts`, the godot branch of
`staticVerify.ts`, `src/lib/harness/godot-gates.ts`.

**Game root** (`gameRootFor(id)`, server-only). `POF_GAME_ROOT_<ID>` (id uppercased, `-` → `_`) wins when
set, and is authoritative: a set value that is not on disk resolves to `null` rather than falling back,
so a typo never grades a different checkout. Otherwise a godot game's `engine.root` (gtai: `'../gtai'`) is
resolved against the PoF repo root (`POF_GAMES_ROOT`, else `cwd`). Neither on disk → `null` = unbound, and
the L2 verdict defers with `noGameRootReason(id)` ("no game root for gtai (Godot 4.7.2): ..."). The Game
home's engine fact still reads `adapter-missing` (it is a pure view and cannot see the disk).

**Location.** `<gameRoot>/build/evidence/<kind>.json`; frames in `<gameRoot>/build/evidence/frames/`.
`build/` is git-ignored in the game repo.

**Envelope.**

| Field | Type |
|-------|------|
| `schema` | `'pof.godot-evidence/1'` |
| `kind` | `'lint' \| 'unit-tests' \| 'scenario-tests' \| 'parity' \| 'selftest' \| 'bench' \| 'export-audit' \| 'achievements'` |
| `gameId` | the registry id (`'gtai'`) |
| `commit` | full SHA of the game repo HEAD at run time |
| `builtAt` | ISO timestamp |
| `godotVersion` | string |
| `status` | `'pass' \| 'fail'` |
| `summary` | string |
| `counts?` | `{ passed, failed, skipped }` numbers |
| `metrics?` | `Record<string, number>`; bench keys `p99CpuMs`, `low1Fps`, `worstSwapMs`, `worstFrameMs` |
| `artifacts?` | paths relative to the evidence dir |

Optional keys are omitted, never `null`; a `null` optional key is a malformed envelope.

**Verdict** (`readGodotEvidence(root, kind)`; the first matching row wins):

| Condition | Verdict |
|-----------|---------|
| file absent | `deferred`: "no evidence yet" |
| unparseable; schema, kind or gameId mismatch; a required field missing; an optional key `null` | `fail` |
| the game HEAD cannot be read (`git -C <root> rev-parse HEAD` failed) | `deferred`, the reason says so |
| `commit` ≠ the game HEAD | `deferred`: "stale: evidence from <sha7>, HEAD <sha7>" |
| `status: 'fail'` | `fail` |
| otherwise | `pass` |

**L2 for a godot game.** `staticVerdictForGame` reads the `lint` and `unit-tests` evidence for any step
that declares static checks: both pass → `pass`; either fails → `fail`; otherwise `deferred`, the reason
naming each kind that is not a pass (`lint: no evidence yet; unit-tests: ...`). A sweep resolves the root
once per game and reads each kind once. `contractsCheckers.ts` (the contracts `In-game` step's selftest
file evidence) is a separate reader and is unchanged.

**Harness gates.** `VerificationGate.type` gains `'godot-test'` (judged by `unit-tests` evidence) and
`'godot-export'` (judged by `export-audit` evidence), with the gate fields `game` and `script`
(`createGodotGate(type, game, { script | command })`). `verify()` runs `"<POF_GODOT_BIN>" --headless --path
"<root>" -s <script>` (or the gate's `command`) in the game root, then reads the evidence file:

| Outcome | Gate result |
|---------|-------------|
| no `POF_GODOT_BIN`, no `game`, no game root, or neither command nor script | `unverifiable` (nothing runs) |
| evidence `fail` (including malformed) | fail |
| evidence `pass`, `builtAt` not before the run start, exit 0 | pass |
| evidence absent, stale or HEAD unknown; pass but older than the run; pass with a non-zero exit | `unverifiable` |

`checkSuccessReachable` treats a required godot gate that cannot plan as blocking, and the change router
answers from `RouterEnv.hasGodotEnv`. A godot gate judges the game repo, which no change class covers, so
it never covers a PoF path class.

**Environment.** `POF_GODOT_BIN` (the Godot executable) and `POF_GAME_ROOT_<ID>` (the game root override).

**Build health** (ticket F-10). `GET /api/games/[gameId]/build-health` reads every evidence kind through
`readGodotEvidence` (`buildHealthFor`, `src/lib/games/godot/buildHealth.ts`, server-only); the wire shape and
the pure helpers are in `buildHealthTypes.ts`, which a client may import. The HEAD is read once per request and
handed to every kind. Payload `BuildHealth`: `{ gameId, engine, binding: 'bound' | 'unbound', reason?, root,
head, readAt, rows, aggregate }`. Each row is `{ kind, status, state, detail, reason?, builtAt?, commit?,
godotVersion?, counts?, metrics? }`, where `state` names the deferral: `absent` (no file), `stale` (reason
`stale: …`) or `deferred` (HEAD unknown). `aggregate` is `{ status, total, pass, fail, stale, absent, deferred }`:
any fail → `fail`; every kind passing → `pass`; otherwise `deferred`. A game that is not on Godot, or whose root
is not on disk, is `binding: 'unbound'` with the reason (`noGameRootReason`), a 200 and not an error; an
unknown game id is a 404. Ages are `readAt - builtAt`, so the client never reads a clock. `benchReadings`
judges the bench `metrics` against the STANDARDS §20 hard limits (`p99CpuMs` ≤ 7, `low1Fps` > 45,
`worstSwapMs` ≤ 50; `worstFrameMs` is recorded with no hard limit); a missing key reads `missing`, never 0.
The Game home renders it as the "Build health" panel (`layout-lab/game/gameHomeBuildHealth.tsx`, read hook
`gameHomeBuildHealthData.ts`): one row per kind with a `StatusTag` (pass / fail / stale / absent / deferred),
the detail, the age and the commit, then the bench block. It reads only the API; it never imports `fs`.

## Lanes control room (GTAI day/night runners)

The Game home shows the lane runners that build the game (spark `gtai-control-room`, 2026-11-03): every
`games/gtai/night/night.mjs --root R` root, each lane in it, read-only. Sources: `src/lib/games/runners/`
(`runnerTypes.ts` wire shape, client-safe; `readRunners.ts`, `laneState.ts`, `frames.ts`, `runnersConfig.ts`),
the routes `src/app/api/games/[gameId]/lanes/` (`route.ts`, `frame/route.ts`), the panel
`layout-lab/game/gameHomeLanes*.tsx`, `gameHomeLaneCard.tsx`, `gameHomeLaneDetail.tsx`. Tests:
`src/__tests__/games/runners/`, `src/__tests__/components/layout-lab/gameHomeLanes.test.tsx`.

- **Config, not constants.** `GameDef.runners = { roots, masters }` (GTAI: `../gtai-night`, `../gtai-night-noir`,
  `../gtai-day-d5`, `../gtai-day-pof`; masters `../gtai-masters`), relative to the PoF repo root
  (`POF_GAMES_ROOT`, else cwd). Env overrides: `POF_GAME_RUNNER_ROOTS_<ID>` (`;`-separated) and
  `POF_GAME_MASTERS_<ID>`. A game with no `runners` answers `configured: false` with the reason.
- **Reader** (`readLanesBoard`, `readRunnerRoot`). Reuses the runner's own pure code (`parseConfig`, `planTimes`,
  `phaseAt` from `games/gtai/night/lib.mjs`, imported as `@/../games/gtai/night/lib.mjs`) and never shells out to
  `night.mjs`. Reads `night.json`, the schedule from the root's `launch.cmd` (`--until/--freeze/--report-at`, else the
  runner defaults, labelled), `logs/<lane>/state.json` (iterations, cost, API-key cost, `reportedFor`), `billing.json`,
  the lane worktree's `JOURNAL.md` last line, `REPORT.md` (a 6000-character excerpt), `git log -1` + branch (the only
  subprocess, 4 s ceiling), and whether `build/evidence/` exists. Nothing is written in any root. A missing root, an
  invalid `night.json` or a lane with no state is an honest row with its reason.
- **State** (`LaneState`, `deriveLaneState`): `done` (reported for this or the previous deadline) > `running` (a
  session log was written in the last 300 s) > `blocked` (every billing path blocked, or the last session hit a
  usage limit) > `pending` (no session yet, or the worktree is missing) > `report` / `freeze` / `building` by the
  runner clock. `planTimes` aims at the NEXT deadline, so a root whose lanes reported for the previous one shows
  that finished cycle (REPORT), not tomorrow's BUILD. A lane not live for 2 h in BUILD says the runner may be down. While a session writes, the card shows its number (`liveSession`, from the newest `iter-NNN.jsonl`), because `state.json` lags one session behind. The commit line also says how many commits the lane made since its first session log appeared (`runStart` = that log's creation time, `commitsThisRun` = `git log --since`): `0` reads "no commit of its own yet (tip is the base)" because a freshly cut branch shows its base commit as its tip, which is not the lane's work; unknown (no log or git failed) shows nothing rather than a 0. The session line also says how many sessions failed (`failedSessions`: a non-zero exit or a usage limit; a session stopped at its cap or with an unknown exit code is not counted), so a 3-second crash does not read as a plain "session done".
- **Frames.** `<masters>/<group>/<lane>/frames.json` (an array, or `{ frames }`) of `{ file, title, source?, note?,
  before? }`. `GET /api/games/<id>/lanes/frame?lane=&file=` serves a file ONLY when that lane's frames.json names it
  (as `file` or `before`), as a plain relative path with an image extension, whose real path stays inside the lane
  folder (a symlink out is refused). Lane ids are `[a-z0-9-]+`. Anything else is 400/404 in the envelope.
- **Wire.** `GET /api/games/<id>/lanes` → `LanesBoard { gameId, readAt, configured, reason?, masters?, roots[] }`;
  a root is `{ root, name, ok, error?, schedule?, phase?, billing?, lanes[] }`; ages are `readAt - t`, so the client
  never reads a clock. A cost of 0 with no session reads "no sessions yet", never "free".
- **UI.** `GameHomeLanes` polls with `useSuspendableEffect` every `UI_TIMEOUTS.lanesPoll` (45 s); a failed poll
  keeps the last board and says it is stale. A lane card is a button (`StatusTag` for the state: glyph + word); the
  selected lane's detail is a `DataTable`, the REPORT.md in a `<details>`, and the frame thumbnails.
- **Lane build evidence.** `GET /api/games/<id>/build-health?lane=<id>` reads that lane worktree's
  `build/evidence/` through the same `buildHealthFor` (`BuildHealth.lane` names it). The lane is resolved through the
  configured roots (`laneCwd`), never a path from the query; an unknown lane or a missing worktree is a 404. The lane
  detail's "Show this lane's build evidence" switches the Build health panel; "Back to the game root" returns.

## The authored-provenance door

`EntityProvenance = IngestProvenance | AuthoredProvenance`. An authored entity has no source row to cite,
but it still has to say which canon profile its prompts are written for:

```ts
{ kind: 'authored'; canonProfile: string; authoredVia: 'intake' | 'user' | 'one-shot'; authoredAt: string }
```

`POST /api/catalog-entities` accepts an optional `provenance`:

- Only `kind: 'authored'` is accepted. `canonProfile` must be a registered `CANON_PROFILES` id;
  otherwise the response is 400 and names the registered profiles. `authoredVia` must be one of the
  three doors. `authoredAt` defaults to now.
- `kind: 'ingest'` is refused with 400. Ingested rows come through `src/lib/catalog/ingest/`.
- The provenance is stored inside the entity JSON, so `GET ?all=1` returns it and `canonProfileOf()` /
  `gameOfEntity()` read it.
- A re-POST **without** `provenance` keeps the stored one. An edit from a client that does not know
  about games must not silently move the entity back to PoF's world.

## Canon inheritance

A game's canon profile (`gtai`) starts with an empty seed. Its rules arrive through the pitch intake and
live versioned in `games/gtai/canon.json`. `CANON_PROFILES.gtai.inheritsPof` adopts, by id, only PoF
`project`-category **engineering** conventions: asset naming, source of truth, cross-catalog links, the
quality bar, HUD binding, quest-reward binding, input remap and accessibility, tutorial telemetry, the
wiring contract, screen-flow navigation, FSM tag wiring and music loudness. It adopts no design, world,
art or balance law. Rules that bind to PoF's ARPG runtime classes (`char-config-not-cpp`,
`save-discrete-only`, …) wait until GTAI has an engine project.

## Adding a game

1. Add the id to `GameId` and `GAME_IDS` (`src/lib/games/types.ts`).
2. Register its canon profile in `CANON_PROFILES` (`canon/profiles.ts`), with an empty `seed` and an
   explicit `inheritsPof` list of engineering-convention ids.
3. Write `src/lib/games/<id>.ts` with a `GameDef`. Classify every registered pipeline as reuse, reskin
   or planned, or put it in an exported omitted list with its reason. Set `engine` to `undecided` until
   an engine project exists.
4. Add it to `GAMES` in `registry.ts`. Add a manifest coverage test in the style of
   `gtaiManifest.test.ts`.
5. Create `games/<id>/README.md` (the versioned design truth: pitch, canon, entities).
6. When the engine project exists, set `engine: { kind: 'ue5', root }`. Acceptance then reads that root,
   and `ueRootForGame` returns it while it exists on disk. For a Godot game, set
   `engine: { kind: 'godot', version, root }` and have the game write `pof.godot-evidence/1` files
   (see "Engine evidence (Godot)").

## Active game in the UI

**Choosing it.** `useActiveGameStore` (`src/stores/activeGameStore.ts`, persist key `pof-active-game`,
state `{ gameId, showAllPipelines }`) remembers the last choice. The URL `g` param wins on arrival
(`/?g=gtai…`, `/status?g=gtai`); an absent or unregistered `g` falls back to the store, and an invalid one
is rewritten to it. A switch rewrites `g` with `replaceState` (never a push), keeping every other param, and
a pof address with no `g` stays param-less. `useActiveGameUrlSync()` is mounted once per surface (LayoutLab,
StatusDashboard); reads go through `useActiveGame()`, which serves the default game until hydration so SSR
and the first client render agree. `GameSelector` (`layout-lab/GameSelector.tsx`) is the header control in
both places: a labelled native `<select>` of `GAMES` titles plus the lab `Button` toggle "All pipelines"
(shown only for a game whose manifest is not `'all'`).

**Scoping.** One pure module, `src/lib/games/scope.ts`, holds every rule:
- `scopeCatalogIds(gameId, registered, showAll)`: in-manifest catalogs in `registered` order, plus
  off-manifest ones under showAll (flagged in `offManifest`). For `manifest: 'all'` it returns `registered` unchanged.
- `entityInGame` / `gameOfEntitySafe`: the derived game; an entity whose profile maps to no game is in no
  game (never silently PoF, and never a render-time throw).
- `rowsInGame`: an artifact inherits its entity's game. A row whose entity the client does not know reads as PoF.
- `statusEntitiesForGame`: PoF keeps exactly the seed map /status always graded; another game uses its seeds
  plus persisted rows.
Applied in `useLabCatalogData` (tree + Matrix groups; off-manifest rows carry `notInGame` and render greyed
"not in <title>"), `useLabDetail` (seeded and draft entities), `LabSearch`, `useGlobalCoach`, and on /status in
`useStatusArtifacts` (unscoped read = the game's pipelines; every read filtered to the game's rows) plus
`useStatusCatalogIds` and `useStatusEntities` (Category picker, Category/Item Focus entity sets, EntitySearch).
/status now runs `usePersistedEntityHydration` so a non-PoF entity's provenance is known there.

**Location.** `resolveCatalogForGame` (`labLocation.ts`) derives a catalog the game does not show to the
game's first one in render, never written back, the way a phantom entity resolves. `useLabRouteSync` takes
a `scope` (the game id): a move in the same commit as a game switch replaces the history entry instead of pushing one.
An empty manifest renders "No pipelines in <title>'s manifest yet" in the lab (Catalogs/Matrix) and on /status.

**Game view.** A fourth lab view, `v=game` (`LabView` gains `'game'`), at `layout-lab/game/`:
`gameHome.tsx` (facts strip), `gameHomePipelines.tsx` (`DataTable` rows), `gameHomeData.ts` (reads),
`gameHomeBuildHealth.tsx` (the build-health panel, see "Engine evidence (Godot)"), `gameHomeLanes.tsx` (the lanes control room, next section).
Rows are the manifest's built pipelines, then the planned ones. Coverage ("n / expected", or "n · no target
declared") and readiness are separate columns. Readiness is the best reached rung from the /status model
(`buildSwimlane` → `readinessOf`) over the game's rows, or "unmeasured", never R0. Planned rows read
"not built". The strip shows the canon rule count (union of `rulesForProfile` over the game's profiles), the
pending intake (`GET /api/games/<id>/intake`, or "intake unavailable (<reason>)" with retry), the engine
(`engineStateOf`: undecided / unbound / bound root / pof's server-side project default / adapter-missing for a locked non-UE engine), and declared
coverage as a `MeterBar`, shown only when some row declares a target.

## Pitch intake

A model reads `games/<id>/pitch.md` and splits it into **proposals**: scoped canon rules and starter
entities. Nothing reaches the canon or the catalogs until the operator accepts a proposal.

- **Prompt** (`src/lib/games/intake/prompt.ts`, pure). `buildIntakePrompt` names the game's authoring
  profile, the `<gameId>-` id prefix, and the usable catalogs (manifest ∩ registered). Planned pipelines
  are listed apart, marked "propose NO entities". The prompt ends in one `@@CALLBACK` block addressed to
  `POST /api/games/<id>/intake`; `runId` is merged in as a static field.
- **Parser** (`intake/parse.ts`, pure). `parseIntakeCallback` refuses the **whole** body on the first
  bad proposal, and the reason names that proposal. It refuses: a rule whose profile is not the
  authoring profile (an absent profile reads as `pof`), a scope outside the manifest, an entity id without
  the game prefix, an entity in a catalog outside the manifest, duplicate ids, and more than 200 proposals.
- **Queue** (`src/lib/game-intake-db.ts`, table `game_intake_proposals`). A stored id is
  `<runId>:<proposal id>`, so two runs never collide. Re-posting a run keeps the decisions already made.
- **Routes.** `GET/POST/PATCH /api/games/[gameId]/intake` lists proposals, takes the callback and
  records accept/reject. `POST …/intake/run` dispatches the server-side CLI session (the one-shot seam)
  and stores the reply through the same parser. It refuses a placeholder pitch with 409 before any model
  is spent. POST and PATCH are operator-guarded. PoF has no `designDir`, so its intake answers 409.
- **Accept** re-validates against the manifest **as it is now**. It refuses a rule id that another
  profile already owns, and an entity id that is a code seed. Then it writes the versioned file first
  (`canon.json` or `entities.json`) and the DB second. An accepted entity carries
  `{ kind: 'authored', authoredVia: 'intake' }` provenance. **Reject** records the decision and writes
  nothing else.
- **Versioned truth** (`intake/files.ts`). Files are written atomically (temp file + rename), sorted by
  key, as two-space JSON with a trailing newline, so the git diff of an accept is exactly the accepted
  record. A file that cannot be read is never rewritten. The DB mirrors the files: `project-rules-db` and
  `catalog-db` re-insert missing rows (INSERT OR IGNORE) on the first read of a process, and
  `syncGameDesign(gameId)` is the explicit trigger for the same re-insert. An operator's DB edit stands
  until the file changes.
- **Tests.** The games root is `POF_GAMES_ROOT || cwd`. A write under vitest without that override
  throws, so a test cannot touch the real `games/` folder.
- **Review panel** (`layout-lab/canon/canonIntakePanel.tsx`, shown in CanonView for a game that has a
  design dir). It groups proposals by kind and shows each one with its pitch quote and payload
  (`DataTable`). It has accept/reject buttons and a confirmed "Accept all rules" (`ConfirmDialog`). Run is
  disabled, with the reason shown, while the pitch is a placeholder.

## Quest loop (GTAI)

`/gta --quest` takes one GTAI quest from brief to playable (spark `gta-quest-loop`). The wire contract is
`src/lib/games/gtai-quest/types.ts`; read its absent-value header first.

- **Flow.** A council of two seats (Claude, Grok) writes 2 variants each (`gtai.questProposal/1`): A in the
  act's expected tone, B a deliberate swerve. PoF's guards pre-score all 4 paths. The owner fuses them in an
  HTML artifact. The Director writes the package (`games/gtai/quests/<id>/quest.json`, `gtai.quest/1`), the
  guards re-score it, and a Godot runtime plays it. A red guard blocks unless the package carries an
  override for that guard with a non-blank reason (`assessQuest` in `assess.ts`).
- **Campaign baseline** (`campaignBaseline.ts`). Pitch §2-4 as data: `GTAI_CAST` (the fourth soul is the
  placeholder `soul-4`, never a named soul), `GTAI_ARC` (owner beats per act, `[owner]` or `[proposal]`),
  and the campaign variables with their owning writer beats. `soul4_identity`, `betrayer` and
  `act_antagonist_order` are protected open canon: declared with an **empty `writers`** list (the structural
  validator accepts it), so no quest may write them.
- **Story guard** (`storyGuard.ts`). `buildCampaignGraph(ledger)` emits `pof.storygraph/1` (project `gtai`,
  graph `gtai-campaign`): an entry, one `container` per act, the owner beats, then each ledger quest as a
  `contract` container (realises `contracts/<id>`), ordered by act, then id, with a same-act reader placed
  after the quest whose `q_` variable it reads. A quest's writes ride its outgoing edge; its reads guard its
  own entry edge. The empty-ledger baseline validates with zero errors (7 `VAR_SINGLETON` warns: each arc
  flag is written once and read by no baseline node). `assessStory` codes: `PROTECTED_VAR_WRITE`,
  `ARC_VAR_NOT_OWNED`, `UNKNOWN_VAR` (quests may only add `q_*` variables), `READS_FUTURE_STATE`,
  `UNKNOWN_EXISTING_CHARACTER`, `NEW_CHARACTER_COLLIDES`, `NEW_CHARACTER_NO_DESIGN` (warn), plus
  `GRAPH_<code>` for every error the validator raises with the design merged in that it did not raise
  without it. A graph finding on a variable a direct code already flagged is not repeated.
- **Economy guard** (`economyGuard.ts`) against `games/gtai/balance/quest-economy.json` (provisional; the
  basis names the revision). Codes: `CASH_OUT_OF_BAND` (warn within 25% of the bound crossed, error beyond),
  `HEAT_OVER_CEILING`, `ENEMIES_OVER_BUDGET`, `WAVES_OVER_BUDGET`, `TIMER_NOT_ALLOWED`, `NO_FAIL_STATE`,
  `SOUL_UNLOCK_WRONG_ACT` (errors), `MINUTES_OUT_OF_BAND` (warn), and `CASH_VS_SOUL_UPGRADE` (info: the cash
  as a fraction of the cheapest soul-upgrade tier, the sink context).
- **Line guard** (`lineGuard.ts`). Structural, always measured: `LINE_NO_PURPOSE`, `LINE_UNKNOWN_SPEAKER`
  (a quest character, `rivet`, or a soul voice from its own act on), `BEAT_UNKNOWN_LINE`, `DUPLICATE_LINE_ID`,
  `LINE_REUSED_FROM_LEDGER`, `TOO_FEW_LINES` (< 6), `NO_VOICE_BIBLE` (error for existing, warn for new
  speakers), `LINE_UNUSED` (warn) and `EDITORIAL_TELL` (warn). The tell patterns are **editorial**: nobody
  measured them against human dialogue, so every such message starts `editorial (unmeasured):`. With a
  cross-family judge report: `JUDGE_SAME_FAMILY`, `LINE_NOT_EARNED` (earned < 3), `VOICE_DRIFT` (warn),
  `LINE_UNJUDGED` (warn). The basis says `structural + judge(<seat>)` or `structural only; judge unmeasured`.
- **Uniqueness** (`uniqueness.ts`) against every other ledger quest: `DUPLICATE_SHAPE` (giver, verb and new
  mechanic equal; `null` equals `null`), `DUPLICATE_TITLE`, `NEAR_DUPLICATE` and `MECHANIC_NOT_NEW` (warns).
- **Vocabulary guard** (`vocabGuard.ts`, `questRules.ts`; the fifth guard, id `vocabulary`). The council's contract
  allows free verbs, bark tags and fail words; the Godot runtime plays only what the game repo's
  `project/data/tables/quest_rules.json` (`gtai.quest-rules/2`) declares. `ctx.rules` (`QuestRules`) is that table,
  read by `loadQuestRules(gameRoot)` from `gameRootFor('gtai')` (`POF_GAME_ROOT_GTAI` first, then `engine.root`),
  or passed explicitly to `loadQuestContext(root, judge, gameRoot)`. Codes (errors): `VOCAB_UNKNOWN_VERB`,
  `VOCAB_MISSING_TARGET` / `VOCAB_MISSING_LOCATION` (the verb row needs one), `VOCAB_UNKNOWN_EVENT_TAG` (a bare `when`
  tag that is neither an `event_tags` id nor `quest:<verb>_done`), `VOCAB_UNKNOWN_CONDITION` (kind not declared),
  `VOCAB_UNKNOWN_CONDITION_VALUE` (value outside `values` / `pattern`); warn: `VOCAB_FAIL_STATE_UNDETECTABLE` (no
  `fail_rules` row matches the phrase, whole words, first full-group match wins). Each finding names the offending
  verb or tag and its beat or line. Places (`questPlaces.ts`): when the game has staged this quest's places table (`project/data/tables/<quest_id_with_underscores>_places.json`, `gtai.questMarkers/1`, loaded by `loadQuestPlaces` into `ctx.places` by quest id), a beat's `location` must be a marker (`VOCAB_UNKNOWN_PLACE`), a vehicle-verb target (`enter_vehicle` handler) a vehicle and any other targeted verb's target an actor (`VOCAB_UNKNOWN_TARGET`), and an encounter verb's location a marker that holds an encounter (`VOCAB_NO_ENCOUNTER`), the same three rules as the runtime's `quest_beat_validator.gd`. A quest with no staged table yet (the world stages it after design) is not place-checked, and the verdict `basis` says so. No table
  readable => `unmeasured`. The guard is in `NON_OVERRIDABLE_GUARDS`: an owner override cannot waive it, because the
  runtime refuses the package at load regardless. It reaches the `contracts` pipeline's Guards step through
  `assessQuest` (blocked => fail naming `vocabulary:<CODE>`, unmeasured => pending). CLI: `council.mjs check <questDir>
  [--game-root <repo>] [--allow-unmeasured]` exits 1 when blocked and 3 when the vocabulary was unmeasured.
- **Autosave guard** (`autosaveGuard.ts`; the sixth guard, id `autosave`). Owner 2026-11-03: each quest design carries
  its autosave points. `QuestDesign.autosavePoints?: AutosavePoint[]` is `{ id, beat, at: 'start' | 'end', why }`; the
  game's save engine (rtai `d-save`) reads the field as written, and the quest's end is always an autosave, declared or
  not. Pure, needs no table. Errors, each naming the point id (or `#<index>`): `AUTOSAVE_MISSING` (absent or empty;
  a warn for a package whose `provenance.fusedAt` precedes `AUTOSAVE_REQUIRED_FROM` = 2026-11-04, error for every
  proposal and later package), `AUTOSAVE_BAD_SHAPE`, `AUTOSAVE_DUPLICATE_ID`, `AUTOSAVE_UNKNOWN_BEAT` (not in `beats[]`),
  `AUTOSAVE_BAD_AT`, `AUTOSAVE_EMPTY_WHY`. `assessQuest(..., designedAt)` takes the date; it is in
  `NON_OVERRIDABLE_GUARDS`. The council asks for the field in `brief.template.md`, `proposal.schema.json` (required,
  at least one point) and `validateDelivery` (unknown beat, duplicate id: the seat repairs before the guards run);
  `council.mjs check` prints each failing point. The `contracts` Plan step shows the point count
  (`PlanFacts.autosavePoints`). `collect-call` declares `as-b2-payphone` .. `as-b6-hot-walk`, each at `start`.
- **Unmeasured.** A guard that lacks its input reports `unmeasured`. It never blocks and never passes. Today
  that is the economy guard with no table. A missing judge does not make the line guard unmeasured: it stays
  green or red on the structural checks, and its basis says the judge did not run.
- **Loaders** (`loadContext.ts`, plain node fs, also under `npx tsx`; not in the barrel). `loadLedger` reads
  every `quests/<id>/quest.json` whose folder does not start with `_`, and logs and skips one that does not
  parse. `loadQuestContext` adds the economy table (`null` when missing), the voice bibles (basenames of
  `voices/*.md`) and the cast (`GTAI_CAST` plus every ledger package's characters). `loadProposals(runDir)`
  reads `proposals.{claude,grok}.json`; a missing file means that seat produced nothing.
- **Story map** (ticket F-11). `GET /api/games/gtai/story` (GTAI-only; any other game is a 404) loads the
  ledger (`loadLedger` over `POF_GAMES_ROOT`, else `cwd`) and returns `campaignMapOf(ledger, notLoaded)`
  (`src/lib/games/story/campaignMap.ts`, pure) plus `hash` (`storyContentHash`) and `source`:
  `{ gameId, graph, acts, contractCount, notLoaded, protectedVars, protectedBeats, findings: { errors,
  warnings, codes }, hash, source }`. Each act is `{ act, title, beats, quests }`; a beat is `open`, `locked`
  (`OPEN_CANON_BEATS`: the betrayal and soul 4, with the reason) or `claimed` (`claimedBy`), read back from the
  graph (a claimed beat leaves the node chain and its variable's writer becomes the quest node). A quest is
  `{ id, title, act, status, logline, claimsBeat?, placedOn }`; `placedOn: null` means it sits in its act
  (it claims no beat, or its claim was refused). `notLoaded` lists quest folders whose `quest.json` is missing
  or not `gtai.quest/1`. `/story` with GTAI active (`?g=gtai`, or the remembered game) renders it
  (`components/story/GtaiCampaignMap.tsx`): one column per act above the Orrery. With no packages it shows
  the skeleton and "no contracts yet". The graph is derived on every read and is NOT imported into
  `story_graphs`, so the Walk control does not apply to it; other games keep the stored-graph view.
- **Tests:** `src/__tests__/games/gtai-quest/` (one clean act1 fixture, one mutation per code; loaders run
  against `os.tmpdir()`).

## Voice room (GTAI)

Quest lines become recorded voice here, human gated (lane pof-voice, 2026-11-03). Quest mode keeps writing
example lines with `audio: null`; the Voice room proves them, line by line, in chronological play order.

- **Objects** (`src/lib/voice/`, tables created by `getVoiceDb()` on the shared connection):
  - `voice_voices`: a voice per character. The provider voice id, `source` (`designed` from a text description,
    or `stock`), the design prompt, the preview takes, and `status` (`candidate | cast`, one cast per character).
  - `voice_lines`: the line queue, a mirror of every ledger quest's `lines[]`. **Re-synced from the quest package
    on every read** (`syncQueue`); the package is the source of truth for the text. Play order is the act, then
    `provenance.fusedAt`, then the id; inside a quest, the order of `lines[]`. A line gone from its package
    leaves the queue but keeps its takes. Each line also carries its **class** and **scene**, re-read with the
    text: `bark` when the package gives it `when` tags (the quest schema's own definition: condition tags for
    barks), else `story`; the scene is the first beat whose `lineIds` lists it (title + summary). The room and
    `voice.mjs line` show both, because a direction is written for a scene, and a bark is judged for repeat play.
  - `voice_takes`: per line, each take with its delivery direction (the words used), the text actually sent,
    the settings (model, stability, similarity, style, speed), the file, duration and loudness (ffprobe /
    ffmpeg `ebur128`; `null` = unmeasured), the longest internal pause (`silencedetect`; over 1.5 s the room flags a
    possible dropout), the **read-back** (`readbackText` + `readbackWer`: what a local Whisper heard and its word
    error rate against the line, digits read as number words; over 15 % the room flags "listen for garbled
    words"; an ear proxy for the words only, never the acting), and the billed characters. A take either screen
    flags (read-back or long pause) counts in its queue row (`flagged`) and in the status (`flaggedLines`), so
    the room and `voice.mjs status` point the owner at where to listen first. `voice_verdicts` is
    the verdict history.
- **States:** `no-takes`, `awaiting-verdict`, `all-rejected`, `proven`. A line is proven only by an approved take
  on its current text (a take carries the hash of the text it spoke, so a package edit makes it stale). At most
  one approved take per line: approving another marks the previous one `superseded`, history kept. Once the speaker has a cast
  voice, only takes in that voice count: casting a different voice un-proves the character's lines (a re-cast
  event, registry `game-dialogue-voice-pipeline`); approving a take outside the cast voice is refused 409.
- **Provider** (`src/lib/audio-gen/providers/elevenlabs-speech.ts`, the `tts` kind): `/v1/text-to-speech/{voice_id}`
  with `eleven_v3` by default, where the direction becomes inline audio tags (`[whispers] [panicking] …`); on
  `eleven_multilingual_v2` the direction is recorded but not sent (tags would be spoken). Voice design is
  `/v1/text-to-voice/design` from the character's voice bible (`games/gtai/voices/<id>.md`), then
  `/v1/text-to-voice` creates the chosen preview on first use. Never a clone; the description carries an
  "original voice" clause. The Sound Forge still refuses `tts` (it has no voice picker) and says so.
- **The human gate** (`src/lib/voice/gate.ts`): `takes/verdict` and `voices/cast` require a browser fetch
  (`Sec-Fetch-Site: same-origin`) carrying the page token from `GET voice/gate`, which is minted only for a
  browser fetch and signed with a per-process secret (10 minutes). The CLI and agent tools are refused 403
  (`src/__tests__/api/voice-gate.test.ts`). The limit is written down: a local process that forges browser
  headers passes; the gate stops accidents and the agent path, not an adversary. In the page, **Approve unlocks
  only after the take has been played through** (80 %, `voiceAudio.tsx` `HEARD_FRACTION`): a UI guard against
  approving unheard audio (registry `hitl-approval`, rubber-stamping), not part of the server gate; Reject stays open.
  Cast works the same way for a voice with a preview (a stock voice has none and is judged by its takes).
- **Routes** (`/api/games/gtai/voice`): `GET` (room state; `?view=status`; `?view=verdicts&since=<ms>`, the owner's
  verdicts and notes with each take's line and direction, read-only), `lines` (one line + bible + takes),
  `takes` (generate k; the new takes are then read back in the background by `scripts/voice/readback.py`, one
  Python process per batch, offline HF cache, off under `NODE_ENV=test` and with `POF_VOICE_READBACK=0`),
  `readback` (backfill: re-score stored transcripts, then read back takes not heard yet), `takes/verdict` (gated), `voices` (list, design, stock candidate), `voices/cast`
  (gated), `gate`, `audio?takeId|voiceId`, `export`.
- **Export** (`exportQuest`): only proven lines, mp3 to mastered Ogg Vorbis (ffmpeg; ElevenLabs has no ogg output) at
  `<gameRoot>/project/assets/audio/voice/<quest>/<line>.ogg`, and the game's
  `project/quests/<quest>/quest.json` line gets `audio: "res://…ogg"` (a String: the game's `quest_voice.gd` plays
  `audio` only when it is a String) and `audioTake: { takeId, voiceId, model }` beside it. Unproven lines are not
  touched, so a temp voice the game's audio lane set stays until its line is proven here. A line an earlier
  export left in the game (`audioTake`) whose take is no longer proven (text edit, re-cast) is listed as
  `stale` in the report and left as is: what the game plays is the owner's call. The game root is
  `gameRootFor` (`POF_GAME_ROOT_GTAI` points tests at a fixture). Every written file is **mastered**
  (`mastering.ts`) the way the game's own processor (`tools/audio/process.py`) renders voice: mono, 44.1 kHz,
  `loudnorm` to the target the game declares in `project/data/tables/audio_mix.json` (`loudness.voice_lufs`,
  `voice_true_peak_db`; a game without a usable table gets -18 LUFS / -2 dBTP and the report names the
  fallback), Vorbis q4. It is measured after: the report carries `mastering` (target + source) and per line
  `lufs` / `onLevel` (within 1.5 LU). Provider takes arrive anywhere from -14 to -30 LUFS; unmastered, a
  whispered take would play about 12 LU under the mix the voice bus and duck were tuned for. The written file
  is a COPY of the room's as-game master of that take (below), so the game ships byte for byte what the owner
  heard when approving.
  A speaker the game hears through a device (Patch, the payphone router) gets its filter chain from the same
  table's optional `voice_treatments: { "<speaker>": "<ffmpeg chain>" }`, applied before loudnorm; only
  tone filters (`TREATMENT_FILTERS`: highpass, lowpass, bandpass, equalizer, acompressor, volume) are
  accepted, anything else is refused, named in the report, and that voice exports untreated.
- **UI:** `/layout?g=gtai&c=spellbook&v=game&room=voice` (`src/components/layout-lab/game/voice/`): Queue (grouped by quest,
  progress per quest, Export), Line (text, speaker, bible, takes as players, approve or reject with a note,
  generate k takes with a direction; "Next to judge" jumps to the next line whose takes wait for a verdict), Cast
  (voices with previews, cast, design from the bible). Players are native `<audio controls>` (`voiceAudio.tsx`); a
  source that fails to load says why instead of looking silent. A take plays **as the game plays it** by default
  (`audio?takeId=&as=game`, `asGame.ts`: the export master, rendered once per take and target into
  `<voiceDir>/as-game/`), so the owner judges the level and device filter the player hears and compares takes
  at matched loudness; a toggle plays the provider original, and a failed master falls back to it once, saying so.
  Cast previews play the same way (`audio?voiceId=&as=game`): design previews arrive up to ~9 LU apart, and a
  louder candidate otherwise wins the casting A/B on level alone. The queue and the open line re-read every
  `UI_TIMEOUTS.voiceRoomPoll` (5 s) while visible (`useSuspendableEffect`), so takes the CLI generates appear by themselves.
- **Headless:** `games/gtai/voice/voice.mjs` (`status`, `next`, `line`, `verdicts`, `readback`, `takes`, `design`, `stock`, `voices`,
  `export`; no approve, reject or cast), driven by `/gta --voice` (`.claude/skills/gta/SKILL.md`, Voice mode).
- **Tests:** `src/__tests__/lib/voice/` (fixture quests, ordering, re-read, line class + scene + column migration,
  supersede, design, export) and the
  gate refusal test above.

## Decisions room (GTAI)

The day lanes ask the owner design questions while the owner is at the machine; the owner answers here (lane
pof-arena, 2026-11-03). `?room=decisions` on the Game home, next to the Voice room. Sources:
`src/lib/games/decisions/` (`decisionTypes.ts` wire shape, client-safe; `decisionsConfig.ts`, `readDecisions.ts`,
`writeAnswer.ts`), routes `src/app/api/games/[gameId]/decisions/` (`route.ts`, `gate/route.ts`, `media/route.ts`), UI
`layout-lab/game/decisions/`. Tests: `src/__tests__/games/decisions/`, `src/__tests__/api/decisions-gate.test.ts`,
`src/__tests__/components/layout-lab/decisionsRoom.test.tsx`.

- **The two on-disk shapes belong to the lanes; nothing renames them.** Ask: `<root>/asks/<lane>-<n>.json` =
  `{ id, lane, question, options: [{ key, label, tradeoff, frames: [abs png/jpg/webp/gif/mp4/webm paths] }], default, asked }`.
  Answers: `<root>/answers.json` = `{ answers: [{ id, choice, note, at }] }`; the lanes re-read it about every 20 minutes.
- **Config, not constants.** `GameDef.decisions = { root }` (GTAI: `../gtai-eve/decisions`, relative to the PoF repo root:
  `POF_GAMES_ROOT`, else cwd); env override `POF_GAME_DECISIONS_<ID>`. A game with none answers `configured: false` with
  the reason. A PoF worktree is not a sibling of `gtai-eve`, so set the env var there.
- **Reader** (`readDecisionsBoard`). Open asks first, newest `asked` first (file mtime when `asked` does not parse), then
  answered ones, newest answer first. An ask that cannot be used (bad id, no question, no options, duplicate option key,
  duplicate id) is listed as a `problem` with its reason, never hidden and never repaired. A `default` that is not an option
  key is dropped. A listed frame that is missing, not a file or an unsupported type is shown as `unservable` with the reason.
- **Media door** (`GET .../decisions/media?ask=&opt=&n=`). The path comes from the ask file (option `opt`, entry `n`), never
  from the query, and only an existing media file is served; byte ranges are honoured (clips scrub). A listed `.txt`, a
  missing file, an unknown ask/option/index or a bad id is 400/404 in the envelope.
- **Writing an answer is a human action.** `POST .../decisions` `{ id, choice, note? }` uses the Voice room's gate
  (`@/lib/voice/gate`: a same-origin browser fetch plus the page token from `GET .../decisions/gate`); the CLI and the
  agents get 403. `choice` must be one of that ask's option keys; the note is capped at 2000 characters.
- **The write is safe with seven lanes reading** (`writeAnswer`): temp file in the same folder, then rename (retried on
  Windows); every earlier answer and unknown key is kept; one entry per ask id, so a lane taking the first match and one taking
  the last read the same thing; changing an answer replaces that id's entry and appends the replaced one to
  `answers.history.jsonl`; an unreadable `answers.json` is refused (409), never overwritten; ask files are never opened for
  write; writes are serialised in the process.
- **UI.** `DecisionsRoom` polls every `UI_TIMEOUTS.decisionsPoll` (10 s, `useSuspendableEffect`); a failed poll keeps the last
  board and says it is stale. A card shows the options side by side (label, trade-off, frames and clips, the lane's default
  tagged), a radio choice, a note, Save (disabled until an option is picked and the token has arrived). Draft state is
  per card, so a poll never wipes a note.

## Combat lab (GTAI)

Where the owner judges combat design (lane pof-arena, 2026-11-03): the weapon / enemy / power tables the combat lanes
write, a measured time-to-kill chart and the latest arena telemetry. `?room=combat` on the Game home. Sources:
`src/lib/games/combatLab/` (`combatTypes.ts` wire shape, client-safe; `parseTable.ts`, `parseSession.ts` pure;
`combatSources.ts`, `readCombatLab.ts` fs), route `src/app/api/games/[gameId]/combat-lab/route.ts`, UI
`layout-lab/game/combat/`. Tests: `src/__tests__/games/combatLab/`, `src/__tests__/api/combat-lab-route.test.ts`,
`src/__tests__/components/layout-lab/combatLabRoom.test.tsx`.

- **Config, not constants.** `GameDef.combatLab = { tables: { weapons, enemies, powers }, telemetryDirs, laneRoots }`
  (paths relative to a game root or a lane worktree; `laneRoots` are runner-root folder names, GTAI: `gtai-eve`, which is
  also in `runners.roots`). The tables are owned by three different lanes (`gunplay` -> `weapons.json`, `enemy-ai` ->
  `enemies.json`, `ghost-powers` -> `powers.json`), each on its own `e-*` branch tonight, on the game's main after the merge.
  `tables.melee` is optional (GTAI: `melee_weapons.json`, which `rivet-motion` may use instead of rows in the shared weapons
  table); a configured melee table that is absent reads "not written yet" like the others, an unconfigured one is not listed.
- **Sources** (`resolveSources`). `main` = `gameRootFor`; every lane worktree that exists in a `laneRoots` root. `?source=`
  is `auto` (default: the game root first, then each lane), `main`, or a lane id; anything else, including a path, is a 404.
  Per table the first source that has it wins and the response names it (`from`); telemetry is every source's sessions,
  newest first (8).
- **Engine `user://` folder** (`GameCombatLab.userData`, GTAI: `%APPDATA%/RTAI Uprising`, from the project's
  `custom_user_dir_name`). A run that logs to `user://` lands there whatever worktree it ran in, so it is a fifth source
  (`userdata`): telemetry only (its own `telemetryDirs`), never tables. Included only when the folder exists.
- **Schema-tolerant, because the lanes own the schemas.** A table is an array of records, a map of id to record, or an
  object holding one under a key (preferring the table's own name); nested records flatten one level; at most 14 columns
  and 200 rows, the rest counted, not hidden silently. A telemetry file is read by key name at any depth: `hit_rate`,
  `damage_taken`, `latency`, `dodge`, `knockdown`, `turn_rate`, and time to kill as `{ weapon: { range: s } }`,
  `{ weapon: { range: { mean } } }` or a record list. **The arena brief names no telemetry folder**, so `telemetryDirs`
  lists every plausible one; once the arena lane's worktree shows the real one, narrow the list.
- **Absent is never zero.** A table that is not there is `missing` with the paths looked in; one that cannot be read is
  `invalid` with the parse reason; a metric a session did not record reads "not recorded"; no session says where the file
  is expected, and no chart is drawn from the table or a guess.
- **UI.** `CombatLabRoom` polls every `UI_TIMEOUTS.combatLabPoll` (20 s, `useSuspendableEffect`), keeps the last read when a
  poll fails and says so. Time to kill by range is the shared `ChartPanel` bars (one row per weapon at a range, fastest at
  each range highlighted); tables and sessions are the shared `DataTable`.
- **Arena stations** (`GameCombatLab.stationsDir`, GTAI `project/data/tables/arena_stations`; `readStations.ts`). The arena
  lane's brief makes every lane plug in through one `arena_stations/<lane>.json` (id, name, area, spawn list, props, tuning
  keys, reported measurements). The room lists one row per file across the sources, counting by key name (`spawn*`, `prop*`,
  `tun*`/`expose*`, `measure*`/`report*`); a count the file lacks reads "not in file", an unparseable file is flagged, and no
  files says where they are expected. The wire field `stations` is optional so an older server still renders.
- **Lane-written JSON is read BOM/UTF-16 tolerant** (`src/lib/games/laneJson.ts`): asks, `answers.json`, tables, telemetry and station
  files all go through `readLaneJsonFile`, because a lane on Windows may save with PowerShell (UTF-8 BOM or UTF-16) and a bare
  `JSON.parse` would turn an ask into "unreadable" and `answers.json` into "unusable" (which also blocks the answer writer). What PoF
  writes back (`answers.json`) is always plain UTF-8.
