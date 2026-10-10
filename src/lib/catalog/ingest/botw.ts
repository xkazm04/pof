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

/* ── items ← src/KingSystem/Resource/GeneralParamList/** (W02) ─────────── */

/**
 * The per-object parameter-group library: each class is one typed group of tunable parameters
 * (a weapon group, an armour group, an enemy group, a liftable group …) and an object is composed
 * from several of them, picked from one closed list of group kinds. Wrapped under `items` — the
 * catalog holding the largest share of the groups (vault Decisions Z-D11) — but the schema
 * question it asks spans items, bestiary and props alike.
 */
export const PARAM_GROUP_CLASS_MAP: FieldMap = botwClassMap({
  bases: gap('no home for COMPOSITION: every group is a kind of one shared parameter-group base and an object '
    + 'carries several groups chosen from a closed list; PoF gives an entity one fixed attribute sheet per catalog and '
    + 'no "which parameter groups does this object carry" field'),
  methods: dropped('a group declares only its constructor and a name accessor, and its out-of-line definition record '
    + 'names only that constructor or a per-index registration helper: parameter-registration machinery, not design — '
    + 'each parameter\'s key and default sit in the bodies, which the reader never reads'),
  fields: gap('no home for a PARAMETER SCHEMA: a class record\'s fields are the named tunables of one group, and the '
    + 'enum record\'s enumerator names are the closed vocabulary of group kinds; items, bestiary and props each author a '
    + 'fixed attribute sheet and have no field for "the named parameters an object type carries" nor for that vocabulary'),
});

/* ── status-effects ← src/KingSystem/Chemical/** (W03) ────────────────── */

/**
 * The chemistry rule-book: a per-object chemistry body (shapes and rigid parts behind two read-only
 * interfaces) and one configuration class holding three property tables — elements, materials and
 * the world's propagation rates. Wrapped under `status-effects`, the catalog that already names
 * elements (vault Decisions Z-D14), though most of the area has no PoF home at all.
 */
export const CHEMISTRY_CLASS_MAP: FieldMap = botwClassMap({
  bases: dropped('parameter-serialisation and debug-node machinery, plus two read-only interfaces over the per-object '
    + 'chemistry body: how the code is wired, not something a designer authors'),
  methods: dropped('on class records, accessors over the parameters `fields` already names, lookup-by-name and parse '
    + 'machinery, and numbered attribute-flag queries whose meanings the decompilation does not recover; on definition '
    + 'records, constructors, destructors and that same machinery — no behaviour a catalog could hold'),
  fields: gap('no home for a chemistry PROPERTY model: the property records hold an element\'s physical state, a '
    + 'material\'s thermal, electric and burn constants and the element each reaction turns it into, the world\'s global '
    + 'propagation rates, and a per-object body (mass, volume, burn-out time); status-effects authors effects applied to a '
    + 'target and has no field for any of them'),
});

/* ── zone-map ← src/KingSystem/World/** (W03) ─────────────────────────── */

/**
 * The world simulation: a hub that owns nine world jobs (clock, sky, a scheduled sky event, weather,
 * temperature, wind, environment look, depth of field, chemistry), the per-climate parameter tables,
 * and the closed vocabularies of weather, climate and moon phase. Wrapped under `zone-map`, where a
 * region and its authored mood live (vault Decisions Z-D14); the simulation itself has no PoF home.
 */
export const WORLD_CLASS_MAP: FieldMap = botwClassMap({
  bases: gap('no home for a world-simulation ROSTER: the managers are each a kind of one world-job base, and the '
    + 'job-kind enum names the roster; zone-map authors one region and has no field for which world simulations run over it'),
  methods: gap('no home for the world\'s QUERY CONTRACT: on class records the hub answers per-position questions (rain, '
    + 'temperature by height for day and night, wind, ignition level, climate) and the clock answers moon phase and the '
    + 'periodic reset night; definition records carry their implementations. zone-map steps author a static region and '
    + 'publish nothing other systems can ask'),
  fields: gap('no home for CLIMATE and LOOK parameters or their vocabularies: a per-climate record holds weather odds, '
    + 'temperature bands by altitude, moisture, wind power and ignition level; environment and sky records hold fog, bloom '
    + 'and cloud palettes per time and weather; enum records list weather kinds, climate regions and moon phases. zone-map '
    + 'has one authored mood and no climate, weather or time-of-day field (many names here are offset placeholders, F3)'),
});

