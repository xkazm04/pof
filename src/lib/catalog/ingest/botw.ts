/**
 * The Legend of Zelda: Breath of the Wild (2017) → PoF mapping, read from the zeldaret/botw
 * decompilation (the /zelda loop).
 *
 * **This file carries the MAPPING and the tree's STRUCTURE, never anything read from it.** A
 * decompilation is Nintendo-derived code: no identifier, string, number or line of it may enter
 * this repo. What may: the pinned commit, PATH globs over the tree (its structure, the way
 * `diablo1.ts` carries column names), and PoF's own analysis — which column lands where, which
 * paths PoF does not need and why. Records live only in the wrapper store (`~/.pof/pof.db`) and
 * in the vault (`Zelda/`), and every projected entity carries `provenance.licenceNote`.
 *
 * Why this game: it is the opposite design pole from Diablo — a systemic open world (chemistry,
 * physics-driven interaction, a stamina-gated traversal kit, cooking) — so every place PoF's
 * module set has no home for one of its systems is a design or feature upgrade worth knowing.
 * There are no design TABLES to read, only code, so the technique is `cpp-decls`: one record per
 * class or enum definition, and one per owner of out-of-line definitions in a file (see
 * `cppDecls.ts`). Its columns are fixed by the reader, and every one is
 * classified below, so a column the reader gains becomes an `unclassified` defect, not a loss.
 */
import { dropped, gap, mapped, type FieldMap, type FieldRule } from '@/lib/catalog/ingest/fieldMap';
import type { Descope } from '@/lib/catalog/reference/pathCoverage';

/** The commit every record, count and finding is read at. BOOT refuses any other HEAD. */
export const BOTW_PIN = '49c6b5c18344de6555163b3af7044970ad9d7c5e';

export const BOTW_REPO = 'https://github.com/zeldaret/botw';

/** The only tree in scope. `lib/` (vendored SDK/engine libraries) and the build tooling are not. */
export const BOTW_TREE = 'src';

export const BOTW_OBTAIN =
  `git clone --filter=blob:none --sparse ${BOTW_REPO} botw && git -C botw sparse-checkout set src data `
  + `&& git -C botw checkout ${BOTW_PIN} — no submodules; the data root is the clone itself`;

export const BOTW_SOURCE = {
  sourceGame: 'The Legend of Zelda: Breath of the Wild (2017)',
  sourceProject: 'zeldaret/botw — C++ decompilation (src/)',
  licenceNote:
    'Reference-only learning. The decompiled code is derived from Nintendo’s game; PoF reads its '
    + 'STRUCTURE (class shapes) to learn which systems its own modules lack. Nothing from it ships, '
    + 'and no code, identifier, string or value from it enters the PoF repo.',
} as const;

/** How one area of the tree phrases what its catalog cannot hold. */
export interface ClassGaps {
  bases: FieldRule;
  methods: FieldRule;
  fields: FieldRule;
}

/**
 * Every `cpp-decls` column classified; the three that carry design meaning are per-area. The map
 * covers all three record families of `cpp-decls@2` (class / enum / definition, see the record-shape
 * table in `cppDecls.ts`): they share the columns, so an area's gap reasons must name what each
 * column holds for each kind — `methods` is also an owner's out-of-line definitions, `fields` also
 * an enum's enumerator names.
 */
export function botwClassMap(gaps: ClassGaps): FieldMap {
  return {
    file: dropped('the path is the wrapper identity and provenance.sourceFile already'),
    line: dropped('a position inside a decompiled file, not a design value'),
    kind: mapped('data.declKind'),
    name: mapped('name'),
    qualifiedName: mapped('data.qualifiedName'),
    namespace: mapped('data.namespace'),
    outer: mapped('data.outer'),
    templateParams: dropped('template parameters are C++ reuse machinery, not something a designer authors'),
    bases: gaps.bases,
    methods: gaps.methods,
    fields: gaps.fields,
  };
}


/* ── player-movement ← src/Game/Actor/Player/** (W00) ──────────────────── */

export const PLAYER_CLASS_MAP: FieldMap = botwClassMap({
  bases: gap('player-movement has no behaviour taxonomy: the reference player is a library of action and '
    + 'AI-node classes, each a KIND of a shared node base; the catalog holds one locomotion set and no "kind of action" field'),
  methods: gap('no home for what a player behaviour can DO (enter/leave/update hooks, queries) — declared on a class '
    + 'record, implemented on its out-of-line definition record: player-movement steps verify UE assets (mesh, clips, input) '
    + 'and never model behaviours'),
  fields: gap('no home for per-behaviour STATE (timers, links, cached targets) on a class record, nor for a closed '
    + 'vocabulary (an enum record\'s enumerator names): the catalog has no state model and no enumerated-kind field to hold either'),
});

/* ── descopes ───────────────────────────────────────────────────────────── */

/**
 * Paths PoF does not need, each with the reason in PoF's own words. Only descopes the loop is
 * sure of: engine infrastructure UE already provides, platform services a PC UE title has no
 * counterpart for, and the decompilation's own build/tooling files. Anything doubtful stays
 * OPEN — an undecided file is honest; a wrong descope hides a system.
 */
export const BOTW_DESCOPES: readonly Descope[] = [
  { pattern: 'src/**/CMakeLists.txt', reason: 'build wiring of the decompilation project — no game design in it' },
  { pattern: 'src/.clang-tidy', reason: 'lint configuration of the decompilation project' },
  { pattern: 'src/**/.gitkeep', reason: 'empty placeholder file' },
  { pattern: 'src/**/*.py', reason: 'a helper script of the decompilation project, not game code' },
  { pattern: 'src/KingSystem/Utils/**', reason: 'containers, bit fields, hashing, threads, a binary-YAML reader — C++/UE Core provides all of it' },
  { pattern: 'src/KingSystem/Framework/**', reason: 'boot, root task and worker threads — UE’s engine loop and task graph' },
  { pattern: 'src/KingSystem/Graphics/**', reason: 'a renderer component — UE’s renderer is not something PoF designs' },
  { pattern: 'src/KingSystem/Terrain/**', reason: 'the terrain engine — UE Landscape / World Partition' },
  { pattern: 'src/KingSystem/Mii/**', reason: 'a console avatar service with no counterpart in a PC UE title' },
  { pattern: 'src/KingSystem/Resource/*', reason: 'archive loading, resource caches, heaps and load tasks — UE’s asset manager and streaming (the param-file readers in Resource/ subfolders stay open: they carry data schemas)' },
];
