import { ARCHETYPE_CANON } from '@/lib/catalog/canon/archetypeCanon';
import { isContentInvariant } from '@/lib/catalog/acceptance/contentInvariant';
import { MIN_PROSE } from '@/lib/catalog/acceptance/wiringCheckers';
import type { WiringRequirement } from '@/lib/knowledge/wiring-requirements';
import type { RuleCategory } from '@/lib/catalog/canon/types';
import type { CatalogPipeline, StepSpec } from '@/lib/catalog/stepSpec';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

/**
 * WIRING CONTRACTS REACH PROMPTS.
 *
 * The fleet authored 137+ `wiringContract` blocks and a pile of per-step `criteria`
 * objects inside the pipelines' produce bodies. Until this module they were read by
 * exactly ONE consumer — the acceptance checker (`wiringCheckers.ts`) — so every
 * produce prompt asked a CLI to author an artifact WITHOUT telling it the contract the
 * artifact would then be graded against.
 *
 * This module is the pure, unit-testable extraction that closes that gap. It reads a
 * step's own authored payload (the produce stub — the contract as the fleet WROTE it),
 * pulls out the wiring contracts + criteria, and renders them as prompt sections.
 *
 * Three consumers share it, so the prompt is identical wherever a step is driven:
 *  - `ArchetypeStep.buildPrompt`  — the ~330 generic lab steps (highest leverage),
 *  - `recipe.ts` `recipeBuilder`  — the four-phase headless generation recipes,
 *  - `headless.ts` `stepRecipe`   — the pof-mcp/API step recipe.
 *
 * It is INJECTION ONLY. Nothing here re-derives, re-validates or grades a contract —
 * no acceptance verdict can move because of this file.
 *
 * Everything is size-capped (`MAX_*` below) and the caps are asserted by
 * `src/__tests__/lib/catalog/contractPrompt.test.ts` against the LIVE registry, so a
 * newly authored contract can never quietly blow up every prompt in the app.
 */

/** Longest a single wiring claim / criterion may be before it is elided. */
export const MAX_CLAIM_CHARS = 220;
/** Hard ceiling on the per-step contract block ArchetypeStep prepends. */
export const MAX_STEP_CONTRACT_CHARS = 2400;
/** Max contract rows the catalog-wide (recipe) wiring table may carry. */
export const MAX_CATALOG_CONTRACT_ROWS = 24;
/** Max criteria lines injected into a prompt's success section. */
export const MAX_CRITERIA_LINES = 12;
/** How deep into a produce payload the walker looks for contracts/criteria. */
const MAX_WALK_DEPTH = 4;

