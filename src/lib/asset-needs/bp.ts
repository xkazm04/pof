/**
 * The bp adapter for `asset-needs/1`: pure functions over the text of bp's own files (the CLI reads them, the
 * tests feed fixtures). Sources, all repo-relative to bp:
 *   - apps/vr/ArtSource/<id>/manifest.json      -> inventory (id, class, tris, budget_tris, gates.<g>.pass)
 *   - docs/concepts/vr-light-table/runs/<newest>.md -> the scorecard (element, Before/Now of 3)
 *   - docs/concepts/vr-light-table/art-breakdown.md -> the element table (`Built as`), the pass rule, the style block
 *   - docs/concepts/vr-light-table/plan.md          -> the P4 per-asset budget guide, the pipeline and scene budget
 *
 * Needs:
 *   - scored-low: a scorecard element whose Now is below the pass rule's floor (art-breakdown.md "Pass: no element
 *     below 2 ..."); priority 1 when the rule requires it at 3, else 2.
 *   - missing: a breakdown element whose `Built as` names `generated` - the only kind made offline and handed off
 *     as an ArtSource folder ("generated: made offline on the GPU box ..., gated, finished, imported"); data,
 *     procedural, shader and engine are built in UE or at run time and have no folder - with no folder in the
 *     inventory. Priority 2.
 */
import { ok, err, type Result } from '@/types/result';
import {
  ASSET_NEEDS_SCHEMA, validateAssetNeeds,
  type AssetNeed, type AssetNeeds, type GravitoneClass, type InventoryRow,
} from '@/lib/asset-needs/schema';
import { findTable, paragraphFrom, parseMdTables, parsePassRule, parseScorecard, type ScorecardElement } from '@/lib/asset-needs/score';

export const BP_PATHS = {
  artSource: 'apps/vr/ArtSource',
  runs: 'docs/concepts/vr-light-table/runs',
  breakdown: 'docs/concepts/vr-light-table/art-breakdown.md',
  plan: 'docs/concepts/vr-light-table/plan.md',
  checkArt: 'scripts/check-art.mjs',
} as const;

/** bp manifest class -> gravitone class; `null` = known but not briefable. Every class the 18 manifests carry on 2026-10-25. */
export const BP_CLASS_MAP: Record<string, GravitoneClass | null> = {
  'character-prop': 'character',
  'prop-hero': 'prop',
  'prop-instanced': 'prop',
  'prop-instanced-kit': 'prop',
  'studio-kit': 'prop',
  'set-dressing': 'prop',
  material: null,
  'backdrop-matte': null,
  'capture-hands': null,
};

/**
 * Join table: scorecard / breakdown element number -> the ArtSource folders the element names (2026-10-24 l34).
 *    1 Lit table, white edge light          -> light-table-frame
 *    5 Furniture inside rooms               -> fixture-kit
 *    7 Amber pins with tags                 -> survey-pin
 *    9 Lamp agent                           -> lamp-agent
 *   12 Real hands                           -> hands-capture
 *   13 Dark studio: shelves, drawings on walls, desk lamp, mug, rolled drawings
 *                                           -> studio-shelves, studio-pinned-drawings, studio-desk-lamp, studio-mug,
 *                                              studio-drawing-tubes
 *   14 Night city                           -> city-backdrop
 * Unjoined on purpose: studio-architecture, studio-wall-kit, studio-desk-clutter (the 2026-10-25 fidelity sprint,
 * after the 10-24 scorecard, and element 13 names none of them) and the four mat-* materials (no element is a
 * material). Elements 2-4, 6, 8, 10, 11, 15 name no folder: data, procedural, shader or text layer.
 */
export const BP_ELEMENT_FOLDERS: Record<number, string[]> = {
  1: ['light-table-frame'],
  5: ['fixture-kit'],
  7: ['survey-pin'],
  9: ['lamp-agent'],
  12: ['hands-capture'],
  13: ['studio-shelves', 'studio-pinned-drawings', 'studio-desk-lamp', 'studio-mug', 'studio-drawing-tubes'],
  14: ['city-backdrop'],
};

