# The `contracts` row (GTAI quests)

GTAI: Uprising's quests, one catalog row per quest. Built for the `/gta --quest` loop (spark `gta-quest-loop`, WP2). GTAI-native: the GTAI manifest lists it as `reuse` (`src/lib/games/gtai.ts`).

## Source of truth

The quest package folder is the truth. The catalog entity is a mirror of it.

```
games/gtai/quests/
  _council/<runId>/          council runs (BRIEF.md, seats.json, proposals.<seat>.json, verdicts.json, fuse.html) — never a quest
  <id>/quest.json            the package, schema gtai.quest/1 (src/lib/games/gtai-quest/types.ts)
  <id>/verdicts/lines.judge.json   the cross-family line judge (gtai.lineJudge/1, council.mjs judge)
  <id>/art/<characterId>*    art for each `new` character: a file, or a non-empty folder
  <id>/evidence/selftest.json + *.png   the Godot runtime's evidence ({ state, frame? })
```

The entity is `gtai-<id>` in catalog `contracts`, with canon profile `gtai`. That profile puts it on GTAI's board, not PoF's. Its name is the quest title. Its `data` is `{ questId, questDir, snapshot }`. The snapshot is a `ContractSnapshot` (`pof.contractSnapshot/1`): one server read of the folder, sliced per step.

## Sync: both triggers

| Route | Does |
|-------|------|
| `GET /api/games/gtai/quests` | Derives the ledger from disk on every read. Each quest comes with its snapshot, its guard verdict (`assessQuest` over `loadQuestContext()`), and each step's acceptance, graded by the same checkers the pipeline registers. It is read-only. A package that does not parse is still listed, with its parse error. |
| `POST /api/games/gtai/quests/sync` `{ questId? }` | Operator-guarded (`requireOperator`, like the intake callback). The CLI calls it after it writes or changes a package. It upserts the mirror entity and submits each step's slice through the one write door (`submitStepArtifact` → `commitArtifact`). There the server re-grades the slice. It reports `orphans`: mirror entities whose folder is gone. It never deletes them, and it never writes under `games/`. |

Code: `src/lib/catalog/pipelines/contracts.ts` (registration) and `contracts/` (`contractsSnapshot` pure model, `contractsParse` pure parsers, `contractsRead` + `contractsReadCouncil` server fs reads, `contractsSync` ledger + mirror). The checkers are in `src/lib/catalog/acceptance/contractsCheckers.ts`.

## Steps

The labels are DB keys. Never rename one.

| # | Label | Tier | Pass | Not yet (`pending`) | Fail |
|---|-------|------|------|---------------------|------|
| 1 | Council | L2 | provenance names ≥ 1 source path, and the run folder exists | more than one run holds every source path (ambiguous) | no source path; no run; the declared run folder is missing |
| 2 | Plan | L0 | parses as `gtai.quest/1`; `whyNotFiller` and `provenance.ownerNotes` are non-empty | — | does not parse (the error names the path); either field is empty |
| 3 | Guards | L0 | nothing blocked, nothing unmeasured, judge report present. A red guard WITH an owner override counts as passed, and the reason is shown | a guard is `unmeasured`; the judge report is absent; the package does not parse | a red guard without an override; the judge report is unreadable |
| 4 | Package | L2 | every `new` character has art; every line reserves `audio` | a `new` character has no art (the reason lists them) | a line has no `audio` key |
| 5 | In-game | L3 | `selftest.json` says `succeeded`, and a PNG frame (signature checked; the named `frame` if given) exists | — (deferred, below) | the selftest state is `failed` or `error`, or the file is unreadable |

**Council run id.** `gtai.quest/1` records the fused path ids but not the run. Path ids (`claude-A`) repeat across runs. So the run is `declared` when the package carries `provenance.runId`, which is read leniently because the type does not have it yet. Otherwise the run is `inferred` only when exactly one run under `_council/` holds every source path.

**In-game deferral.** PoF's engine bridge is UE-only. With no evidence, or with a selftest that is not yet `succeeded`, or with no frame, the step DEFERS. Its reason is `unboundReason('gtai')` (`src/lib/games/ueBinding.ts`), plus what is missing. When the file evidence is present it is graded: a registered checker reads the snapshot, so the four-state contract has this as `registered`. Positive evidence passes at L3, and the detail says PoF did not observe the run itself.

**Unsynced entity.** A stub Produce in the lab re-projects the entity's mirrored snapshot. It never invents a quest. On an entity the sync never wrote, which is the walker's starter `contract-awaiting-sync` in `new-catalogs.ts`, Produce writes `{ source: 'awaiting-sync' }`. Every checker DEFERS that at L3 ("awaiting quest sync"), because the truth is produced out of band by the protocol plus the sync, like the L3 drain. So the walker reaches config-complete without a fabricated pass.

## Produce faces

Council and Plan are `rules` steps (CLI-eligible). Guards, Package and In-game are `manifest` steps, derived on the server. Every step uses the shared `CliProduce` through `ArchetypeStep`. Its `criteria` tell the CLI to:

- follow the `/gta --quest` protocol in `.claude/skills/gta/SKILL.md` (`games/gtai/quest/council.mjs`);
- run that step's protocol stage;
- sync, then reply with the step's object as the ledger returns it.

The CLI authors the package, never the step data.

`packagingExempt`: a quest package is a game-data folder copied into the Godot project's `quests/<id>/`, not a UE package.

## Tests

- `src/__tests__/catalog/contracts-pipeline.test.ts`: registration, gradability, the stub produce, and every derivation over temp-dir fixture folders, with the guard verdict injected.
- `src/__tests__/games/contracts-quests-route.test.ts`: the ledger route and the sync route, against a temp DB.
