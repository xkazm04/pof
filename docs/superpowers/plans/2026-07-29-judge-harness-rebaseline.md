# Judge-Harness Fix and Rubric Re-Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove two measured instrumentation defects that depress every judged score for non-quality reasons, prove with a controlled A/B that removing them actually moves scores, and only then re-baseline the rubric so a "can this content reach R4" answer means something.

**Architecture:** Both fixes land as **pure, opt-in options** on existing pure modules, defaulting to today's behaviour — so grading is provably unchanged until we deliberately flip it. A no-DB-write A/B probe then measures old-arm vs new-arm on the same cells. Only if the delta is material do we flip the defaults, bump `RUBRIC_VERSION` 3→4 (which makes every v3 verdict provisional), re-run the calibration guard, and re-judge. This ordering exists because flipping first would silently invalidate 368 recorded verdicts with no evidence the change helps.

**Tech Stack:** TypeScript (strict), Vitest, `tsx` for scripts, better-sqlite3 (`~/.pof/pof.db`), Claude CLI headless as the judge.

## Global Constraints

- `RUBRIC_VERSION` is currently **3**. Bumping it makes every v3 verdict non-current: `isCurrentRubric` fails, so a v3 pass no longer manufactures a strict pass. **43 cells currently at ≥90 go provisional the moment it is bumped.**
- A v3 **fail** still condemns after the bump: `deriveCell` filters with `newestRubricVerdicts`, and v3 is the newest present until v4 verdicts exist. **The 185 blocked cells stay blocked until re-judged.** This is expected, not a regression.
- `src/lib/judge/calibration.ts` is the anti-drift anchor and **must be re-run whenever `RUBRIC_VERSION` changes**; the judge must agree with human labels on **≥85%** of the set.
- Judge draws are **sequential** — parallel draws trip the API rate wall.
- **The budget is rate limits, not money.** Work runs on the monthly Claude Code subscription, so dollar cost is not a gating factor; *session limits are*. The 2026-07-29 wave lost 7 of 10 agents to `session limit · resets 11:20pm`. Therefore: prefer **larger samples and more draws** for statistical confidence, but make every long run **resumable and chunked** so a limit reset costs one cell, never a stage. If limits bite mid-stage, pause and resume rather than restarting.
- **Avoid Gemini wherever an alternative exists.** This plan is Gemini-free by construction — `judge-content` (text-config) spawns the Claude CLI via `getModelPolicy`, and Gemini appears only in `src/lib/anim-critique/gemini.ts` (which has a drop-in Qwen seam, `anim-critique/qwen.ts`, same `(images, prompt) => Promise<string>` interface) and in L4 visual-gate *reason strings*. If any step here ever needs vision, use Qwen-VL first and Gemini only if Qwen fails.
- Pure modules stay pure: `src/lib/judge/*` takes JSON + args only, no I/O.
- No raw `console.*` in `src/` (use `@/lib/logger`); scripts under `scripts/` may write to stdout.
- Never weaken a checker, hand-edit artifact status, or fabricate a verdict.

## Measured baseline (facts this plan rests on)

