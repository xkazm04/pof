# Generation Quality (CLI #1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Encode the vertical-slice initiative's hard-won UE lessons into PoF's prompt/generation machinery so future autonomous runs produce wired, runnable-out-of-the-box C++/Python on first generation.

**Architecture:** A new `src/lib/knowledge/` data module holds UE pitfalls + a binary-content tripwire, filtered by a `PromptKind`. The shared context header (`buildProjectContextHeader`) injects them for UE prompts. `PromptBuilder` gains a `## Wiring Requirements` section. The evaluator gains a module-agnostic "Pass 0 — Ground Truth" pass. `feature-definitions.ts` gains `MODULE_WIRING_ASSETS` + helpers, surfaced as a "needs binary content" badge in `FeatureMatrix`. Every change is additive and default-on for UE prompts only.

**Tech Stack:** TypeScript, Next.js 16 / React 19, Zustand, Vitest. Conventions: `@/` imports, no hardcoded hex (`@/lib/chart-colors`), `npm run validate` (typecheck + lint + test) is the green gate.

**Spec:** `docs/superpowers/specs/2026-05-23-generation-quality-design.md`

**Scope guard (do NOT touch):** No UE-project (`pof-exp`) files. No `game.md` conventions. No LRU-suspend / dispatch work (CLI #8). Only PoF `src/` + `src/__tests__/`.

---

## File Structure

**New files:**
- `src/lib/knowledge/types.ts` — the `PromptKind` union (single source of truth).
- `src/lib/knowledge/ue-gotchas.ts` — `Gotcha` interface, `UE_GOTCHAS` data, `formatGotchas(kind)`.
- `src/lib/knowledge/binary-content.ts` — `BINARY_CONTENT_TRIPWIRE`, `formatBinaryContentTripwire(kind)`.
- `src/__tests__/knowledge/ue-gotchas.test.ts`
- `src/__tests__/knowledge/binary-content.test.ts`
- `src/__tests__/prompts/context-injection.test.ts`
- `src/__tests__/prompts/wiring-section.test.ts`
- `src/__tests__/evaluator/ground-truth-pass.test.ts`
- `src/__tests__/lib/feature-definitions-wiring.test.ts`

**Modified files:**
- `src/lib/prompt-context.ts` — `ContextHeaderOptions.promptKind`; UE branch appends gotchas + tripwire.
- `src/lib/prompts/prompt-builder.ts` — `WiringRequirement`, `withWiringRequirements()`, section insertion, `audit()` entry.
- `src/lib/evaluator/module-eval-prompts.ts` — `'ground-truth'` pass.
- `src/components/modules/core-engine/ScanTab.tsx` — extend two exhaustive `Record<EvalPass, …>` literals.
- `src/lib/feature-definitions.ts` — `WiringAsset`, `MODULE_WIRING_ASSETS`, `getWiringAssets`, `moduleNeedsBinaryContent`.
- `src/components/modules/shared/FeatureMatrix.tsx` — "needs binary content" badge.

---

## Task 1: Knowledge module — `PromptKind` + UE gotchas

**Files:**
- Create: `src/lib/knowledge/types.ts`
- Create: `src/lib/knowledge/ue-gotchas.ts`
- Test: `src/__tests__/knowledge/ue-gotchas.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/knowledge/ue-gotchas.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { UE_GOTCHAS, formatGotchas } from '@/lib/knowledge/ue-gotchas';
import type { PromptKind } from '@/lib/knowledge/types';

const VALID_KINDS: PromptKind[] = ['ue-cpp', 'ue-python', 'packaging', 'web'];

describe('UE_GOTCHAS data integrity', () => {
  it('has at least the seven seeded gotchas', () => {
    expect(UE_GOTCHAS.length).toBeGreaterThanOrEqual(7);
  });

  it('every gotcha has non-empty fields and a valid appliesTo', () => {
    for (const g of UE_GOTCHAS) {
      expect(g.id, 'id').toBeTruthy();
      expect(g.summary, `summary for ${g.id}`).toBeTruthy();
      expect(g.detail, `detail for ${g.id}`).toBeTruthy();
      expect(g.source, `source for ${g.id}`).toBeTruthy();
      expect(g.appliesTo.length, `appliesTo for ${g.id}`).toBeGreaterThan(0);
      for (const k of g.appliesTo) expect(VALID_KINDS).toContain(k);
    }
  });

  it('has unique ids', () => {
    const ids = UE_GOTCHAS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('formatGotchas', () => {
  it('renders a Known UE Pitfalls block for ue-cpp including the cpp gotchas', () => {
    const out = formatGotchas('ue-cpp');
    expect(out).toContain('## Known UE Pitfalls');
    expect(out).toContain('RebuildWidget');
    expect(out).toContain('WITH_EDITOR');
  });

  it('excludes python-only gotchas from the ue-cpp block', () => {
    expect(formatGotchas('ue-cpp')).not.toContain('Constant3Vector');
  });

  it('includes python gotchas for ue-python', () => {
    expect(formatGotchas('ue-python')).toContain('Constant3Vector');
  });

  it('returns an empty string for web', () => {
    expect(formatGotchas('web')).toBe('');
  });

  it('snapshot of the ue-cpp block', () => {
    expect(formatGotchas('ue-cpp')).toMatchSnapshot();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/__tests__/knowledge/ue-gotchas.test.ts`
Expected: FAIL — cannot resolve `@/lib/knowledge/ue-gotchas` / `@/lib/knowledge/types`.

- [ ] **Step 3: Create the `PromptKind` type**

Create `src/lib/knowledge/types.ts`:

```ts
/**
 * The kind of prompt being assembled. Drives which UE gotchas + tripwires
 * are injected into the shared context header.
 */
export type PromptKind = 'ue-cpp' | 'ue-python' | 'packaging' | 'web';
```

- [ ] **Step 4: Create the gotchas data + formatter**

Create `src/lib/knowledge/ue-gotchas.ts`:

```ts
import type { PromptKind } from './types';

/**
 * A hard-won UE pitfall from the vertical-slice initiative. Each is filtered
 * into prompts by `appliesTo` so a prompt only carries the lessons it can hit.
 */
export interface Gotcha {
  id: string;
  summary: string;
  detail: string;
  appliesTo: PromptKind[];
  source: string;
}

export const UE_GOTCHAS: Gotcha[] = [
  {
    id: 'material-const3vector-pin',
    summary: 'Constant3Vector output pin is "" not "RGB"',
    detail:
      'A MaterialExpressionConstant3Vector exposes its output on pin "" — connect_material_property(node, "RGB", ...) silently returns false and yields a black material. Use the empty-string pin name.',
    appliesTo: ['ue-python'],
    source: 'vertical-slice: materials',
  },
  {
    id: 'umg-rebuildwidget-timing',
    summary: 'a code-only UUserWidget builds its Slate tree in RebuildWidget(), not NativeConstruct()',
    detail:
      'A C++-only UUserWidget with no UMG asset must construct its widget hierarchy by overriding RebuildWidget(); NativeConstruct() runs too late and the tree is empty. BindWidget members still require a WBP.',
    appliesTo: ['ue-cpp'],
    source: 'vertical-slice: HUD',
  },
  {
    id: 'cmd-quote-wrap',
    summary: 'cmd.exe /c with an embedded quoted command needs windowsVerbatimArguments + an outer-quote wrap',
    detail:
      'Spawning cmd.exe /c "<command with its own quotes>" on Windows requires windowsVerbatimArguments: true AND wrapping the whole command in an extra pair of outer quotes, or the inner quotes are stripped.',
    appliesTo: ['packaging'],
    source: 'vertical-slice: packaging',
  },
  {
    id: 'interchange-fbx-commandlet-crash',
    summary: 'UE 5.7 FBX import via Interchange crashes under -run=pythonscript',
    detail:
      'The Interchange FBX path crashes in the pythonscript commandlet. Import FBX with the full editor via UnrealEditor.exe -ExecutePythonScript= instead of -run=pythonscript.',
    appliesTo: ['ue-python'],
    source: 'vertical-slice: characters',
  },
  {
    id: 'runtime-module-editor-api',
    summary: 'a Runtime module touching FEditorDelegates/GEditor/FAssetTools must be #if WITH_EDITOR-guarded',
    detail:
      'Editor-only symbols (FEditorDelegates, GEditor, FAssetTools) referenced from a Runtime module break the Shipping build. Guard them with #if WITH_EDITOR or move them to an Editor module.',
    appliesTo: ['ue-cpp'],
    source: 'vertical-slice: characters',
  },
  {
    id: 'plugin-content-rescan',
    summary: 'newly-enabled engine-plugin content needs an asset-registry rescan',
    detail:
      'After enabling an engine plugin that ships content (e.g. MoverTests), its assets are invisible until the asset registry rescans the mounted path under -run=pythonscript. Trigger a scan before referencing the assets.',
    appliesTo: ['ue-python'],
    source: 'vertical-slice: harness',
  },
  {
    id: 'fbx-import-scale',
    summary: 'metre-authored FBX: Blender apply_unit_scale=True + UE import_uniform_scale=1.0',
    detail:
      'For meshes authored in metres, export from Blender with apply_unit_scale=True and import into UE with import_uniform_scale = 1.0 (not 100), or the mesh is 100x off.',
    appliesTo: ['ue-python'],
    source: 'vertical-slice: characters',
  },
];

/**
 * Render the gotchas whose `appliesTo` includes `kind` as a markdown
 * `## Known UE Pitfalls` block. Returns '' for `web` or when none match.
 */
export function formatGotchas(kind: PromptKind): string {
  if (kind === 'web') return '';
  const relevant = UE_GOTCHAS.filter((g) => g.appliesTo.includes(kind));
  if (relevant.length === 0) return '';
  const lines = relevant.map((g) => `- **${g.summary}** — ${g.detail} (${g.source})`);
  return `## Known UE Pitfalls\n${lines.join('\n')}`;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/__tests__/knowledge/ue-gotchas.test.ts`
Expected: PASS (snapshot written on first run).

- [ ] **Step 6: Commit**

```bash
git add src/lib/knowledge/types.ts src/lib/knowledge/ue-gotchas.ts src/__tests__/knowledge/ue-gotchas.test.ts
git commit -m "feat(knowledge): UE gotchas pack with promptKind filtering"
```

---

## Task 2: Knowledge module — binary-content tripwire

**Files:**
- Create: `src/lib/knowledge/binary-content.ts`
- Test: `src/__tests__/knowledge/binary-content.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/knowledge/binary-content.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { BINARY_CONTENT_TRIPWIRE, formatBinaryContentTripwire } from '@/lib/knowledge/binary-content';

describe('binary content tripwire', () => {
  it('names the six asset categories that cannot be authored from text', () => {
    const t = BINARY_CONTENT_TRIPWIRE.toLowerCase();
    expect(t).toContain('widget blueprint');
    expect(t).toContain('animation blueprint');
    expect(t).toContain('.umap');
    expect(t).toContain('behavior tree');
    expect(t).toContain('material function');
    expect(t).toContain('skeletal mesh');
  });

  it('tells the model to declare the dependency in Wiring Requirements', () => {
    expect(BINARY_CONTENT_TRIPWIRE).toContain('Wiring Requirements');
  });

  it('returns the tripwire for every UE kind', () => {
    expect(formatBinaryContentTripwire('ue-cpp')).toBe(BINARY_CONTENT_TRIPWIRE);
    expect(formatBinaryContentTripwire('ue-python')).toBe(BINARY_CONTENT_TRIPWIRE);
    expect(formatBinaryContentTripwire('packaging')).toBe(BINARY_CONTENT_TRIPWIRE);
  });

  it('returns an empty string for web', () => {
    expect(formatBinaryContentTripwire('web')).toBe('');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/__tests__/knowledge/binary-content.test.ts`
Expected: FAIL — cannot resolve `@/lib/knowledge/binary-content`.

- [ ] **Step 3: Create the tripwire**

Create `src/lib/knowledge/binary-content.ts`:

```ts
import type { PromptKind } from './types';

export const BINARY_CONTENT_TRIPWIRE = `## Binary Content Wall
These asset types CANNOT be authored from Python or text — they require the editor's graph/asset tooling:
- Widget Blueprint (WBP) — UMG visual tree; a BindWidget C++ base still needs the WBP
- Animation Blueprint (ABP) — AnimGraph / state machine
- Level (.umap) — placed actors, lighting, navigation
- Behavior Tree graph — task/decorator/service wiring
- Material Function graph — node network
- Skeletal mesh / skeleton — rig and bind pose
If your solution depends on one of these, declare it in Wiring Requirements and prefer a pure-C++ pattern where one exists (e.g. build the Slate tree in RebuildWidget instead of a WBP).`;

/**
 * Returns the binary-content tripwire for UE prompt kinds, '' for web.
 */
export function formatBinaryContentTripwire(kind: PromptKind): string {
  if (kind === 'web') return '';
  return BINARY_CONTENT_TRIPWIRE;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/__tests__/knowledge/binary-content.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/knowledge/binary-content.ts src/__tests__/knowledge/binary-content.test.ts
git commit -m "feat(knowledge): binary-content tripwire"
```

---

## Task 3: Inject gotchas + tripwire into the context header

**Files:**
- Modify: `src/lib/prompt-context.ts` (interface ~231-240; UE branch ~310-376)
- Test: `src/__tests__/prompts/context-injection.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/prompts/context-injection.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildProjectContextHeader, type ProjectContext } from '@/lib/prompt-context';

const ueCtx: ProjectContext = {
  projectName: 'PoF',
  projectPath: 'C:\\proj',
  ueVersion: '5.7.3',
};

const webCtx: ProjectContext = {
  projectName: 'WebApp',
  projectPath: 'C:\\web',
  ueVersion: '5.7.3',
  dynamicContext: {
    scannedAt: '',
    projectType: 'nextjs',
    classes: [],
    plugins: [],
    buildDependencies: [],
    sourceFileCount: 0,
  },
};

describe('context header gotcha + tripwire injection', () => {
  it('injects pitfalls and the tripwire for ue-cpp (the default)', () => {
    const h = buildProjectContextHeader(ueCtx);
    expect(h).toContain('## Known UE Pitfalls');
    expect(h).toContain('Widget Blueprint');
  });

  it('respects an explicit promptKind of ue-python', () => {
    const h = buildProjectContextHeader(ueCtx, { promptKind: 'ue-python' });
    expect(h).toContain('Constant3Vector');
  });

  it('omits both for a web project', () => {
    const h = buildProjectContextHeader(webCtx);
    expect(h).not.toContain('Known UE Pitfalls');
    expect(h).not.toContain('Widget Blueprint');
  });

  it('omits both when promptKind is web on a UE project', () => {
    const h = buildProjectContextHeader(ueCtx, { promptKind: 'web' });
    expect(h).not.toContain('Known UE Pitfalls');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/__tests__/prompts/context-injection.test.ts`
Expected: FAIL — header does not contain `## Known UE Pitfalls`.

- [ ] **Step 3: Add imports to `prompt-context.ts`**

In `src/lib/prompt-context.ts`, after the existing import block (after line 10, `import type { ErrorContextEntry } from '@/types/error-memory';`), add:

```ts
import type { PromptKind } from '@/lib/knowledge/types';
import { formatGotchas } from '@/lib/knowledge/ue-gotchas';
import { formatBinaryContentTripwire } from '@/lib/knowledge/binary-content';
```

- [ ] **Step 4: Extend `ContextHeaderOptions`**

In `src/lib/prompt-context.ts`, the `ContextHeaderOptions` interface (currently lines ~231-240) — add the `promptKind` field:

```ts
interface ContextHeaderOptions {
  /** Include the build command section (default: true) */
  includeBuildCommand?: boolean;
  /** Include the full rules block (default: true) */
  includeRules?: boolean;
  /** Extra rules to append after the standard ones */
  extraRules?: string[];
  /** Past build errors relevant to this task — injected as warnings */
  errorMemory?: ErrorContextEntry[];
  /** The kind of prompt — drives which UE pitfalls + tripwire are injected (default: 'ue-cpp' in the UE branch) */
  promptKind?: PromptKind;
}
```

- [ ] **Step 5: Inject in the UE branch**

In `buildProjectContextHeader()`, the UE-branch destructure (currently lines ~319-324) — add `promptKind`:

```ts
  const {
    includeBuildCommand = true,
    includeRules = true,
    extraRules = [],
    errorMemory = [],
    promptKind = 'ue-cpp',
  } = opts;
```

Then, at the very end of `buildProjectContextHeader()` — immediately before the final `return header;` (currently line 375) — append:

```ts
  const gotchas = formatGotchas(promptKind);
  if (gotchas) header += `\n\n${gotchas}`;

  const tripwire = formatBinaryContentTripwire(promptKind);
  if (tripwire) header += `\n\n${tripwire}`;

  return header;
```

(Replace the existing bare `return header;` at the end of the UE branch with the block above. The web branch `buildWebAppContextHeader` is left unchanged — it never references `promptKind`.)

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run src/__tests__/prompts/context-injection.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/prompt-context.ts src/__tests__/prompts/context-injection.test.ts
git commit -m "feat(prompts): inject UE gotchas + binary-content tripwire into context header"
```

---

## Task 4: Wiring Requirements section in `PromptBuilder`

**Files:**
- Modify: `src/lib/prompts/prompt-builder.ts`
- Test: `src/__tests__/prompts/wiring-section.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/prompts/wiring-section.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { PromptBuilder } from '@/lib/prompts/prompt-builder';
import type { ProjectContext } from '@/lib/prompt-context';

const ctx: ProjectContext = {
  projectName: 'PoF',
  projectPath: 'C:\\proj',
  ueVersion: '5.7.3',
};

function buildUEPrompt() {
  return new PromptBuilder()
    .withProjectContext(ctx)
    .withTask('Add a melee ability', 'Create GA_MeleeAttack.')
    .withWiringRequirements([])
    .withOutputSchema('Return JSON.');
}

describe('Wiring Requirements section', () => {
  it('emits the heading and the four sub-prompts even with an empty reqs array', () => {
    const out = buildUEPrompt().build();
    const lower = out.toLowerCase();
    expect(out).toContain('## Wiring Requirements');
    expect(lower).toContain('grant');
    expect(lower).toContain('activat');
    expect(lower).toContain('depend');
    expect(lower).toContain('verif');
  });

  it('includes a wiring output-schema field instruction', () => {
    expect(buildUEPrompt().build()).toContain('`wiring`');
  });

  it('renders known requirements as a table when provided', () => {
    const out = new PromptBuilder()
      .withProjectContext(ctx)
      .withTask('t', 'b')
      .withWiringRequirements([
        {
          artifact: 'GA_MeleeAttack',
          grantedBy: 'ASC on character',
          activatedBy: 'IA_PrimaryAttack',
          dependencies: ['AM_MeleeCombo'],
          verification: 'attack plays on click',
        },
      ])
      .build();
    expect(out).toContain('GA_MeleeAttack');
    expect(out).toContain('IA_PrimaryAttack');
  });

  it('inserts the section between task instructions and best practices', () => {
    const out = new PromptBuilder()
      .withProjectContext(ctx)
      .withTask('TASKTITLE', 'body')
      .withWiringRequirements([])
      .withBestPractices(['BPPRACTICE'])
      .build();
    const taskIdx = out.indexOf('TASKTITLE');
    const wiringIdx = out.indexOf('## Wiring Requirements');
    const bpIdx = out.indexOf('BPPRACTICE');
    expect(taskIdx).toBeLessThan(wiringIdx);
    expect(wiringIdx).toBeLessThan(bpIdx);
  });

  it('audit() reports the wiringRequirements section presence', () => {
    const entry = buildUEPrompt().audit().find((a) => a.section === 'wiringRequirements');
    expect(entry?.present).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/__tests__/prompts/wiring-section.test.ts`
Expected: FAIL — `withWiringRequirements` is not a function.

- [ ] **Step 3: Add the `WiringRequirement` interface + `PromptSections` field**

In `src/lib/prompts/prompt-builder.ts`, after the `PromptSections` interface (after line 37, the closing `}`), add the new interface:

```ts
export interface WiringRequirement {
  artifact: string;
  grantedBy?: string;
  activatedBy?: string;
  dependencies?: string[];
  verification?: string;
}
```

And add the new section to `PromptSections` — insert after the `taskInstructions` line (line 30) so it reads:

```ts
  /** Section 3 — always required. The actual task. */
  taskInstructions: string;
  /** Section 3.5 — how each generated artifact must be wired to run. */
  wiringRequirements: string | null;
  /** Section 4 — UE5 best practices, tips, gotchas. */
  bestPractices: string | null;
```

- [ ] **Step 4: Add the private field**

In the `PromptBuilder` class, after `private _taskInstructions: string | null = null;` (line 44), add:

```ts
  private _wiringRequirements: string | null = null;
```

- [ ] **Step 5: Add the `withWiringRequirements` method**

In `src/lib/prompts/prompt-builder.ts`, add this method immediately after `withRawTask()` (after its closing `}` at line 97):

```ts
  /**
   * Set the Wiring Requirements section. Always emits the four wiring sub-prompts
   * (granting, activation, dependencies, verification) plus the `wiring` output
   * field instruction — even with an empty array. When `reqs` is non-empty, the
   * known hints are rendered as a table.
   */
  withWiringRequirements(reqs: WiringRequirement[] = []): this {
    const lines: string[] = ['## Wiring Requirements'];
    lines.push('For EVERY artifact you generate, make it runnable out-of-the-box — do not stop at "it compiles":');
    lines.push('- **Granting / registration**: state how the artifact is granted or registered (ability granted to the ASC, GameMode class set, IMC added to the input subsystem, component added to the actor).');
    lines.push('- **Activation**: state what triggers it at runtime (input action, gameplay event, BeginPlay, overlap).');
    lines.push('- **Dependencies**: list the companion assets it needs and FLAG any binary-content dependency (Widget/Animation Blueprint, Behavior Tree, .umap) that cannot be authored from code.');
    lines.push('- **Verification**: give ONE observable check that proves the wiring works (a log line, an on-screen value, a functional-test assertion).');
    lines.push('In your output, include a `wiring` field for each generated artifact summarizing the four points above.');

    if (reqs.length > 0) {
      lines.push('');
      lines.push('Known wiring for this task:');
      lines.push('| Artifact | Granted by | Activated by | Dependencies | Verify |');
      lines.push('| --- | --- | --- | --- | --- |');
      for (const r of reqs) {
        const deps = (r.dependencies ?? []).join(', ') || '—';
        lines.push(`| ${r.artifact} | ${r.grantedBy ?? '—'} | ${r.activatedBy ?? '—'} | ${deps} | ${r.verification ?? '—'} |`);
      }
    }

    this._wiringRequirements = lines.join('\n');
    return this;
  }
```

- [ ] **Step 6: Insert into `build()` and `audit()`**

In `build()`, immediately after `parts.push(this._taskInstructions);` (line 164), add:

```ts
    if (this._wiringRequirements) {
      parts.push(this._wiringRequirements);
    }
```

In `audit()`, add the entry right after the `taskInstructions` entry (after line 188):

```ts
      { section: 'taskInstructions', present: !!this._taskInstructions },
      { section: 'wiringRequirements', present: !!this._wiringRequirements },
      { section: 'bestPractices', present: !!this._bestPractices },
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run src/__tests__/prompts/wiring-section.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/prompts/prompt-builder.ts src/__tests__/prompts/wiring-section.test.ts
git commit -m "feat(prompts): Wiring Requirements section in PromptBuilder"
```

---

## Task 5: Pass 0 — Ground Truth evaluator pass

**Files:**
- Modify: `src/lib/evaluator/module-eval-prompts.ts`
- Modify: `src/components/modules/core-engine/ScanTab.tsx` (`PASS_ICONS` line 38; `counts` literal line 254)
- Test: `src/__tests__/evaluator/ground-truth-pass.test.ts`

> **Why the ScanTab edits are mandatory:** `EvalPass` is consumed by two exhaustive `Record<EvalPass, …>` object literals in `ScanTab.tsx` (`PASS_ICONS` and the per-pass `counts`). Adding a new union member without adding both keys is a TypeScript compile error, so `npm run validate` would fail. They must be edited in the same task.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/evaluator/ground-truth-pass.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { EVAL_PASSES, PASS_LABELS, buildEvalPrompt } from '@/lib/evaluator/module-eval-prompts';

describe('ground-truth evaluator pass', () => {
  it('is the first pass', () => {
    expect(EVAL_PASSES[0]).toBe('ground-truth');
  });

  it('has a label', () => {
    expect(PASS_LABELS['ground-truth']).toBe('Ground Truth');
  });

  it('produces a module-agnostic ground-truth instruction', () => {
    const out = buildEvalPrompt({
      moduleId: 'arpg-combat',
      pass: 'ground-truth',
      projectName: 'PoF',
      moduleName: 'PoF',
      sourcePath: 'Source/PoF',
    });
    const lower = out.toLowerCase();
    expect(lower).toContain('parent class');
    expect(lower).toContain('read-only inventory');
  });

  it('produces the same ground-truth checks for a module without a specific context', () => {
    const out = buildEvalPrompt({
      moduleId: 'core-engine-plan',
      pass: 'ground-truth',
      projectName: 'PoF',
      moduleName: 'PoF',
      sourcePath: 'Source/PoF',
    });
    expect(out.toLowerCase()).toContain('parent class');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/__tests__/evaluator/ground-truth-pass.test.ts`
Expected: FAIL — `EVAL_PASSES[0]` is `'structure'`, not `'ground-truth'`.

- [ ] **Step 3: Extend the `EvalPass` type, `EVAL_PASSES`, and `PASS_LABELS`**

In `src/lib/evaluator/module-eval-prompts.ts`, replace lines 14-22:

```ts
export type EvalPass = 'ground-truth' | 'structure' | 'quality' | 'performance';

export const EVAL_PASSES: EvalPass[] = ['ground-truth', 'structure', 'quality', 'performance'];

export const PASS_LABELS: Record<EvalPass, string> = {
  'ground-truth': 'Ground Truth',
  structure: 'Structure',
  quality: 'Quality',
  performance: 'Performance',
};
```

- [ ] **Step 4: Add the ground-truth prompt constants**

In `src/lib/evaluator/module-eval-prompts.ts`, immediately after the `FINDING_SCHEMA` const block (after line 41), add:

```ts
// ─── Pass 0 — Ground Truth (module-agnostic) ─────────────────────────────────

const GROUND_TRUTH_DESCRIPTION =
  'Pass 0 — establish ground truth before proposing any change. Confirm the real classes, parents, and properties this module depends on actually exist in the source.';

const GROUND_TRUTH_CHECKS = `- For each class you reference, name its parent class and its file path under Source/
- Name the specific UPROPERTY/UFUNCTION members you depend on
- Name ONE observable runtime behaviour you can verify for each
- If you CANNOT confirm any of the above from the actual source, do NOT propose changes — first request a read-only inventory of the missing class`;
```

- [ ] **Step 5: Handle ground-truth in `getPassDescription` and `getPassChecks`**

In `getPassDescription()`, add an early return as the first line of the function body (before the `switch (pass)` at line 352):

```ts
function getPassDescription(pass: EvalPass): string {
  if (pass === 'ground-truth') return GROUND_TRUTH_DESCRIPTION;
  switch (pass) {
    case 'structure':
```

In `getPassChecks()`, add an early return as the first line of the function body (before the `if (!ctx)` at line 363):

```ts
function getPassChecks(ctx: ModuleEvalContext | undefined, pass: EvalPass): string {
  if (pass === 'ground-truth') return GROUND_TRUTH_CHECKS;
  if (!ctx) {
```

> After each early `return`, TypeScript narrows `pass` to `'structure' | 'quality' | 'performance'`, so the existing 3-case switches remain exhaustive — no other changes needed in these two functions.

- [ ] **Step 6: Patch the two exhaustive literals in `ScanTab.tsx`**

In `src/components/modules/core-engine/ScanTab.tsx`, update `PASS_ICONS` (line 38). `ScanSearch` is already imported (line 6):

```ts
const PASS_ICONS: Record<EvalPass, typeof Shield> = {
  'ground-truth': ScanSearch,
  structure: Shield,
  quality: Bug,
  performance: Gauge,
};
```

And update the `counts` literal (line 254):

```ts
    const counts: Record<EvalPass, number> = { 'ground-truth': 0, structure: 0, quality: 0, performance: 0 };
```

- [ ] **Step 7: Run the unit test + a typecheck**

Run: `npx vitest run src/__tests__/evaluator/ground-truth-pass.test.ts`
Expected: PASS.

Run: `npm run typecheck`
Expected: PASS — no "missing property 'ground-truth'" errors from the two `Record<EvalPass, …>` literals.

- [ ] **Step 8: Commit**

```bash
git add src/lib/evaluator/module-eval-prompts.ts src/components/modules/core-engine/ScanTab.tsx src/__tests__/evaluator/ground-truth-pass.test.ts
git commit -m "feat(evaluator): Pass 0 Ground Truth before structure/quality/performance"
```

---

## Task 6: `MODULE_WIRING_ASSETS` + helpers

**Files:**
- Modify: `src/lib/feature-definitions.ts`
- Test: `src/__tests__/lib/feature-definitions-wiring.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/lib/feature-definitions-wiring.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { SUB_MODULE_IDS } from '@/types/modules';
import {
  MODULE_WIRING_ASSETS,
  getWiringAssets,
  moduleNeedsBinaryContent,
  type WiringAsset,
} from '@/lib/feature-definitions';

const VALID_KINDS: WiringAsset['kind'][] = [
  'WidgetBlueprint',
  'AnimBlueprint',
  'BehaviorTree',
  'DataTable',
  'InputMappingContext',
  'GameMode',
  'Material',
  'Other',
];

describe('MODULE_WIRING_ASSETS coverage', () => {
  it('has an explicit entry for every SubModuleId', () => {
    for (const id of SUB_MODULE_IDS) {
      expect(id in MODULE_WIRING_ASSETS, `missing wiring entry for "${id}"`).toBe(true);
    }
  });

  it('every wiring asset has a non-empty name/note and a valid kind', () => {
    for (const id of SUB_MODULE_IDS) {
      for (const a of getWiringAssets(id)) {
        expect(a.name, `name in ${id}`).toBeTruthy();
        expect(a.note, `note in ${id}`).toBeTruthy();
        expect(VALID_KINDS, `kind in ${id}`).toContain(a.kind);
      }
    }
  });
});

describe('moduleNeedsBinaryContent', () => {
  it('is true for arpg-ui (Widget Blueprint)', () => {
    expect(moduleNeedsBinaryContent('arpg-ui')).toBe(true);
  });

  it('is true for arpg-enemy-ai (Behavior Tree)', () => {
    expect(moduleNeedsBinaryContent('arpg-enemy-ai')).toBe(true);
  });

  it('is false for a module with only DataTable assets', () => {
    expect(moduleNeedsBinaryContent('arpg-progression')).toBe(false);
  });

  it('is false for a module with no wiring assets', () => {
    expect(moduleNeedsBinaryContent('arpg-gas')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/__tests__/lib/feature-definitions-wiring.test.ts`
Expected: FAIL — `MODULE_WIRING_ASSETS` / `getWiringAssets` / `moduleNeedsBinaryContent` are not exported.

- [ ] **Step 3: Add the `WiringAsset` interface + data + helpers**

In `src/lib/feature-definitions.ts`, append at the end of the file (after the `computeBlockers` function, line 515):

```ts
// ─── Module wiring assets (binary-content dependencies) ───────────────────────
// Declares the editor-authored assets each module needs to be runnable. Every
// SubModuleId MUST have an explicit entry (possibly []) — enforced by
// feature-definitions-wiring.test.ts so a new module forces a wiring decision.

export interface WiringAsset {
  name: string;
  kind:
    | 'WidgetBlueprint'
    | 'AnimBlueprint'
    | 'BehaviorTree'
    | 'DataTable'
    | 'InputMappingContext'
    | 'GameMode'
    | 'Material'
    | 'Other';
  note: string;
}

/** Kinds that cannot be authored from code at all — drive the matrix indicator. */
const BINARY_AUTHORABLE_ONLY: WiringAsset['kind'][] = ['WidgetBlueprint', 'AnimBlueprint', 'BehaviorTree'];

export const MODULE_WIRING_ASSETS: Partial<Record<SubModuleId, WiringAsset[]>> = {
  // Core Engine — aRPG
  'arpg-character': [
    { name: 'BP_ARPGPlayerCharacter', kind: 'Other', note: 'Blueprint subclass of the C++ player character used as DefaultPawn' },
    { name: 'IMC_Default', kind: 'InputMappingContext', note: 'Input Mapping Context added to the Enhanced Input subsystem on possess' },
    { name: 'BP_ARPGGameMode', kind: 'GameMode', note: 'GameMode with DefaultPawnClass / PlayerControllerClass / HUDClass set' },
  ],
  'arpg-animation': [
    { name: 'ABP_ARPGCharacter', kind: 'AnimBlueprint', note: 'Animation Blueprint reparented to the C++ UARPGAnimInstance; AnimGraph cannot be authored from code' },
  ],
  'arpg-gas': [],
  'arpg-combat': [
    { name: 'DT_DamageTypes', kind: 'DataTable', note: 'Damage/type rows referenced by the damage execution' },
    { name: 'AM_MeleeCombo', kind: 'Other', note: 'Combo montage — montage shell is automatable, section timing is editor work' },
  ],
  'arpg-enemy-ai': [
    { name: 'BT_Enemy', kind: 'BehaviorTree', note: 'Behavior Tree graph (Idle/Patrol/Chase/Attack) — graph cannot be authored from code' },
    { name: 'BB_Enemy', kind: 'Other', note: 'Blackboard asset with typed keys consumed by the BT' },
  ],
  'arpg-inventory': [],
  'arpg-loot': [
    { name: 'DT_LootTable', kind: 'DataTable', note: 'Weighted loot entries' },
  ],
  'arpg-ui': [
    { name: 'WBP_ARPGHUD', kind: 'WidgetBlueprint', note: 'UMG widget bound to the C++ HUD base via BindWidget — requires a WBP asset' },
  ],
  'arpg-progression': [
    { name: 'DT_XPCurve', kind: 'DataTable', note: 'XP-per-level curve table' },
  ],
  'arpg-world': [],
  'arpg-save': [],
  'arpg-polish': [],
  'core-engine-plan': [],

  // Content
  'models': [],
  'animations': [
    { name: 'ABP_Character', kind: 'AnimBlueprint', note: 'Animation Blueprint over the C++ AnimInstance base' },
  ],
  'materials': [
    { name: 'M_Master', kind: 'Material', note: 'Master material graph with static-switch parameters' },
  ],
  'level-design': [],
  'ui-hud': [
    { name: 'WBP_HUD', kind: 'WidgetBlueprint', note: 'UMG overlay for the AHUD subclass' },
  ],
  'audio': [],

  // Game Systems
  'ai-behavior': [
    { name: 'BT_Default', kind: 'BehaviorTree', note: 'Behavior Tree graph for the AI controller' },
  ],
  'physics': [],
  'multiplayer': [],
  'save-load': [],
  'input-handling': [
    { name: 'IMC_Default', kind: 'InputMappingContext', note: 'Input Mapping Context with the action bindings' },
  ],
  'dialogue-quests': [],
  'packaging': [],
  'blueprint-transpiler': [],

  // Evaluator
  'game-design-doc': [],

  // Visual Generation (Asset Studio)
  'asset-viewer': [],
  'asset-forge': [],
  'material-lab': [
    { name: 'M_LabMaster', kind: 'Material', note: 'Master material authored in the lab' },
  ],
  'blender-pipeline': [],
  'asset-browser': [],
  'import-automation': [],
  'auto-rig': [],
  'procedural-engine': [],
  'scene-composer': [],
};

/** Wiring assets for a module ([] when none declared). */
export function getWiringAssets(moduleId: SubModuleId): WiringAsset[] {
  return MODULE_WIRING_ASSETS[moduleId] ?? [];
}

/** True when a module depends on an asset that cannot be authored from code. */
export function moduleNeedsBinaryContent(moduleId: SubModuleId): boolean {
  return getWiringAssets(moduleId).some((a) => BINARY_AUTHORABLE_ONLY.includes(a.kind));
}
```

> Note: `MODULE_WIRING_ASSETS` lists all 37 `SubModuleId`s explicitly. If the test reports a missing id, add an entry for it (use `[]` if the module needs no binary content).

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/__tests__/lib/feature-definitions-wiring.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/feature-definitions.ts src/__tests__/lib/feature-definitions-wiring.test.ts
git commit -m "feat(feature-definitions): MODULE_WIRING_ASSETS + binary-content helpers"
```

---

## Task 7: "Needs binary content" badge in `FeatureMatrix`

**Files:**
- Modify: `src/components/modules/shared/FeatureMatrix.tsx` (import line 13/14; lucide import line 5; derived value near line 150; render near line 455)

> This is a minimal, additive UI surface — a single derived badge. It does NOT restructure the matrix. The logic lives in the tested `moduleNeedsBinaryContent` helper (Task 6); this task only renders it. There is no React render test (would require a loaded UE project); correctness is covered by `npm run typecheck` + `npm run lint` + the Task 6 data-layer test.

- [ ] **Step 1: Import the helper**

In `src/components/modules/shared/FeatureMatrix.tsx`, extend the existing feature-definitions import (line 13):

```ts
import { buildDependencyMap, computeBlockers, moduleNeedsBinaryContent } from '@/lib/feature-definitions';
```

- [ ] **Step 2: Add the `Boxes` icon to the lucide import**

In the lucide-react import (line 5), add `Boxes` to the destructured set, e.g. after `ShieldCheck`:

```ts
import { Check, ChevronDown, ChevronRight, FileCode, Loader2, RefreshCw, Star, ArrowRight, Download, TrendingUp, TrendingDown, Minus, AlertTriangle, Link2, Zap, Search, ArrowUpDown, ArrowUp, ArrowDown, Play, Copy, Eye, LayoutList, LayoutGrid, ShieldCheck, Boxes } from 'lucide-react';
```

- [ ] **Step 3: Compute the derived flag**

In the `FeatureMatrix` component body, immediately after the `bridgeConnected` line (line 152), add:

```ts
  const needsBinaryContent = useMemo(() => moduleNeedsBinaryContent(moduleId), [moduleId]);
```

- [ ] **Step 4: Render the badge in the header row**

In the summary header (the `<div className="flex items-center gap-4">` block), immediately after `<SummaryBar summary={summary} />` (line 455), add:

```tsx
        {needsBinaryContent && (
          <span
            className="flex items-center gap-1 text-2xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium"
            style={{
              backgroundColor: statusBg(STATUS_WARNING),
              color: STATUS_WARNING,
              border: `1px solid ${statusBorder(STATUS_WARNING)}`,
            }}
            title="This module depends on binary content (Widget/Animation Blueprint or Behavior Tree) that cannot be generated from code — it must be authored in the editor."
          >
            <Boxes className="w-3 h-3" />
            needs binary content
          </span>
        )}
```

> `statusBg`, `statusBorder`, and `STATUS_WARNING` are already imported (line 19) — no hardcoded hex is introduced.

- [ ] **Step 5: Verify typecheck + lint pass**

Run: `npm run typecheck`
Expected: PASS.

Run: `npm run lint`
Expected: PASS (no no-hardcoded-hex / no-console warnings introduced).

- [ ] **Step 6: Commit**

```bash
git add src/components/modules/shared/FeatureMatrix.tsx
git commit -m "feat(matrix): show needs-binary-content indicator per module"
```

---

## Task 8: Full validation gate

**Files:** none (verification + summary only)

- [ ] **Step 1: Run the full validation suite**

Run: `npm run validate`
Expected: PASS — typecheck + lint + the entire vitest suite (including the 6 new test files) all green.

- [ ] **Step 2: If anything fails, fix and re-commit**

If `npm run validate` surfaces a failure (e.g. an `EvalPass` consumer missed in Task 5, or a snapshot mismatch), fix the specific file, re-run `npm run validate`, then:

```bash
git add <fixed files>
git commit -m "fix: resolve validation failures for generation-quality work"
```

- [ ] **Step 3: Confirm scope isolation**

Run: `git status` and `git diff --stat master@{1} HEAD` (or review the commits from this plan).
Expected: only files under `src/lib/knowledge/`, `src/lib/prompt-context.ts`, `src/lib/prompts/prompt-builder.ts`, `src/lib/evaluator/module-eval-prompts.ts`, `src/lib/feature-definitions.ts`, `src/components/modules/core-engine/ScanTab.tsx`, `src/components/modules/shared/FeatureMatrix.tsx`, and `src/__tests__/**` were changed. NO UE-project files, no other forked-CLI's files.

> Per project workflow: commit locally only. The user pushes the PoF app repo manually — do NOT `git push`.

---

## Self-Review

**1. Spec coverage** — every spec design item maps to a task:
- Spec §1 (`src/lib/knowledge/`: types, ue-gotchas, binary-content) → Tasks 1 & 2.
- Spec §2 (`prompt-context.ts` injection, `promptKind` default `'ue-cpp'`) → Task 3.
- Spec §3 (`prompt-builder.ts` Wiring Requirements, `withWiringRequirements`, insertion between Task Instructions and Best Practices, `wiring` output field, `audit()`) → Task 4.
- Spec §4 (`module-eval-prompts.ts` Pass 0 Ground Truth, prepended to `EVAL_PASSES`, `PASS_LABELS`, module-agnostic) → Task 5 (plus the `ScanTab.tsx` consumer fix the spec's "Evaluator pass wiring" risk called out).
- Spec §5 (`feature-definitions.ts` `WiringAsset`, `MODULE_WIRING_ASSETS` covering every module, `getWiringAssets`, matrix surface) → Tasks 6 & 7.
- Spec testing section (6 vitest files + `npm run validate`) → all tasks + Task 8.

**2. Placeholder scan** — every code step contains complete, copy-pasteable code; every command states its expected result. No TBD/TODO.

**3. Type consistency** — `PromptKind` (Task 1) is reused verbatim in Tasks 2 & 3. `WiringRequirement` (Task 4) field names (`artifact`, `grantedBy`, `activatedBy`, `dependencies`, `verification`) match the test and the table renderer. `WiringAsset` (Task 6) `kind` union matches the test's `VALID_KINDS` and the `BINARY_AUTHORABLE_ONLY` subset used by `moduleNeedsBinaryContent`. `EvalPass` gains `'ground-truth'` consistently across the type, `EVAL_PASSES`, `PASS_LABELS`, `getPassDescription`, `getPassChecks`, and the two `ScanTab` literals. `formatGotchas` / `formatBinaryContentTripwire` names match between definition (Tasks 1/2) and import (Task 3).

**Resolved risk (from spec):** adding a 4th `EvalPass` member breaks two exhaustive `Record<EvalPass, …>` literals in `ScanTab.tsx` — both are patched within Task 5, with a `npm run typecheck` gate before commit. `DeepEvalResults.tsx` only indexes `PASS_LABELS[pass]` (no literal), so it renders the new label without code change.