/* ── state-graph ← src/Game/Actor/Horse/** (W04) ──────────────────────── */

/**
 * The mount's behaviour-node library: one header per node — a selector that picks what the mount
 * does next, or an action it runs (wander, wait, turn, swim, eat, buck a rider off, keep the saddle
 * and reins in step with the rider) — and one source per node implementing its lifecycle. Wrapped
 * under `state-graph`, where a behaviour's states live (vault Decisions Z-D18), though the mount
 * itself has no PoF home.
 */
export const MOUNT_CLASS_MAP: FieldMap = botwClassMap({
  bases: gap('state-graph has one flat kind of state: each mount node is a kind of one of two engine node bases — a '
    + 'selector that decides on entry, or an action that runs — and a few extend another node to inherit its tunables; '
    + 'the catalog has no node-kind field and no "this state extends that state" link'),
  methods: gap('no home for a node\'s TICK RULE: a class record declares only the fixed node lifecycle (load parameters, '
    + 'init, enter, per-frame update, leave) plus construction, and its definition record implements the same set; which '
    + 'hooks a node overrides is the design bit — selectors never update per frame, most actions do — and state-graph '
    + 'models enter / exit hook points but neither a per-frame update nor a decide-on-entry selector'),
  fields: gap('no home for PER-STATE PARAMETERS: every field is a parameter handle — static tunables per actor type '
    + '(speeds, distances, wait ranges, gait limits) or dynamic per-call inputs (a target position, a target actor, rider '
    + 'and mount links); state-graph keeps one blackboard key set per graph and no tunables or inputs per state'),
});

/* ── crafting-recipes ← src/Game/Cooking/** (W06) ─────────────────────── */

/**
 * The cooking engine: one class that turns a handful of ingredients into a dish — it matches a recipe
 * by ingredient name or tag, sums what each ingredient contributes, rolls a critical bonus, applies
 * seasoning and recipe bonuses, clamps the result and derives its sell price — plus the dish it
 * produces and the closed list of effect kinds a dish can carry. Wrapped under `crafting-recipes`, the
 * home of most of its records (vault Decisions Z-D26). Its bodies are real behaviour; the reader keeps
 * only their names.
 */
export const COOKING_CLASS_MAP: FieldMap = botwClassMap({
  bases: dropped('empty in this area: the engine, its dish and its argument records derive from nothing, so the '
    + 'column carries no value to hold'),
  methods: gap('no home for a COOKING PROCEDURE: the engine\'s class record declares the named steps of a cook (match a '
    + 'recipe by ingredient name or tag, sum ingredient contributions, roll a critical bonus, add seasoning and recipe '
    + 'bonuses, clamp, price, fall back to a failed dish) and its definition record implements them; crafting-recipes maps '
    + 'a fixed input list to a fixed output and has no field for the steps that derive an output from its inputs'),
  fields: gap('no home for a cooked RESULT schema or the procedure\'s tunables: the dish record holds its ingredients, '
    + 'restored health, effect kind, strength and duration, sell price and a critical flag; the engine holds per-effect '
    + 'caps, multipliers and bonus durations and per-ingredient-count price and success tables; the enum record lists the '
    + 'effect kinds. crafting-recipes gives an output a heal and a duration and has no effect vocabulary, no per-effect cap '
    + 'and no price derived from its inputs'),
});

/* ── props ← src/KingSystem/Resource/Actor/** (W06) ───────────────────── */