| Fact | Value | Source |
|---|---|---|
| Artifacts carrying `produceDirection` | **240 / 816** | `SELECT COUNT(*) FROM pipeline_artifacts WHERE data LIKE '%produceDirection%'` |
| Leaked prompt size | avg **5,670** chars, max **8,983** | sampled `data.produceDirection.prompt` |
| Steps projecting EMPTY as siblings | **314 / 816** | `projectStep(data, 600)` returns `''` |
| Steps projecting <80 chars | **143** | same probe |
| Distinct judged cells | **432** | `judge_verdicts` |
| v3 verdicts / v3 cells ≥90 | **368 / 43** | `judge_verdicts` |

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/judge/payload.ts` *(create)* | The ONE list of non-content keys + `stripNonContent()`. Pure. Shared by both judge scripts so they cannot diverge. |
| `src/__tests__/lib/judge/payload.test.ts` *(create)* | Pins the strip set, including `produceDirection`. |
| `src/lib/judge/siblingContext.ts` *(modify: `projectStep`, lines 24-44)* | Gains opt-in bounded nested projection. |
| `src/__tests__/lib/judge/siblingContext.test.ts` *(modify)* | Existing test asserts nested is dropped — that pins the OLD default; add new-arm tests alongside. |
| `scripts/judge-run.ts` *(modify: `buildPayload`, line 157)* | Use `stripNonContent`; pass the projection option through. |
| `scripts/judge-one.ts` *(modify: ~line 66-81)* | Same strip for the `--text` path; same projection option. |
| `scripts/judge/ab-probe.ts` *(create)* | No-DB-write A/B harness measuring old vs new arm on the same cells. |
| `src/lib/judge/rubrics.ts` *(modify: line 17 + header)* | `RUBRIC_VERSION` 3→4 with a v4 rationale paragraph. Task 6 only. |

---

### Task 1: One shared non-content key list, with `produceDirection` in it

**Files:**
- Create: `src/lib/judge/payload.ts`
- Create: `src/__tests__/lib/judge/payload.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `NON_CONTENT_KEYS: ReadonlySet<string>` and `stripNonContent(data: Record<string, unknown>): Record<string, unknown>` — used by Tasks 2 and 3.

**Why:** `scripts/judge-run.ts:157` inlines `k === 'genHistory' || k === 'audioAssets' || k === '_provenance'`. It omits `produceDirection`, whose `.prompt` is the full ~5.7k-char generation instruction. The rubric separately penalises leaked prompt tokens, so the harness injects the defect it docks for.

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/lib/judge/payload.test.ts
import { describe, it, expect } from 'vitest';
import { NON_CONTENT_KEYS, stripNonContent } from '@/lib/judge/payload';