/** Breakdown element -> the plan.md P4 budget row that prices it (matched by the row's leading words). */
const ELEMENT_PLAN_ROW: Record<number, string> = {
  1: 'Light table frame', 7: 'Survey pin', 9: 'Lamp agent', 13: 'Studio kit', 14: 'City backdrop',
};

export interface BpFiles {
  manifests: { folder: string; text: string }[];
  scorecard: { path: string; text: string };
  breakdown: string;
  plan: string;
}
export interface BpMeta { generatedAt: string; commit: string; pofCommit: string }

type Manifest = Record<string, unknown>;
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** bp's own tris rule (scripts/check-art.mjs (c)): a number, or an object of numbers summed - the largest when budget_note says "per mesh". */
export function manifestTris(m: Manifest): number | undefined {
  const t = m.tris;
  if (num(t)) return t;
  if (t && typeof t === 'object' && Object.values(t).every(num)) {
    const v = Object.values(t) as number[];
    return /per mesh/i.test(String(m.budget_note ?? '')) ? Math.max(...v) : v.reduce((a, b) => a + b, 0);
  }
  return undefined;
}

const humanName = (id: string): string => {
  const mat = id.startsWith('mat-');
  const words = (mat ? id.slice(4) : id).replace(/-/g, ' ');
  return `${words[0].toUpperCase()}${words.slice(1)}${mat ? ' material' : ''}`;
};

export function inventoryRow(folder: string, m: Manifest): InventoryRow {
  const cls = String(m.class ?? 'unknown');
  const g = BP_CLASS_MAP[cls];
  const gates: Record<string, boolean> = {};
  for (const [name, v] of Object.entries((m.gates ?? {}) as Record<string, unknown>)) {
    gates[name] = !!v && typeof v === 'object' && (v as { pass?: unknown }).pass === true;
  }
  const tris = manifestTris(m);
  return {
    id: folder,
    name: humanName(folder),
    class: cls,
    ...(g ? { gravitoneClass: g } : {}),
    ...(tris !== undefined ? { tris } : {}),
    ...(num(m.budget_tris) ? { budgetTris: m.budget_tris } : {}),
    gates,
  };
}

export interface BreakdownElement { n: number; image: string; bp: string; builtAs: string; notes: string; line: number }

export function parseBreakdown(text: string): Result<BreakdownElement[], string> {
  const found = findTable(text, ['#', 'In the image', 'In bp', 'Built as']);
  if (!found) return err('art-breakdown.md: no element table with a "Built as" column');
  const { table, col } = found;
  const notes = table.header.findIndex((h) => h.toLowerCase() === 'notes');
  return ok(table.rows.filter((r) => /^\d+$/.test(r.cells[col['#']] ?? '')).map((r) => ({
    n: Number(r.cells[col['#']]),
    image: r.cells[col['In the image']],
    bp: r.cells[col['In bp']],
    builtAs: r.cells[col['Built as']],
    notes: notes >= 0 ? r.cells[notes] ?? '' : '',
    line: r.line,
  })));
}

/** A `Budget (triangles...)` cell -> tris: "30k" 30000, "500, instanced" 500, "80k total" 80000, "n/a" undefined. */
export function parseBudgetCell(cell: string): number | undefined {
  const m = /^(\d+(?:\.\d+)?)\s*(k)?\b/i.exec(cell.trim());
  return m ? Math.round(Number(m[1]) * (m[2] ? 1000 : 1)) : undefined;
}

export interface PlanBudget { asset: string; cell: string; tris?: number; line: number }

export function parsePlanBudgets(text: string): PlanBudget[] {
  for (const table of parseMdTables(text)) {
    const asset = table.header.findIndex((h) => h.toLowerCase() === 'asset');
    const budget = table.header.findIndex((h) => /^budget/i.test(h));
    if (asset < 0 || budget < 0) continue;
    return table.rows.map((r) => {
      const cell = r.cells[budget] ?? '';
      const tris = parseBudgetCell(cell);
      return { asset: r.cells[asset], cell, ...(tris !== undefined ? { tris } : {}), line: r.line };
    });
  }
  return [];
}