/**
 * The per-object parameter FILES: an object names, slot by slot, one file of each kind it needs — its
 * interaction checks, its animation list and graph, its model list, perception, damage response,
 * ragdoll, drop, shop and recipe tables, icon framing, appearance conditions, chemistry body and its
 * parameter-group list (the W02 library). Wrapped under `props`, the catalog holding the largest share
 * of its records among real catalogs (vault Decisions Z-D26), though the largest group of all — the
 * animation graph — has no catalog home.
 */
export const ACTOR_FILE_CLASS_MAP: FieldMap = botwClassMap({
  bases: gap('no home for the KIND hierarchies the area declares: interaction checks (one base and a kind per test — line '
    + 'of sight, screen, sphere / fan / cylinder / box areas, angle, weight, riding, swimming, carrying, fire contact, '
    + 'under water …), animation-graph nodes (sequence, selector, blender, asset) with their per-node extension parsers, '
    + 'and the entry kinds of an object\'s behaviour program (a selector or action, a behaviour, a query); props has one '
    + 'interaction-type field and no check kinds, and no catalog holds an animation graph or a behaviour program. The '
    + 'other bases are parameter-file and resource machinery'),
  methods: gap('no home for the per-object QUERY contract: beside parse and accessor machinery and numbered hooks whose '
    + 'names are not recovered (F3), the class records ask named questions of an object\'s files — each interaction check\'s '
    + 'own test, roll a drop from a named table or fall back to the normal one, the damage rate of a damage source, the '
    + 'reaction to a source at a size, whether the object carries a tag — and the definition records implement them, '
    + 'mostly as parsers; the catalogs author static sheets and publish no queries'),
  fields: gap('no home for the per-object parameter FILES: a class record is one file kind an object links by name and '
    + 'its fields that file\'s named parameters, the link record\'s fields are its slots per file kind, and the enum records '
    + 'list check kinds, link slots, extension kinds, damage sizes and damage sources; no catalog has a field for which '
    + 'files an object carries or for their schemas (some names are offset placeholders, F3)'),
});

/* ── cutscenes + dialog-trees ← src/Game/Actor/Camera/** (W07) ────────── */

/**
 * The camera's behaviour-node library: one header per node — a selector that picks the camera mode,
 * or a camera action (follow, aim, lock on, climb, ride, scripted event shots, conversation shots) —
 * and one source per node. Two specs share this map: the action half under `cutscenes`, the selector
 * half under `dialog-trees`, each the plurality of its half among real catalogs (vault Decisions
 * Z-D30), though the gameplay cameras themselves have no PoF home. Most nodes are bare shells.
 */
export const CAMERA_SHOT_NODE_MAP: FieldMap = botwClassMap({
  bases: gap('no home for a camera-behaviour KIND hierarchy: every node is a kind of one of the engine\'s two node bases '
    + '(a selector that decides on entry, or an action that runs), and most extend another camera node several levels deep '
    + '(an event-shot family, a conversation family, a tracking family); cutscenes and dialog-trees describe a shot as free '
    + 'text and have no camera-behaviour kind and no "this camera extends that camera" link'),
  methods: gap('no home for a camera node\'s TICK RULE or its scoped overrides: a class record declares construction and, '
    + 'on a few nodes, the fixed node lifecycle (load parameters, init, enter, per-frame update, leave), and its definition '
    + 'record implements the same set; only the family bases tick per frame, and the clip-plane overrides set a value on '
    + 'enter and restore it on leave. Most nodes declare construction only (bodies are stubs, F12); neither catalog has a '
    + 'per-frame camera update nor an override scoped to a beat'),
  fields: gap('no home for CAMERA PARAMETERS: the few fields are parameter handles — static per-context camera preset '
    + 'names and a family flag, and dynamic event inputs (focus distance range, near and far clip, a blend time); '
    + 'cutscenes and dialog-trees hold a shot and a blend as prose and have no typed camera preset, focus, clip or blend '
    + 'field (most nodes have no field at all; some names are offset placeholders, F3)'),
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