/** A wiring contract found inside a produce payload, with the dot-path it lives at. */
export interface FoundContract {
  /** '' for a root contract, else the dot-path of its container (e.g. `layers.bed`). */
  path: string;
  contract: Record<string, unknown>;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  v != null && typeof v === 'object' && !Array.isArray(v);

const clamp = (s: string): string =>
  s.length <= MAX_CLAIM_CHARS ? s : `${s.slice(0, MAX_CLAIM_CHARS - 1).trimEnd()}…`;

/** Depth-bounded walk collecting every `key` occurrence with its container path. */
function findKeyed(data: unknown, key: string): { path: string; value: unknown }[] {
  const out: { path: string; value: unknown }[] = [];
  const walk = (node: unknown, path: string, depth: number): void => {
    if (depth > MAX_WALK_DEPTH || !isPlainObject(node)) return;
    if (key in node) out.push({ path, value: node[key] });
    for (const [k, v] of Object.entries(node)) {
      if (k === key) continue;
      if (isPlainObject(v)) walk(v, path ? `${path}.${k}` : k, depth + 1);
      else if (Array.isArray(v)) {
        v.forEach((el, i) => walk(el, `${path ? `${path}.` : ''}${k}[${i}]`, depth + 1));
      }
    }
  };
  walk(data, '', 0);
  return out;
}

/** Every wiring contract declared anywhere in a produce payload. */
export function findWiringContracts(data: unknown): FoundContract[] {
  return findKeyed(data, 'wiringContract')
    .filter((f) => isPlainObject(f.value))
    .map((f) => ({ path: f.path, contract: f.value as Record<string, unknown> }));
}

/** Every `criteria` declaration in a produce payload, flattened to prompt lines. */
export function findCriteria(data: unknown): { path: string; text: string }[] {
  const out: { path: string; text: string }[] = [];
  for (const { path, value } of findKeyed(data, 'criteria')) {
    const at = path ? `${path}.criteria` : 'criteria';
    if (typeof value === 'string' && value.trim()) out.push({ path: at, text: clamp(value.trim()) });
    else if (Array.isArray(value)) {
      value.forEach((v, i) => {
        if (typeof v === 'string' && v.trim()) out.push({ path: `${at}[${i}]`, text: clamp(v.trim()) });
      });
    } else if (isPlainObject(value)) {
      for (const [k, v] of Object.entries(value)) {
        if (v == null || isPlainObject(v)) continue;
        out.push({ path: `${at}.${k}`, text: clamp(String(Array.isArray(v) ? v.join(', ') : v)) });
      }
    }
  }
  return out;
}

/** Run a step's produce body for its AUTHORED payload. Never throws into a prompt. */
function producedData(spec: StepSpec, entity: LabEntity): Record<string, unknown> {
  try {
    const out = spec.produce(entity);
    return isPlainObject(out?.data) ? out.data : {};
  } catch {
    return {};
  }
}

const claim = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? clamp(v.trim()) : undefined;

/** A step's contracts as `WiringRequirement` rows (the shared prompt-table shape). */
export function stepContractRequirements(spec: StepSpec, entity: LabEntity): WiringRequirement[] {
  return findWiringContracts(producedData(spec, entity)).map(({ path, contract }) => ({
    artifact: path ? `${spec.label} · ${path}` : spec.label,
    grantedBy: claim(contract.grantedBy),
    activatedBy: claim(contract.activatedBy),
    verification: claim(contract.verification),
    dependencies: Array.isArray(contract.dependencies)
      ? contract.dependencies.filter((d): d is string => typeof d === 'string' && !!d.trim()).map(clamp)
      : undefined,
  }));
}

/** A step's authored criteria as success-criteria lines. */
export function stepCriteriaLines(spec: StepSpec, entity: LabEntity): string[] {
  return findCriteria(producedData(spec, entity)).map((c) => `${spec.label} — \`${c.path}\`: ${c.text}`);
}

/** The rule every injected contract is graded by — stated once, so the CLI can meet it. */
export const CONTRACT_RULE =
  `Reproduce these four wiring fields on the artifact you write (\`wiringContract\`). The L2 checker rejects a ` +
  `placeholder ("TBD"/"TODO"/"n/a"), any claim under ${MIN_PROSE} characters, and a \`verification\` line that ` +
  `names no acceptance tier (L0–L4). Name the REAL registration + trigger site.`;

/** Render one step's own contract + criteria as a prompt block. '' when it declares none. */
export function stepContractBlock(spec: StepSpec, entity: LabEntity): string {
  const reqs = stepContractRequirements(spec, entity);
  const criteria = stepCriteriaLines(spec, entity).slice(0, MAX_CRITERIA_LINES);
  if (!reqs.length && !criteria.length) return '';

  const head = '# ACCEPTANCE CONTRACT FOR THIS STEP (you are graded against it)';
  const blocks: string[] = [];
  for (const r of reqs) {
    const lines = [
      `## Wiring contract — ${r.artifact}`,
      `- **Granted by**: ${r.grantedBy ?? '(undeclared — name it)'}`,
      `- **Activated by**: ${r.activatedBy ?? '(undeclared — name it)'}`,
      `- **Dependencies**: ${r.dependencies?.length ? r.dependencies.join(', ') : '(none)'}`,
      `- **Verification**: ${r.verification ?? '(undeclared — name it, with its L0–L4 tier)'}`,
    ].join('\n');
    blocks.push(lines);
  }
  if (criteria.length) {
    blocks.push(['## Authored criteria', ...criteria.map((c) => `- ${c}`)].join('\n'));
  }

  // Size cap: keep whole blocks while they fit; report honestly what was dropped.
  const kept: string[] = [];
  let used = head.length + CONTRACT_RULE.length;
  for (const b of blocks) {
    if (used + b.length + 4 > MAX_STEP_CONTRACT_CHARS) break;
    kept.push(b);
    used += b.length + 4;
  }
  const dropped = blocks.length - kept.length;
  if (!kept.length) return '';
  const tail = dropped > 0 ? `_(${dropped} further contract block(s) omitted — prompt size cap.)_` : '';
  return [head, ...kept, tail, CONTRACT_RULE].filter(Boolean).join('\n\n');
}

/**
 * Every contract-bearing step of a catalog, contracts only (the Director's ruling for
 * the recipe seam: a `GenerationRecipe` phase does not map onto a named pipeline step,
 * so the whole catalog's contracts are injected rather than guessing a mapping).
 */
export function catalogContractRequirements(
  pipeline: CatalogPipeline | null | undefined,
  entity: LabEntity,
): WiringRequirement[] {
  if (!pipeline) return [];
  const rows: WiringRequirement[] = [];
  for (const spec of pipeline.steps) {
    for (const r of stepContractRequirements(spec, entity)) {
      if (rows.length >= MAX_CATALOG_CONTRACT_ROWS) return rows;
      rows.push(r);
    }
  }
  return rows;
}

/** Every contract-bearing step's authored criteria, capped. */
export function catalogCriteriaLines(
  pipeline: CatalogPipeline | null | undefined,
  entity: LabEntity,
): string[] {
  if (!pipeline) return [];
  const lines: string[] = [];
  for (const spec of pipeline.steps) {
    for (const l of stepCriteriaLines(spec, entity)) {
      if (lines.length >= MAX_CRITERIA_LINES) return lines;
      lines.push(l);
    }
  }
  return lines;
}

/**
 * Which canon categories a step's Produce prompt carries.
 *
 * A step whose checker is a CONTENT INVARIANT (`isContentInvariant` — a wrong NUMBER
 * fails it) is graded against real thresholds, so it gets the FULL in-scope canon
 * (`undefined` = no category filter) instead of only its archetype's slice: the
 * threshold it will be measured by — tier power ≈100 ±10%, resists capped at 75%,
 * faucet/sink within ±15% — must be visible in the prompt that authors the number.
 * Shape-only steps keep the narrower `ARCHETYPE_CANON` slice (no token cost added).
 */
export function canonCategoriesForStep(spec: StepSpec): RuleCategory[] | undefined {
  return isContentInvariant(spec.accept) ? undefined : ARCHETYPE_CANON[spec.archetype];
}
