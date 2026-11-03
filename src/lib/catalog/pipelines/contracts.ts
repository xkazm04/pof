import { registerCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';
import type { StepSpec } from '@/lib/catalog/stepSpec';
import { CONTRACT_CHECKERS } from '@/lib/catalog/acceptance/contractsCheckers';
import { snapshotOf, stepData, type ContractStepKey } from '@/lib/catalog/pipelines/contracts/contractsSnapshot';

/**
 * Contracts pipeline (catalogId: 'contracts') — GTAI: Uprising's quests, one row per quest
 * (spark `gta-quest-loop`, WP2). GTAI-native: in GTAI's manifest as `reuse`, off the ARPG board's concerns.
 *
 * The SOURCE OF TRUTH is the quest package folder `games/gtai/quests/<id>/` (`quest.json`, `gtai.quest/1`).
 * The entity `gtai-<id>` (profile `gtai`) is a mirror the server writes: `POST /api/games/gtai/quests/sync`
 * reads each folder into a `ContractSnapshot` (`contracts/contractsRead.ts`), stores it on the entity's
 * `data.snapshot`, and submits each step's slice through the one write door, where the server re-grades it.
 * `GET /api/games/gtai/quests` re-derives the same ledger from disk on every read.
 *
 * Produce in the lab never invents a quest: it re-projects the entity's mirrored snapshot into the step
 * (the folder read the sync stored). On an entity the sync never wrote (the walker's starter) it writes the
 * awaiting-sync marker, which defers at L3 with the reason. The live CLI path runs the `/gta --quest`
 * protocol step the criteria name and then syncs — the CLI authors the PACKAGE, never the step data.
 *
 *   1. Council  — the council run behind the quest (run id, seats, the 4 path titles).      L2, files on disk
 *   2. Plan     — the fused design; parses as gtai.quest/1, whyNotFiller + ownerNotes set.   L0
 *   3. Guards   — assessQuest over loadQuestContext + the cross-family line judge report.    L0
 *   4. Package  — art for each `new` character; every line reserves `audio`.                L2, files on disk
 *   5. In-game  — the Godot runtime's selftest + frame (adapter-missing deferral otherwise). L3
 */
const PROTOCOL = 'Follow the /gta --quest protocol in .claude/skills/gta/SKILL.md (Quest mode); the council CLI is games/gtai/quest/council.mjs.';
const SYNC_REPLY =
  'Do NOT author this step\'s data yourself. After the protocol step, POST /api/games/gtai/quests/sync, then GET /api/games/gtai/quests ' +
  'and reply with this step\'s object exactly as the ledger returns it for this quest (`steps[].data`).';

/** Produce = the mirrored folder read for this step (or the awaiting-sync marker), plus the operator's direction. */
const project = (key: ContractStepKey) => (e: LabEntity, direction?: string) => ({ data: stepData(snapshotOf(e.data), key, direction) });

const step = (
  key: ContractStepKey, label: string, archetype: StepSpec['archetype'], engine: string, criteria: string[], produceNote: string,
): StepSpec => ({
  archetype,
  label,
  engine,
  view: { kind: 'manifest', field: key },
  produce: project(key),
  accept: CONTRACT_CHECKERS[key],
  criteria: [PROTOCOL, ...criteria, SYNC_REPLY],
  produceNote,
});

registerCatalogPipeline({
  catalogId: 'contracts',
  packagingExempt:
    'A quest package is a game-data folder (games/gtai/quests/<id>/: quest.json, art, verdicts, evidence) copied into ' +
    'the Godot project\'s quests/<id>/, not a UE asset package. Nothing passes through PoF\'s UE package staging, so the ' +
    'packaging drain would have no manifest to rebuild; the terminal proof is the In-game step\'s Godot selftest evidence.',
  steps: [
    step('council', 'Council', 'rules', 'Claude', [
      'Protocol steps 1-3: `council.mjs brief --act <act> --goal "<owner goal>"`, then `run <runDir>`, `assess`, `render`; publish fuse.html and wait for the owner.',
      'Accepted when quest.json provenance names at least one source path AND its council run folder exists under games/gtai/quests/_council/ (record provenance.runId to make the run unambiguous).',
    ], 'Stub: re-shows the council run the last sync read from disk (run id, seats live/skipped, path titles). Live: runs the council protocol steps.'),
    step('plan', 'Plan', 'rules', 'Claude', [
      'Protocol step 4: compose games/gtai/quests/<id>/quest.json (gtai.quest/1) from the owner\'s fusion, provenance.ownerNotes verbatim.',
      'Accepted when quest.json parses as gtai.quest/1 with a non-empty whyNotFiller and provenance.ownerNotes.',
    ], 'Stub: re-shows the fused design the last sync read (logline, goal, whyNotFiller, beats, autosave points, characters, ownerNotes).'),
    step('guards', 'Guards', 'manifest', 'Code', [
      'Protocol step 4-5: `council.mjs check <questDir>` until green (a red guard needs an owner override with its reason in `overrides`), then `council.mjs judge <questDir> --author <seat>`.',
      'Accepted only when no guard is blocked, none is unmeasured, and verdicts/lines.judge.json is present.',
    ], 'Derived on the server: assessQuest over loadQuestContext() and the judge report. Stub re-shows the last derivation.'),
    step('package', 'Package', 'manifest', 'Code', [
      'Protocol step 5: art for every `new` character at games/gtai/quests/<id>/art/<characterId>* (Trivet cutout parts); every line keeps `audio: null` until the voice pass.',
      'Accepted when every new character has art and every line reserves `audio`.',
    ], 'Derived from files on disk: art/<characterId>* per new character, audio reserved per line.'),
    step('inGame', 'In-game', 'manifest', 'Code', [
      'Protocol step 6: a headless Godot run of the quest writes evidence/selftest.json ({ state: "succeeded", frame }) and a PNG frame into the quest folder.',
      'Without that evidence the step defers: PoF\'s engine bridge is UE-only (no Godot adapter).',
    ], 'Graded from file evidence when present (selftest + PNG); otherwise deferred with the Godot adapter-missing reason.'),
  ],
});