describe('stripNonContent', () => {
  it('removes the generation prompt so the judge cannot grade its own instructions', () => {
    const out = stripNonContent({
      brief: 'real content',
      produceDirection: { direction: '', prompt: 'You are a senior systems designer…' },
    });
    expect(out).toEqual({ brief: 'real content' });
  });

  it('removes the heavy media and provenance keys', () => {
    const out = stripNonContent({
      keep: 1,
      genHistory: { batches: [] },
      audioAssets: [{ url: 'x' }],
      _provenance: { model: 'x' },
    });
    expect(out).toEqual({ keep: 1 });
  });

  it('keeps every other key verbatim, including nested content objects', () => {
    const data = { rules: { a: { b: 2 } }, rarity: 'Unique', n: 0, flag: false, nil: null };
    expect(stripNonContent(data)).toEqual(data);
  });

  it('does not mutate its input', () => {
    const data = { keep: 1, produceDirection: { prompt: 'x' } };
    stripNonContent(data);
    expect(Object.keys(data)).toContain('produceDirection');
  });

  it('pins the strip set so a future key cannot be added silently', () => {
    expect([...NON_CONTENT_KEYS].sort()).toEqual(
      ['_provenance', 'audioAssets', 'genHistory', 'produceDirection'],
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/lib/judge/payload.test.ts`
Expected: FAIL — `Cannot find module '@/lib/judge/payload'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/judge/payload.ts
/**
 * What is NOT the asset — the single list both judge scripts strip before handing a config
 * to the judge.
 *
 * `produceDirection` is the load-bearing addition (2026-07-29): 240 of 816 artifacts carry
 * `{direction, prompt}` whose `prompt` is the full ~5.7k-char produce instruction ("You are a
 * senior systems designer at a AAA action-RPG studio…"). `judge-run.ts` copied every key it
 * did not explicitly strip, so that instruction was graded AS THE ASSET — while the rubric
 * separately penalises leaked engine/prompt tokens. The harness injected the defect it docked
 * for. It stays in the DB (it is real provenance); it never reaches the judge.
 */
export const NON_CONTENT_KEYS: ReadonlySet<string> = new Set([
  'genHistory',      // media candidate history — huge, and the image is judged separately
  'audioAssets',     // served audio refs, not judgeable text
  '_provenance',     // who produced it, not what was produced
  'produceDirection', // the generation prompt itself
]);

/** Copy of `data` without the non-content keys. Pure; never mutates the input. */
export function stripNonContent(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (NON_CONTENT_KEYS.has(k)) continue;
    out[k] = v;
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/lib/judge/payload.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/judge/payload.ts src/__tests__/lib/judge/payload.test.ts
git commit -m "feat(judge): single non-content key list, incl. produceDirection"
```

---

### Task 2: Opt-in bounded nested projection for sibling context

**Files:**
- Modify: `src/lib/judge/siblingContext.ts:24-73`
- Modify: `src/__tests__/lib/judge/siblingContext.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `projectStep(data, perStepChars, opts?: { includeNested?: boolean })` and `buildSiblingContext(steps, currentStep, opts?: { perStepChars?; totalChars?; includeNested? })`. `includeNested` defaults to **false** (today's behaviour). Task 4 exercises both arms; Task 6 flips the default.

**Why:** `projectStep` emits only `statHooks`/`crossReferences`/`crossReferenceValues` plus top-level scalars. A step whose content lives in one nested object — nearly every `rules` archetype — projects as `''`. Measured: **314/816 steps project empty, 143 more under 80 chars**. The judge is asked to verify cross-references against siblings it cannot see, so it reports them as invented.

**Default stays false in this task.** The existing test at line 24 asserts `not.toContain('nested not included')` — that pins the current contract, and flipping it is a grading change that Task 4 must justify first.

- [ ] **Step 1: Write the failing test**

Append to `src/__tests__/lib/judge/siblingContext.test.ts`:

```ts
describe('projectStep — nested projection (opt-in)', () => {
  const nestedOnly = { rules: { decayPerDay: 10, tiers: ['Revered', 'Exalted'] } };

  it('by default a nested-only step still projects empty (unchanged contract)', () => {
    expect(projectStep(nestedOnly, 600)).toBe('');
  });

  it('with includeNested the step becomes visible to the judge', () => {
    const out = projectStep(nestedOnly, 600, { includeNested: true });
    expect(out).toContain('rules=');
    expect(out).toContain('"decayPerDay":10');
  });

  it('still drops non-content keys even when including nested', () => {
    const out = projectStep(
      { genHistory: { batches: [1] }, produceDirection: { prompt: 'y' }, rules: { a: 1 } },
      600,
      { includeNested: true },
    );
    expect(out).not.toContain('genHistory');
    expect(out).not.toContain('produceDirection');
    expect(out).toContain('"a":1');
  });

  it('stays within the per-step budget with a huge nested object', () => {
    const big = { rules: Object.fromEntries(Array.from({ length: 400 }, (_, i) => [`k${i}`, i])) };
    const out = projectStep(big, 200, { includeNested: true });
    expect(out.length).toBeLessThanOrEqual(200);
  });

  it('buildSiblingContext threads the option and respects the total budget', () => {
    const steps = [
      { step: 'A', data: { rules: { x: 1 } } },
      { step: 'B', data: { rules: { y: 2 } } },
    ];
    expect(buildSiblingContext(steps, 'A')).toBe('');
    const on = buildSiblingContext(steps, 'A', { includeNested: true });
    expect(on).toContain('- B:');
    expect(on).toContain('"y":2');
    expect(buildSiblingContext(steps, 'A', { includeNested: true, totalChars: 10 }).length)
      .toBeLessThanOrEqual(80);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/lib/judge/siblingContext.test.ts`
Expected: FAIL — `projectStep` ignores the third argument, so the `includeNested` cases return `''`.

- [ ] **Step 3: Write minimal implementation**

Replace `projectStep` and `buildSiblingContext` in `src/lib/judge/siblingContext.ts`. Import the shared list and delete the local `HEAVY_KEYS`:

```ts
import { NON_CONTENT_KEYS } from './payload';

const PRIORITY_KEYS = ['statHooks', 'crossReferences', 'crossReferenceValues'];

function isScalar(v: unknown): boolean {
  return v === null || ['string', 'number', 'boolean'].includes(typeof v);
}

/** A compact projection of one step's config: priority blocks, then top-level scalars, then —
 *  when `includeNested` — the remaining nested objects/arrays, each capped so one fat step
 *  cannot eat the whole budget. Truncated to `perStepChars`. Pure. */
export function projectStep(
  data: Record<string, unknown>,
  perStepChars: number,
  opts: { includeNested?: boolean } = {},
): string {
  const parts: string[] = [];
  for (const k of PRIORITY_KEYS) {
    if (data[k] && typeof data[k] === 'object') parts.push(`${k}=${JSON.stringify(data[k])}`);
  }
  const scalars: Record<string, unknown> = {};
  const nested: string[] = [];
  // Per-key cap so a 400-field object cannot crowd out its siblings before truncation.
  const perKey = Math.max(40, Math.floor(perStepChars / 3));
  for (const [k, v] of Object.entries(data)) {
    if (NON_CONTENT_KEYS.has(k) || PRIORITY_KEYS.includes(k)) continue;
    if (isScalar(v)) scalars[k] = v;
    else if (Array.isArray(v) && v.length <= 8 && v.every(isScalar)) scalars[k] = v;
    else if (opts.includeNested && v && typeof v === 'object') {
      const j = JSON.stringify(v);
      nested.push(`${k}=${j.length > perKey ? j.slice(0, perKey - 1) + '…' : j}`);
    }
  }
  if (Object.keys(scalars).length) parts.push(JSON.stringify(scalars));
  parts.push(...nested);
  const s = parts.join(' ');
  return s.length > perStepChars ? s.slice(0, perStepChars - 1) + '…' : s;
}
```

Then thread the option through `buildSiblingContext` — change its signature and the `projectStep` call:

```ts
export function buildSiblingContext(
  steps: SiblingStep[],
  currentStep: string,
  opts: { perStepChars?: number; totalChars?: number; includeNested?: boolean } = {},
): string {
  const perStepChars = opts.perStepChars ?? 600;
  const totalChars = opts.totalChars ?? 6000;
  // …unchanged sort/loop…
    const proj = projectStep(s.data ?? {}, perStepChars, { includeNested: opts.includeNested });
  // …unchanged remainder…
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/lib/judge/siblingContext.test.ts`
Expected: PASS — including the pre-existing `'nested not included'` assertion, which proves the default is unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/lib/judge/siblingContext.ts src/__tests__/lib/judge/siblingContext.test.ts
git commit -m "feat(judge): opt-in bounded nested sibling projection (default off)"
```

---

### Task 3: Wire both judge scripts to the shared strip and the projection option

**Files:**
- Modify: `scripts/judge-run.ts:153-172` (`buildPayload`)
- Modify: `scripts/judge-one.ts` (`--text` payload path, ~line 66-81)

**Interfaces:**
- Consumes: `stripNonContent` (Task 1), `buildSiblingContext(..., { includeNested })` (Task 2).
- Produces: both scripts accept `--include-nested`, off by default. Task 4 drives them.

- [ ] **Step 1: Replace the inline strip in `judge-run.ts`**

In `buildPayload`, replace the `text-config` branch body:

```ts
  if (cls === 'text-config') {
    return { payload: '```json\n' + JSON.stringify(stripNonContent(d), null, 2) + '\n```' };
  }
```

Add the import at the top: `import { stripNonContent } from '../src/lib/judge/payload';`

- [ ] **Step 2: Thread `--include-nested` in `judge-run.ts`**

Where `buildSiblingContext` is called, pass the flag:

```ts
const includeNested = process.argv.includes('--include-nested');
// …
siblingContext = buildSiblingContext(steps, stepLabel, { includeNested }) || undefined;
```

- [ ] **Step 3: Apply the same strip to `judge-one.ts`'s `--text` path**

`--text` receives a `get-config` dump, which carries `produceDirection` too. Replace the `textFile` branch so a JSON file is stripped (a non-JSON file passes through unchanged):

```ts
      : textFile
        ? (() => {
            const raw = readFileSync(textFile, 'utf8').slice(0, 60000);
            try {
              const parsed = JSON.parse(raw) as Record<string, unknown>;
              return '```json\n' + JSON.stringify(stripNonContent(parsed), null, 2) + '\n```';
            } catch {
              return '```\n' + raw + '\n```'; // not JSON — judge it verbatim
            }
          })()
```

Add `import { stripNonContent } from '../src/lib/judge/payload';` and thread `includeNested` into its `buildSiblingContext` call exactly as in Step 2.

- [ ] **Step 4: Verify no behaviour change with the flag off**

Run: `npm run typecheck && npx vitest run src/__tests__/lib/judge/`
Expected: PASS. Then confirm the strip is live on a real contaminated artifact:

```bash
npx tsx scripts/get-config.ts --catalog currencies --entity currency-gold --step "Concept Brief" > /tmp/cfg.json
grep -c produceDirection /tmp/cfg.json   # expect >= 1 (the DB still has it)
```

- [ ] **Step 5: Commit**

```bash
git add scripts/judge-run.ts scripts/judge-one.ts
git commit -m "fix(judge): strip produceDirection from judged payloads; --include-nested flag"
```

---

### Task 4: A/B probe — measure whether the fixes actually move scores

**Files:**
- Create: `scripts/judge/ab-probe.ts`

**Interfaces:**
- Consumes: `stripNonContent`, `buildSiblingContext`, the model policy, the Claude CLI runner.
- Produces: a delta table + `ab-results.json`. **Writes nothing to `judge_verdicts`.**

**Why this task exists:** Task 5 flips a *deliberate, tested* contract and makes 43 currently-green cells provisional. That needs evidence, not a hypothesis — mine. This gate is **epistemic, not economic**: even with cost off the table, flipping a tested design decision because it seemed right in analysis is how you turn one wrong belief into 432 wrong verdicts. **If the delta is not material, STOP and report — do not bump the rubric.**

Because cost is not the constraint, run this **properly powered**: median-of-3 per arm, 20 cells, so a ±5-point single-draw variance cannot masquerade as a signal. Sequential; resumable if a session limit hits.

**Design:** for each sampled cell, run the judge twice at the same model/effort — arm A (current: no strip, no nested) and arm B (fixed: strip + nested) — on identical content. Sequential draws. Sample deliberately: cells **with** `produceDirection` and cells whose siblings project empty, plus clean controls.

- [ ] **Step 1: Write the probe**

```ts
// scripts/judge/ab-probe.ts
/**
 * A/B probe — does removing the two harness defects change judged scores?
 * Arm A = today's harness. Arm B = stripNonContent + includeNested. Same content, same
 * model/effort, sequential. Records NOTHING to judge_verdicts; this is measurement only.
 *
 *   npx tsx scripts/judge/ab-probe.ts --n 12 --draws 1
 */
import Database from 'better-sqlite3';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { buildRubricPrompt, parseJudgeResult } from '../../src/lib/judge/rubrics';
import { buildSiblingContext } from '../../src/lib/judge/siblingContext';
import { stripNonContent } from '../../src/lib/judge/payload';

const N = Number(process.argv[process.argv.indexOf('--n') + 1] ?? 12);
const DRAWS = Number(process.argv[process.argv.indexOf('--draws') + 1] ?? 1);

interface Cell { catalogId: string; entityId: string; step: string; data: Record<string, unknown>; }

function load(): { cells: Cell[]; siblings: Map<string, Cell[]> } {
  const db = new Database(join(homedir(), '.pof', 'pof.db'), { readonly: true });
  const rows = db.prepare('SELECT catalog_id,entity_id,step,data FROM pipeline_artifacts').all() as any[];
  db.close();
  const all: Cell[] = rows.map((r) => ({
    catalogId: r.catalog_id, entityId: r.entity_id, step: r.step,
    data: (() => { try { return JSON.parse(r.data); } catch { return {}; } })(),
  }));
  const siblings = new Map<string, Cell[]>();
  for (const c of all) {
    const k = `${c.catalogId}|${c.entityId}`;
    siblings.set(k, [...(siblings.get(k) ?? []), c]);
  }
  // Stratify: contaminated cells first, then empty-projection cells, then clean controls.
  const contaminated = all.filter((c) => 'produceDirection' in c.data);
  const rest = all.filter((c) => !('produceDirection' in c.data));
  const pick = [...contaminated.slice(0, Math.ceil(N / 2)), ...rest.slice(0, Math.floor(N / 2))];
  return { cells: pick.slice(0, N), siblings };
}

async function judge(cell: Cell, sibs: Cell[], fixed: boolean): Promise<number | null> {
  const data = fixed ? stripNonContent(cell.data) : cell.data;
  const steps = sibs.filter((s) => s.step !== cell.step).map((s) => ({ step: s.step, data: s.data }));
  const siblingContext = buildSiblingContext(steps, cell.step, { includeNested: fixed }) || undefined;
  const prompt = buildRubricPrompt('text-config', {
    subject: `${cell.catalogId} / ${cell.entityId} / ${cell.step}`,
    payload: '```json\n' + JSON.stringify(data, null, 2) + '\n```',
    siblingContext,
  });
  const { runClaudeJudge } = await import('./abRunner');
  const raw = await runClaudeJudge(prompt);
  return parseJudgeResult(raw)?.score ?? null;
}

async function main() {
  const { cells, siblings } = load();
  const out: any[] = [];
  for (const c of cells) {
    const sibs = siblings.get(`${c.catalogId}|${c.entityId}`) ?? [];
    const a: number[] = [], b: number[] = [];
    for (let i = 0; i < DRAWS; i++) { const s = await judge(c, sibs, false); if (s != null) a.push(s); }
    for (let i = 0; i < DRAWS; i++) { const s = await judge(c, sibs, true);  if (s != null) b.push(s); }
    const med = (xs: number[]) => (xs.length ? [...xs].sort((x, y) => x - y)[Math.floor(xs.length / 2)] : null);
    const row = {
      cell: `${c.catalogId}::${c.step}`,
      contaminated: 'produceDirection' in c.data,
      armA: med(a), armB: med(b),
      delta: med(a) != null && med(b) != null ? (med(b)! - med(a)!) : null,
    };
    out.push(row);
    process.stdout.write(`${row.cell.padEnd(44)} A=${row.armA} B=${row.armB} Δ=${row.delta}\n`);
  }
  const deltas = out.map((r) => r.delta).filter((d): d is number => d != null);
  const mean = deltas.reduce((x, y) => x + y, 0) / (deltas.length || 1);
  process.stdout.write(`\nmean delta (B - A): ${mean.toFixed(1)} over ${deltas.length} cells\n`);
  writeFileSync('ab-results.json', JSON.stringify({ mean, rows: out }, null, 2));
}
main();
```

- [ ] **Step 2: Extract the CLI runner so the probe and `judge-run` share one spawn**

Create `scripts/judge/abRunner.ts` exporting `runClaudeJudge(prompt: string): Promise<string>` — copy the `runClaude` spawn from `scripts/judge-run.ts` (same `-p - --model … --effort … --output-format json --dangerously-skip-permissions`, same `getModelPolicy('judge-content')`), returning the raw text. Keep the spend recording.

- [ ] **Step 3: Dry-run on 2 cells, 1 draw**

Run: `npx tsx scripts/judge/ab-probe.ts --n 2 --draws 1`
Expected: two rows with numeric `A=` and `B=`. 4 draws — smoke test only.

- [ ] **Step 4: Run the real probe, properly powered**

Run: `npx tsx scripts/judge/ab-probe.ts --n 20 --draws 3`
120 sequential draws (20 cells × 2 arms × median-of-3). Median-of-3 per arm is what makes the delta trustworthy — the judge's single-draw variance is ±5, so a 1-draw arm cannot distinguish a real 4-point shift from noise.

**Resumability:** the probe appends each completed cell to `ab-results.json` and skips cells already present on restart, so a session limit costs one cell. If a limit hits, wait for reset and re-run the identical command.

**Decision gate — report to the user before continuing:**
- **mean Δ ≥ +3** → the harness was suppressing scores. Proceed to Task 5.
- **|mean Δ| < 3** → the defects are real but not score-moving. **Stop.** Land Tasks 1-3 as correctness fixes, do NOT bump the rubric, and record that the plateau is technique after all.
- **mean Δ ≤ −3** → the nested projection is hurting (more context → more contradictions found). Land Task 1 only; leave `includeNested` off and say so.

- [ ] **Step 5: Commit**

```bash
git add scripts/judge/ab-probe.ts scripts/judge/abRunner.ts ab-results.json
git commit -m "test(judge): A/B probe measuring harness-defect impact on scores"
```

---

### Task 5: Flip the defaults and bump `RUBRIC_VERSION` to 4

**Do not start this task until Task 4's gate says proceed.**

**Files:**
- Modify: `src/lib/judge/siblingContext.ts` (default `includeNested` to true)
- Modify: `src/__tests__/lib/judge/siblingContext.test.ts` (retire the old-default assertions)
- Modify: `src/lib/judge/rubrics.ts:17` and its header comment

**Interfaces:**
- Consumes: Task 4's `ab-results.json`.
- Produces: `RUBRIC_VERSION = 4`.

- [ ] **Step 1: Update the tests to the new contract**

In `src/__tests__/lib/judge/siblingContext.test.ts`, change the line-24 assertion from `expect(out).not.toContain('nested not included')` to `expect(out).toContain('nested not included')`, and in the Task-2 block change *"by default a nested-only step still projects empty"* to assert it is now visible:

```ts
  it('a nested-only step is visible by default (v4 contract)', () => {
    expect(projectStep(nestedOnly, 600)).toContain('"decayPerDay":10');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/lib/judge/siblingContext.test.ts`
Expected: FAIL — default is still `false`.

- [ ] **Step 3: Flip the default and bump the version**

In `projectStep`, default the option: `opts: { includeNested?: boolean } = { includeNested: true }` — and in `buildSiblingContext` resolve `const includeNested = opts.includeNested ?? true;`, passing that down.

In `src/lib/judge/rubrics.ts` set `export const RUBRIC_VERSION = 4;` and append to the header comment:

```
 * v4 = v3 with the judge HARNESS corrected. Two measured defects made v3 scores
 * non-comparable: (a) `produceDirection` (240/816 artifacts) put the full ~5.7k-char generation
 * prompt INSIDE the judged payload, while the rubric penalises leaked prompt tokens; (b) the
 * sibling projection emitted only scalars, so 314/816 steps projected EMPTY and the judge
 * reported cross-references it could not see as invented. The contract text is unchanged — the
 * INPUT is. Every v3 verdict is therefore provisional until re-judged.
```

- [ ] **Step 4: Run the full judge suite**

Run: `npx vitest run src/__tests__/lib/judge/ && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Re-run the calibration guard**

Run: `npx vitest run src/__tests__/lib/judge/calibration.test.ts` (or the guard named in `src/lib/judge/calibration.ts`)
Expected: PASS at **≥85%** agreement, or SKIP while the v4 calibration targets are unscored. If it FAILS, the rubric wording drifted — fix that before any re-judging.

- [ ] **Step 6: Commit**

```bash
git add src/lib/judge/siblingContext.ts src/__tests__/lib/judge/siblingContext.test.ts src/lib/judge/rubrics.ts
git commit -m "feat(judge)!: rubric v4 — corrected harness input (strip prompt, show nested siblings)"
```

---

### Task 6: Re-judge under v4, then re-run the fleet in two stages

**Files:**
- Modify: `.claude/green-loop/state.md` (append the v4 baseline)
- Modify: `src/lib/status/ceiling-facts.json` (only for cells that stay capped under v4)

**Interfaces:**
- Consumes: `scripts/readiness/inventory.ts`, `scripts/judge-run.ts`.
- Produces: a v4 baseline the ladder can be trusted against.

- [ ] **Step 1: Snapshot the pre-v4 ladder**

Run: `npx tsx scripts/readiness/inventory.ts --json > v3-baseline.json`
Expected: `R5 7 · R4 26 · R3 64 · R2 9 · R1 15 · R0 0 · waiting 38 · blocked 185`.

- [ ] **Step 2: Re-judge a 20-cell stratified sample under v4 — NOT all 432**

Pick 20 cells spanning the v3 score range (some ≥90, some 85-89, some <70). Run **sequentially**:

```bash
POF_JUDGE_ORIGIN=http://localhost:3007 \
  npx tsx scripts/judge-run.ts --catalog <id> --step "<step>" --entity <eid> --median 3
```

Cost: 60 draws ≈ **$16**. Compare v4 vs v3 per cell. This is the second decision gate: if the 43 previously-green cells do not return to ≥90 under v4, the re-baseline has changed the bar rather than corrected it — stop and report.

- [ ] **Step 3: Re-judge the remaining cells**

Only after Step 2 confirms the bar is intact. 412 cells × 3 draws ≈ 1,236 draws ≈ **$320**. Run as the driver-owned **Stage B** from the readiness-loop skill — resumable, one cell at a time, never held open inside an authoring agent.

- [ ] **Step 4: Re-run the authoring fleet (Stage A only)**

Dispatch ≤10 Opus agents per `.claude/skills/readiness-loop/SKILL.md`, with the fixes now in place:
- per-agent scratchpad namespacing (`cfg-<catalog>/`)
- agents author and stop; they do **not** run official medians
- baseline `updated_at` stamped per cell so a rewritten artifact is not compared to a stale score

- [ ] **Step 5: Measure, then record only what survives**

Run: `npx tsx scripts/readiness/inventory.ts --json > v4-after.json` and diff against `v3-baseline.json` rung-by-rung.

For every cell still below R4 under the corrected harness, add a `ceiling-facts.json` entry classed `technique` — **now** justified, because the instrumentation confound has been removed. Cells that moved need no entry.

- [ ] **Step 6: Commit**

```bash
git add src/lib/status/ceiling-facts.json .claude/green-loop/state.md
git commit -m "chore(judge): v4 re-baseline results and surviving technique ceilings"
```

---

## Sequencing and rate-limit budget

Cost is not the constraint; **session limits are**. Draw counts below are the rate-limit exposure, and every multi-draw stage must be resumable so a reset costs one cell rather than a stage.

| Task | Draws | Rate-limit risk | Gate |
|---|---|---|---|
| 1-3 fixes | 0 | none | pure code + tests |
| 4 A/B probe | 120 | one session | **decides whether to continue at all** |
| 5 rubric bump | 0 | none | calibration ≥85% |
| 6 Step 2 sample | 60 | one session | 43 green cells must return to ≥90 |
| 6 Step 3 full | ~1,236 | **multi-session — chunk it** | only after both gates |

Task 6 Step 3 will not fit in one session. Run it as the driver-owned resumable Stage B, catalog by catalog, and treat a limit reset as a pause. Never hold a median-of-3 run open inside an authoring agent — that is exactly how the 2026-07-29 wave lost 7 agents' verdicts.

## Self-Review

**Spec coverage:** produceDirection leak → Tasks 1, 3. Sibling projection → Tasks 2, 3. Re-baseline → Task 5. Re-run fleet → Task 6. Fleet-harness fixes (scratchpad, two-stage judging) already landed in `readiness-loop/SKILL.md` and are referenced in Task 6 Step 4.

**Placeholder scan:** none — every code step carries real code; the one prose-only step (Task 4 Step 2) names the exact function, flags and source to copy.

**Type consistency:** `stripNonContent(data: Record<string, unknown>): Record<string, unknown>` and `NON_CONTENT_KEYS: ReadonlySet<string>` are used identically in Tasks 1, 2, 3, 4. `projectStep(data, perStepChars, opts?)` and `buildSiblingContext(steps, currentStep, opts?)` keep one signature across Tasks 2, 3, 4, 5.

**Known risk:** Task 5 flips a *tested, deliberate* contract (`'nested not included'`). That is why Task 4's gate is mandatory — without a measured delta, the flip is unjustified.
