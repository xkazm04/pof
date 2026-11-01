# Game workspaces

PoF manages more than one game. A **game** is a code-registered workspace that owns canon profiles, a
pipeline manifest and an engine binding. PoF's own ARPG is game `pof`; **GTAI: Uprising** (a top-down
open-city crime sandbox) is game `gtai`, the first non-ARPG game. Introduced by spark
`gtai-uprising-project` (2026-11-01).

Sources of truth: `src/lib/games/` (`types.ts`, `registry.ts`, `pof.ts`, `gtai.ts`, `ueBinding.ts`),
`src/lib/catalog/canon/profiles.ts`, `src/app/api/catalog-entities/route.ts`,
`src/lib/catalog/acceptance/staticVerify.ts`. Tests: `src/__tests__/lib/games/`,
`src/__tests__/api/catalog-entities-provenance.test.ts`.

## What a game is

`GameDef` (`src/lib/games/types.ts`):

| Field | Meaning |
|-------|---------|
| `id` | A minted `GameId` (`'pof' \| 'gtai'`), never a display name, so identity survives a rename. |
| `title` | Display name. |
| `canonProfiles` | The canon profiles whose entities belong to this game. The **first** is the profile new entities are authored under (`authoringProfileOf`). |
| `manifest` | Which pipelines the game uses: `'all'` (PoF) or a list of `ManifestEntry`. |
| `engine` | `{ kind: 'ue5', root: string \| null }` or `{ kind: 'undecided' }`. |
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
| engine `undecided` (gtai today) | `null` |
| `ue5` with `root: null` (other than pof) | `null` |
| `ue5` with a root | that root if it exists on disk, else `null` |

A `null` root means **unbound**. A UE-dependent acceptance for that game's entity is `deferred` with
`unboundReason(id)` (`no engine project bound for game gtai`). It is never `fail`, and it is never
graded against PoF's UE root, because that would grade one game against another game's engine tree.

Wired seam: the L2 static sweep. `verifyStaticAll` takes an optional `entityGame` dep
(`entityGameFor` → `gameOfEntity` of the seeded/persisted entity). A pof row reads the sweep's one
`resolveUeRoot()` exactly as before. Any other game reads its own binding, resolved once per sweep, and
an unbound game short-circuits to `unboundStaticVerdict` without running a checker. `staticVerdictFor`
(which the packaging sweep folds in) resolves the root the same way. Not yet game-aware: the packaging
sweep's own disk check (`packageArtifacts.ts`), the L3/L4 drain and `audio-import-preflight`. They
still read `resolveUeRoot()` directly.

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
   and `ueRootForGame` returns it while it exists on disk.

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
`gameHome.tsx` (facts strip), `gameHomePipelines.tsx` (`DataTable` rows), `gameHomeData.ts` (reads).
Rows are the manifest's built pipelines, then the planned ones. Coverage ("n / expected", or "n · no target
declared") and readiness are separate columns. Readiness is the best reached rung from the /status model
(`buildSwimlane` → `readinessOf`) over the game's rows, or "unmeasured", never R0. Planned rows read
"not built". The strip shows the canon rule count (union of `rulesForProfile` over the game's profiles), the
pending intake (`GET /api/games/<id>/intake`, or "intake unavailable (<reason>)" with retry), the engine
(`engineStateOf`: undecided / unbound / bound root / pof's server-side project default), and declared
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