export const kebab = (s: string): string =>
  s.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** A breakdown cell's head noun phrase: "The lamp agent with a warm head" -> "lamp agent", "Dark studio: shelves" -> "Dark studio". */
const shortName = (image: string): string => image.split(/[:,(]| with /)[0].replace(/^the\s+/i, '').trim() || image;

/** gravitone class for a breakdown element with no folder, from its `Built as` words: rigged -> character; TRELLIS or props -> prop. */
const builtAsGravitone = (builtAs: string): GravitoneClass | undefined =>
  /rigged/i.test(builtAs) ? 'character' : /trellis|\bprops?\b/i.test(builtAs) ? 'prop' : undefined;

export function buildBpAssetNeeds(files: BpFiles, meta: BpMeta): Result<AssetNeeds, string[]> {
  const problems: string[] = [];
  const notes: string[] = [];
  const inventory: InventoryRow[] = [];
  for (const { folder, text } of [...files.manifests].sort((a, b) => a.folder.localeCompare(b.folder))) {
    let m: Manifest;
    try { m = JSON.parse(text) as Manifest; } catch (e) { problems.push(`${BP_PATHS.artSource}/${folder}/manifest.json: ${(e as Error).message}`); continue; }
    const row = inventoryRow(folder, m);
    if (!(row.class in BP_CLASS_MAP)) notes.push(`Unknown bp class "${row.class}" (${BP_PATHS.artSource}/${folder}/manifest.json): no gravitone class until the class map in POF src/lib/asset-needs/bp.ts names it`);
    inventory.push(row);
  }
  const byId = new Map(inventory.map((r) => [r.id, r]));

  const card = parseScorecard(files.scorecard.text);
  const rule = parsePassRule(files.breakdown);
  const breakdown = parseBreakdown(files.breakdown);
  if (!card.ok) problems.push(`${files.scorecard.path}: ${card.error}`);
  if (!rule.ok) problems.push(`${BP_PATHS.breakdown}: ${rule.error}`);
  if (!breakdown.ok) problems.push(breakdown.error);
  if (!card.ok || !rule.ok || !breakdown.ok || problems.length) return err(problems);

  const plan = parsePlanBudgets(files.plan);
  const elements = new Map(breakdown.data.map((e) => [e.n, e]));
  const joined = (n: number): InventoryRow[] => (BP_ELEMENT_FOLDERS[n] ?? []).flatMap((f) => byId.get(f) ?? []);
  const planBudget = (n: number): number | undefined =>
    ELEMENT_PLAN_ROW[n] ? plan.find((p) => p.asset.startsWith(ELEMENT_PLAN_ROW[n]))?.tris : undefined;

  for (const el of card.data) {
    for (const row of joined(el.n)) row.score = { value: el.now, of: 3, source: files.scorecard.path };
  }

  const needs: AssetNeed[] = [];
  for (const el of card.data.filter((e: ScorecardElement) => e.now < rule.data.floor)) {
    const rows = joined(el.n);
    const one = rows.length === 1 ? rows[0] : undefined;
    const b = elements.get(el.n);
    const budget = one?.budgetTris ?? planBudget(el.n);
    const g = one?.gravitoneClass;
    needs.push({
      id: `need-${kebab(el.name)}`,
      kind: 'scored-low',
      subject: b?.image ?? el.name,
      class: one?.class ?? b?.builtAs ?? 'unknown',
      ...(g ? { gravitoneClass: g } : {}),
      why: el.differs || `scored ${el.now} of 3`,
      evidence: `${files.scorecard.path}:${el.line}`,
      ...(budget !== undefined ? { budgetTris: budget } : {}),
      priority: rule.data.required.includes(el.n) ? 1 : 2,
      ...(one ? { assetId: one.id } : {}),
    });
  }
  for (const b of breakdown.data.filter((e) => /\bgenerated\b/i.test(e.builtAs) && joined(e.n).length === 0)) {
    const g = builtAsGravitone(b.builtAs);
    const budget = planBudget(b.n);
    needs.push({
      id: `need-${kebab(shortName(b.image))}`,
      kind: 'missing',
      subject: b.image,
      class: b.builtAs,
      ...(g ? { gravitoneClass: g } : {}),
      why: b.notes || `built as ${b.builtAs}; ${BP_PATHS.artSource} has no folder for it`,
      evidence: `${BP_PATHS.breakdown}:${b.line}`,
      ...(budget !== undefined ? { budgetTris: budget } : {}),
      priority: 2,
    });
  }

  notes.unshift(...bpRuleNotes(files, inventory, rule.data.sentence, rule.data.line, plan));
  return validateAssetNeeds({
    schema: ASSET_NEEDS_SCHEMA,
    project: 'bp',
    generatedAt: meta.generatedAt,
    source: { repo: 'bp', commit: meta.commit, pofCommit: meta.pofCommit },
    rules: { notes },
    inventory,
    needs,
  } satisfies AssetNeeds);
}

/** The project's own rules a new asset must follow, each with where it comes from. bp states budgets per asset, not per class, so rules.budgets is omitted. */
function bpRuleNotes(files: BpFiles, inventory: InventoryRow[], passSentence: string, passLine: number, plan: PlanBudget[]): string[] {
  const out: string[] = [];
  out.push(`Fidelity pass rule: "${passSentence}" (${BP_PATHS.breakdown}:${passLine})`);
  out.push(`Poly budget is per asset: tris at or under the manifest's budget_tris, summed over meshes, the largest mesh when budget_note says "per mesh" (${BP_PATHS.checkArt} (c)); no per-class budget is stated`);
  const priced = plan.filter((p) => p.tris !== undefined);
  if (priced.length) out.push(`P4 per-asset guide (triangles): ${priced.map((p) => `${p.asset} ${p.cell}`).join('; ')} (${BP_PATHS.plan}:${priced[0].line}); a manifest's budget_tris supersedes it`);
  const base = inventory.length ? Object.keys(inventory[0].gates).filter((g) => inventory.every((r) => g in r.gates)) : [];
  if (base.length) out.push(`Every manifest carries gates ${base.join(', ')}, each pass: true (${BP_PATHS.artSource}/*/manifest.json; ${BP_PATHS.checkArt} (b))`);
  const extra = new Map<string, Set<string>>();
  for (const r of inventory) for (const g of Object.keys(r.gates)) if (!base.includes(g)) extra.set(r.class, (extra.get(r.class) ?? new Set()).add(g));
  for (const [cls, gs] of extra) out.push(`Class ${cls} also carries gate ${[...gs].join(', ')} (${BP_PATHS.artSource}/*/manifest.json)`);
  const chain = paragraphFrom(files.plan, 'Each asset passes the same chain');
  if (chain) out.push(`${chain.text} (${BP_PATHS.plan}:${chain.line})`);
  const scene = paragraphFrom(files.plan, 'Scene budget for the whole slice');
  if (scene) out.push(`${scene.text} (${BP_PATHS.plan}:${scene.line})`);
  const sheets = paragraphFrom(files.breakdown, 'Prop sheets for image-to-3D');
  if (sheets) out.push(`${sheets.text} (${BP_PATHS.breakdown}:${sheets.line})`);
  const style = findTable(files.breakdown, ['Slot', 'Value']);
  for (const row of style?.table.rows ?? []) {
    const slot = row.cells[style!.col.Slot];
    if (['Palette with roles', 'Finish', 'Never'].includes(slot)) out.push(`Style block, ${slot}: ${row.cells[style!.col.Value]} (${BP_PATHS.breakdown}:${row.line})`);
  }
  const textures = files.manifests.map((f) => (JSON.parse(f.text) as Manifest).textures).filter((t) => t !== undefined).map((t) => (typeof t === 'string' ? t : JSON.stringify(t)));
  const orm = textures.filter((t) => /R (ambient )?occlusion,? G roughness,? B metal/i.test(t)).length;
  if (orm) out.push(`Texture convention: ${orm} of ${textures.length} manifests with a textures entry pack ORM as R occlusion, G roughness, B metal${textures.some((t) => /OpenGL/.test(t)) ? ', with a tangent-space OpenGL normal' : ''} (${BP_PATHS.artSource}/*/manifest.json textures)`);
  return out;
}
