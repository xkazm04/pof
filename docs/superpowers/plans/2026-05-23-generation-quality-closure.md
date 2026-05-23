# Generation-Quality (§01) Closure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Activate the inert "Wiring Requirements" generation lesson in PoF's real dispatch path, stop running CLI sessions being clobbered at the tab cap, surface per-module wiring assets in the feature matrix, and add deterministic test coverage — closing the remaining gaps of `docs/improvements/01-generation-quality/`.

**Architecture:** Extract a single `formatWiringRequirements()` formatter into the knowledge layer (next to `formatGotchas`); both `buildTaskPrompt` (the real dispatch assembler in `cli-task.ts`) and `PromptBuilder.withWiringRequirements()` delegate to it, so there is one source of truth. The dispatch path feeds each module's existing `MODULE_WIRING_ASSETS` into the prompt. Two self-contained UI/store changes (`cliPanelStore.createSession` cap guard, `FeatureMatrix` wiring-asset panel) and four new test files complete the work.

**Tech Stack:** TypeScript, Next.js 16, React 19, Zustand v5, Vitest 4, @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-05-23-generation-quality-closure-design.md`

**Conventions:** `@/` import alias (same-dir `./` is fine, as existing code does); no raw `console` (use `logger`); no hardcoded hex (use `@/lib/chart-colors`); commit locally only — the user pushes manually (app-repo workflow). End commit messages with the Co-Authored-By trailer.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/knowledge/wiring-requirements.ts` | **New.** `WiringRequirement` type, `WiringRequirementsOptions`, and `formatWiringRequirements()` — the single source of the Wiring Requirements markdown block. |
| `src/lib/prompts/prompt-builder.ts` | **Modify.** `withWiringRequirements()` delegates to the formatter; re-export `WiringRequirement`. |
| `src/lib/cli-task.ts` | **Modify.** `buildTaskPrompt` emits the wiring block for UE `checklist`/`quick-action`/`feature-fix` dispatches, feeding `getWiringAssets(moduleId)`. |
| `src/components/cli/store/cliPanelStore.ts` | **Modify.** `createSession` cap guard: reuse stalest idle tab, never clobber a running one; `MAX_SESSIONS` constant. |
| `src/components/modules/shared/WiringAssetsPanel.tsx` | **New.** Presentational list of a module's `WiringAsset[]`. |
| `src/components/modules/shared/FeatureMatrix.tsx` | **Modify.** Badge becomes a toggle that reveals `WiringAssetsPanel`. |
| `src/__tests__/knowledge/wiring-requirements.test.ts` | **New.** Formatter unit tests. |
| `src/__tests__/prompts/wiring-dispatch.test.ts` | **New.** `buildTaskPrompt` injection (positive + negative cases). |
| `src/__tests__/registry/wiring-smoke.test.ts` | **New.** Registry-wide: every module's checklist dispatch carries the block. |
| `src/__tests__/stores/cliPanelStore.test.ts` | **New.** `createSession` cap-guard behavior. |
| `src/__tests__/components/wiring-assets-panel.test.tsx` | **New.** `WiringAssetsPanel` render test. |

---

## Task 1: Shared `formatWiringRequirements` formatter (spec A.1 + A.2)

**Files:**
- Create: `src/lib/knowledge/wiring-requirements.ts`
- Create: `src/__tests__/knowledge/wiring-requirements.test.ts`
- Modify: `src/lib/prompts/prompt-builder.ts` (lines 16–47 imports/type; lines 116–138 method)

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/knowledge/wiring-requirements.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { formatWiringRequirements } from '@/lib/knowledge/wiring-requirements';
import type { WiringAsset } from '@/lib/feature-definitions';

describe('formatWiringRequirements', () => {
  it('emits the heading, four sub-prompts, and the wiring output-field instruction with no args', () => {
    const out = formatWiringRequirements();
    const lower = out.toLowerCase();
    expect(out).toContain('## Wiring Requirements');
    expect(lower).toContain('grant');
    expect(lower).toContain('activat');
    expect(lower).toContain('depend');
    expect(lower).toContain('verif');
    expect(out).toContain('`wiring`');
  });

  it('lists module assets as "name (kind): note" when moduleAssets is supplied', () => {
    const moduleAssets: WiringAsset[] = [
      { name: 'WBP_ARPGHUD', kind: 'WidgetBlueprint', note: 'UMG widget bound via BindWidget' },
    ];
    const out = formatWiringRequirements({ moduleAssets });
    expect(out).toContain('Known editor-authored dependencies for this module');
    expect(out).toContain('WBP_ARPGHUD (WidgetBlueprint): UMG widget bound via BindWidget');
  });

  it('renders known reqs as a markdown table when supplied', () => {
    const out = formatWiringRequirements({
      reqs: [{ artifact: 'GA_MeleeAttack', grantedBy: 'ASC', activatedBy: 'IA_PrimaryAttack', dependencies: ['AM_MeleeCombo'], verification: 'plays on click' }],
    });
    expect(out).toContain('| Artifact | Granted by | Activated by | Dependencies | Verify |');
    expect(out).toContain('GA_MeleeAttack');
    expect(out).toContain('IA_PrimaryAttack');
    expect(out).toContain('AM_MeleeCombo');
  });

  it('omits the asset and table sections when given no data', () => {
    const out = formatWiringRequirements();
    expect(out).not.toContain('Known editor-authored dependencies');
    expect(out).not.toContain('| Artifact |');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/knowledge/wiring-requirements.test.ts`
Expected: FAIL — cannot resolve `@/lib/knowledge/wiring-requirements`.

- [ ] **Step 3: Create the formatter**

Create `src/lib/knowledge/wiring-requirements.ts`:

```ts
import type { WiringAsset } from '@/lib/feature-definitions';

/**
 * A known per-artifact wiring hint, rendered as a row in the
 * "Known wiring for this task" table.
 */
export interface WiringRequirement {
  artifact: string;
  grantedBy?: string;
  activatedBy?: string;
  dependencies?: string[];
  verification?: string;
}

export interface WiringRequirementsOptions {
  /** Known per-artifact wiring hints (rendered as a table when non-empty). */
  reqs?: WiringRequirement[];
  /** The module's editor-authored dependencies (from MODULE_WIRING_ASSETS). */
  moduleAssets?: WiringAsset[];
}

/**
 * Build the "## Wiring Requirements" markdown block. Always emits the four
 * wiring sub-prompts (granting / activation / dependencies / verification) plus
 * the `wiring` output-field instruction. When `moduleAssets` is non-empty, lists
 * the module's known editor-authored dependencies; when `reqs` is non-empty,
 * renders them as a table. Single source of truth for both the dispatch path
 * (buildTaskPrompt) and PromptBuilder.withWiringRequirements().
 */
export function formatWiringRequirements(opts: WiringRequirementsOptions = {}): string {
  const { reqs = [], moduleAssets = [] } = opts;
  const lines: string[] = ['## Wiring Requirements'];
  lines.push('For EVERY artifact you generate, make it runnable out-of-the-box — do not stop at "it compiles":');
  lines.push('- **Granting / registration**: state how the artifact is granted or registered (ability granted to the ASC, GameMode class set, IMC added to the input subsystem, component added to the actor).');
  lines.push('- **Activation**: state what triggers it at runtime (input action, gameplay event, BeginPlay, overlap).');
  lines.push('- **Dependencies**: list the companion assets it needs and FLAG any binary-content dependency (Widget/Animation Blueprint, Behavior Tree, .umap) that cannot be authored from code.');
  lines.push('- **Verification**: give ONE observable check that proves the wiring works (a log line, an on-screen value, a functional-test assertion).');
  lines.push('In your output, include a `wiring` field for each generated artifact summarizing the four points above.');

  if (moduleAssets.length > 0) {
    lines.push('');
    lines.push('Known editor-authored dependencies for this module (cannot be created from code — declare how each is provided):');
    for (const a of moduleAssets) {
      lines.push(`- ${a.name} (${a.kind}): ${a.note}`);
    }
  }

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

  return lines.join('\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/knowledge/wiring-requirements.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Refactor `PromptBuilder` to delegate**

In `src/lib/prompts/prompt-builder.ts`:

Delete the `WiringRequirement` interface (currently lines 41–47).

Add to the import block at the top (after the existing `import type { ErrorContextEntry }` line):

```ts
import { formatWiringRequirements, type WiringRequirement } from '@/lib/knowledge/wiring-requirements';

export type { WiringRequirement };
```

Replace the entire body of `withWiringRequirements` (currently lines 116–138) with:

```ts
  withWiringRequirements(reqs: WiringRequirement[] = []): this {
    this._wiringRequirements = formatWiringRequirements({ reqs });
    return this;
  }
```

- [ ] **Step 6: Verify the existing PromptBuilder test still passes**

Run: `npx vitest run src/__tests__/prompts/wiring-section.test.ts`
Expected: PASS (5 tests, unchanged behavior — same heading, sub-prompts, `wiring` field, and table).

- [ ] **Step 7: Commit**

```bash
git add src/lib/knowledge/wiring-requirements.ts src/__tests__/knowledge/wiring-requirements.test.ts src/lib/prompts/prompt-builder.ts
git commit -m "$(cat <<'EOF'
feat(knowledge): extract formatWiringRequirements; PromptBuilder delegates

Single source of truth for the Wiring Requirements block, reusable by the
dispatch path. Adds optional per-module asset list. No behavior change to
PromptBuilder.withWiringRequirements (existing test stays green).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Inject Wiring Requirements into `buildTaskPrompt` (spec A.3 — the headline fix)

**Files:**
- Modify: `src/lib/cli-task.ts` (imports lines 9–17; add module constant; `buildTaskPrompt` lines 215–277)
- Test: `src/__tests__/prompts/wiring-dispatch.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/prompts/wiring-dispatch.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildTaskPrompt, TaskFactory } from '@/lib/cli-task';
import type { ProjectContext } from '@/lib/prompt-context';

const ueCtx: ProjectContext = {
  projectName: 'PoF',
  projectPath: 'C:\\proj',
  ueVersion: '5.7.3',
};

const webCtx: ProjectContext = {
  ...ueCtx,
  dynamicContext: {
    scannedAt: '',
    projectType: 'nextjs',
    classes: [],
    plugins: [],
    buildDependencies: [],
    sourceFileCount: 0,
  },
};

const HEADING = '## Wiring Requirements';

describe('buildTaskPrompt wiring injection', () => {
  it('adds the section to a UE checklist dispatch, with the module assets', () => {
    const task = TaskFactory.checklist('arpg-ui', 'item-1', 'Build the HUD.', 'HUD', 'http://localhost:3000');
    const out = buildTaskPrompt(task, ueCtx);
    expect(out).toContain(HEADING);
    expect(out).toContain('WBP_ARPGHUD'); // arpg-ui's known wiring asset
  });

  it('adds the section to a UE quick-action dispatch', () => {
    const task = TaskFactory.quickAction('arpg-combat', 'Add a dodge.', 'Dodge');
    expect(buildTaskPrompt(task, ueCtx)).toContain(HEADING);
  });

  it('adds the section to a UE feature-fix dispatch', () => {
    const task = TaskFactory.featureFix(
      'arpg-combat',
      { featureName: 'Hit detection', status: 'partial', nextSteps: 'Add notify.', filePaths: [], qualityScore: 3 },
      'Fix',
      'http://localhost:3000',
    );
    expect(buildTaskPrompt(task, ueCtx)).toContain(HEADING);
  });

  it('does NOT add the section to an ask-claude dispatch', () => {
    const task = TaskFactory.askClaude('arpg-combat', 'What does GAS stand for?', 'Ask');
    expect(buildTaskPrompt(task, ueCtx)).not.toContain(HEADING);
  });

  it('does NOT add the section to a feature-review dispatch', () => {
    const task = TaskFactory.featureReview('arpg-combat', 'Combat', [], 'http://localhost:3000', 'Review');
    expect(buildTaskPrompt(task, ueCtx)).not.toContain(HEADING);
  });

  it('does NOT add the section for a non-UE (web) project', () => {
    const task = TaskFactory.checklist('arpg-ui', 'item-1', 'Build the HUD.', 'HUD', 'http://localhost:3000');
    expect(buildTaskPrompt(task, webCtx)).not.toContain(HEADING);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/prompts/wiring-dispatch.test.ts`
Expected: FAIL — the checklist/quick-action/feature-fix cases do not contain `## Wiring Requirements`.

- [ ] **Step 3: Add imports and the task-type set**

In `src/lib/cli-task.ts`, change the feature-definitions import (currently line 16) from:

```ts
import type { FeatureDefinition } from '@/lib/feature-definitions';
```

to:

```ts
import { type FeatureDefinition, getWiringAssets } from '@/lib/feature-definitions';
import { formatWiringRequirements } from '@/lib/knowledge/wiring-requirements';
```

Immediately after the `CLITaskType` union (after its closing line `| 'module-scan';`, around line 150), add:

```ts
/** Task types that generate or modify UE code and therefore get a Wiring Requirements section. */
const WIRING_TASK_TYPES = new Set<CLITaskType>(['checklist', 'quick-action', 'feature-fix']);
```

- [ ] **Step 4: Compute the wiring block once at the top of `buildTaskPrompt`**

In `buildTaskPrompt`, directly after the existing line:

```ts
  const isUE5 = !ctx.dynamicContext?.projectType || ctx.dynamicContext.projectType === 'ue5';
```

add:

```ts
  const wiringBlock =
    isUE5 && WIRING_TASK_TYPES.has(task.type)
      ? `\n\n${formatWiringRequirements({ moduleAssets: getWiringAssets(task.moduleId) })}`
      : '';
```

- [ ] **Step 5: Insert `${wiringBlock}` into the three eligible branches**

**checklist branch** — change the return (currently line 238) from:

```ts
      return `${header}${domainSection}\n\n## Task\n${task.prompt}\n\n${buildCallbackSection(getCallback(cbId)!)}`;
```

to:

```ts
      return `${header}${domainSection}\n\n## Task\n${task.prompt}${wiringBlock}\n\n${buildCallbackSection(getCallback(cbId)!)}`;
```

**quick-action / ask-claude branch** — change the return (currently line 248) from:

```ts
      return `${header}${domainSection}\n\n## Task\n${task.prompt}`;
```

to:

```ts
      return `${header}${domainSection}\n\n## Task\n${task.prompt}${wiringBlock}`;
```

(For `ask-claude`, `wiringBlock` is `''` because it is not in `WIRING_TASK_TYPES`, so the section is correctly omitted.)

**feature-fix branch** — change the return (currently line 276) by inserting `${wiringBlock}` immediately after `production quality (5/5).` and before `\n\n### Completion`:

```ts
      return `${header}${domainSection}\n${fileSection}\n\n## Task: Improve "${ft.featureName}"\n\nCurrent status: **${ft.status}**${qualityNote}\n\n### What needs to be done\n${ft.nextSteps}\n\nImplement all the improvements listed above. Work through them methodically — read existing code first, then make targeted changes. The goal is to bring this feature to production quality (5/5).${wiringBlock}\n\n### Completion\n\nAfter you have completed **all** improvements and verified they compile correctly, mark the feature as improved.\n\n${buildCallbackSection(getCallback(cbId)!)}`;
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/__tests__/prompts/wiring-dispatch.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 7: Commit**

```bash
git add src/lib/cli-task.ts src/__tests__/prompts/wiring-dispatch.test.ts
git commit -m "$(cat <<'EOF'
feat(cli-task): inject Wiring Requirements into UE generation dispatches

buildTaskPrompt now emits the Wiring Requirements block (with the module's
known editor-authored dependencies) for checklist/quick-action/feature-fix
UE prompts. Closes improvements/01 #1 — the section was defined and tested
but never reached a dispatched prompt. Excludes ask-claude/feature-review
and non-UE projects.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Registry-wide wiring-smoke test (spec D1)

**Files:**
- Test: `src/__tests__/registry/wiring-smoke.test.ts` (new)

- [ ] **Step 1: Write the test**

Create `src/__tests__/registry/wiring-smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { SUB_MODULE_IDS } from '@/types/modules';
import { buildTaskPrompt, TaskFactory } from '@/lib/cli-task';
import type { ProjectContext } from '@/lib/prompt-context';

const ueCtx: ProjectContext = {
  projectName: 'PoF',
  projectPath: 'C:\\proj',
  ueVersion: '5.7.3',
};

describe('registry-wide wiring-smoke', () => {
  it.each([...SUB_MODULE_IDS])('checklist dispatch for "%s" carries Wiring Requirements', (moduleId) => {
    const task = TaskFactory.checklist(moduleId, 'item-1', 'Implement the feature.', moduleId, 'http://localhost:3000');
    const prompt = buildTaskPrompt(task, ueCtx);
    expect(prompt).toContain('## Wiring Requirements');
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run src/__tests__/registry/wiring-smoke.test.ts`
Expected: PASS — one assertion per `SUB_MODULE_IDS` entry. This is the deterministic realization of `tests.md`'s "wiring-smoke harness mode" (no Claude/UE/dev-server). If any module fails, Task 2's injection is not reaching that module's dispatch.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/registry/wiring-smoke.test.ts
git commit -m "$(cat <<'EOF'
test(registry): registry-wide wiring-smoke for every module's dispatch

Iterates SUB_MODULE_IDS, builds each module's checklist dispatch via
buildTaskPrompt, asserts the Wiring Requirements block is present.
Deterministic stand-in for tests.md's "wiring-smoke harness mode".

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `createSession` cap guard — don't clobber a running session (spec B)

**Files:**
- Modify: `src/components/cli/store/cliPanelStore.ts` (constant near line 58; `createSession` lines 74–77)
- Test: `src/__tests__/stores/cliPanelStore.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/stores/cliPanelStore.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useCLIPanelStore, type CLISessionState } from '@/components/cli/store/cliPanelStore';
import { MODULE_COLORS } from '@/lib/chart-colors';

function makeSession(id: string, isRunning: boolean, lastActivityAt: number): CLISessionState {
  return {
    id,
    label: id,
    projectPath: null,
    claudeSessionId: null,
    currentExecutionId: null,
    currentTaskId: null,
    isRunning,
    lastTaskSuccess: null,
    accentColor: MODULE_COLORS.core,
    createdAt: 0,
    lastActivityAt,
    enabledSkills: [],
  };
}

/** Seed the store with exactly the given sessions (in order). */
function seed(sessions: CLISessionState[]) {
  const map: Record<string, CLISessionState> = {};
  for (const s of sessions) map[s.id] = s;
  useCLIPanelStore.setState({
    sessions: map,
    tabOrder: sessions.map((s) => s.id),
    activeTabId: sessions[0]?.id ?? null,
    maximizedTabId: null,
  });
}

beforeEach(() => {
  useCLIPanelStore.setState({ sessions: {}, tabOrder: [], activeTabId: null, maximizedTabId: null });
});

describe('cliPanelStore.createSession cap guard', () => {
  it('creates a new session when under the cap', () => {
    const id = useCLIPanelStore.getState().createSession();
    expect(useCLIPanelStore.getState().tabOrder).toContain(id);
    expect(useCLIPanelStore.getState().tabOrder).toHaveLength(1);
  });

  it('at the cap, reuses the least-recently-active IDLE session', () => {
    const sessions = Array.from({ length: 8 }, (_, i) =>
      // all running except #2 (lastActivityAt 50) and #5 (lastActivityAt 10 — stalest idle)
      makeSession(`s${i}`, i !== 2 && i !== 5, i === 5 ? 10 : i === 2 ? 50 : 100 + i),
    );
    seed(sessions);
    const returned = useCLIPanelStore.getState().createSession();
    expect(returned).toBe('s5'); // stalest idle by lastActivityAt
    expect(useCLIPanelStore.getState().tabOrder).toHaveLength(8); // no new tab
  });

  it('at the cap with EVERY session running, creates a new session (exceeds the cap rather than clobber)', () => {
    const sessions = Array.from({ length: 8 }, (_, i) => makeSession(`r${i}`, true, 100 + i));
    seed(sessions);
    const returned = useCLIPanelStore.getState().createSession();
    expect(useCLIPanelStore.getState().tabOrder).toHaveLength(9);
    expect(useCLIPanelStore.getState().tabOrder).toContain(returned);
    expect(sessions.map((s) => s.id)).not.toContain(returned);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/stores/cliPanelStore.test.ts`
Expected: FAIL — the "reuses stalest idle" test gets the newest tab (current `tabOrder[length-1]`), and the "all running" test does not grow the tab order.

- [ ] **Step 3: Add the `MAX_SESSIONS` constant**

In `src/components/cli/store/cliPanelStore.ts`, after the existing `let tabCounter = 0;` (line 58), add:

```ts
/** Hard cap on simultaneous terminal sessions. Exceeded only when every session is running (a running dispatch must never be clobbered). */
const MAX_SESSIONS = 8;
```

- [ ] **Step 4: Replace the cap check in `createSession`**

Change the start of `createSession` (currently lines 74–77) from:

```ts
      createSession: (opts) => {
        const id = generateTabId();
        const { tabOrder } = get();
        if (tabOrder.length >= 8) return tabOrder[tabOrder.length - 1];
```

to:

```ts
      createSession: (opts) => {
        const id = generateTabId();
        const { tabOrder, sessions } = get();
        if (tabOrder.length >= MAX_SESSIONS) {
          // At cap: reuse the least-recently-active IDLE session. Never reuse a
          // running session — that would clobber its live dispatch. If every
          // session is running, fall through and create a new one (exceeding the
          // cap beats losing a dispatch).
          const idle = tabOrder
            .map((tid) => sessions[tid])
            .filter((s): s is CLISessionState => !!s && !s.isRunning)
            .sort((a, b) => a.lastActivityAt - b.lastActivityAt);
          if (idle.length > 0) return idle[0].id;
        }
```

(The rest of `createSession` — building the session object and `set(...)` — is unchanged.)

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/__tests__/stores/cliPanelStore.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/cli/store/cliPanelStore.ts src/__tests__/stores/cliPanelStore.test.ts
git commit -m "$(cat <<'EOF'
fix(cli): don't clobber a running session at the tab cap

createSession at MAX_SESSIONS now reuses the stalest IDLE session; if every
session is running it creates a new one rather than overwrite a live
dispatch. Closes improvements/01 #6.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `WiringAssetsPanel` component (spec C, part 1)

**Files:**
- Create: `src/components/modules/shared/WiringAssetsPanel.tsx`
- Test: `src/__tests__/components/wiring-assets-panel.test.tsx` (new)

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/components/wiring-assets-panel.test.tsx`:

```tsx
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { WiringAssetsPanel } from '@/components/modules/shared/WiringAssetsPanel';
import type { WiringAsset } from '@/lib/feature-definitions';

afterEach(() => cleanup());

const assets: WiringAsset[] = [
  { name: 'WBP_ARPGHUD', kind: 'WidgetBlueprint', note: 'UMG widget bound via BindWidget' },
  { name: 'DT_LootTable', kind: 'DataTable', note: 'Weighted loot entries' },
];

describe('WiringAssetsPanel', () => {
  it('renders a row per asset with name, kind, and note', () => {
    render(<WiringAssetsPanel assets={assets} />);
    expect(screen.getByText('WBP_ARPGHUD')).toBeTruthy();
    expect(screen.getByText('WidgetBlueprint')).toBeTruthy();
    expect(screen.getByText('UMG widget bound via BindWidget')).toBeTruthy();
    expect(screen.getByText('DT_LootTable')).toBeTruthy();
  });

  it('renders nothing when there are no assets', () => {
    const { container } = render(<WiringAssetsPanel assets={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/components/wiring-assets-panel.test.tsx`
Expected: FAIL — cannot resolve `@/components/modules/shared/WiringAssetsPanel`.

- [ ] **Step 3: Create the component**

Create `src/components/modules/shared/WiringAssetsPanel.tsx`:

```tsx
import type { WiringAsset } from '@/lib/feature-definitions';
import { STATUS_WARNING, STATUS_NEUTRAL, statusBg, statusBorder } from '@/lib/chart-colors';

/** Kinds that cannot be authored from code — flagged in warning color. */
const BINARY_KINDS: WiringAsset['kind'][] = ['WidgetBlueprint', 'AnimBlueprint', 'BehaviorTree'];

/**
 * Lists a module's editor-authored wiring dependencies. Binary-only kinds
 * (Widget/Animation Blueprint, Behavior Tree) are flagged in the warning color.
 * Renders nothing when there are no assets.
 */
export function WiringAssetsPanel({ assets }: { assets: WiringAsset[] }) {
  if (assets.length === 0) return null;
  return (
    <div
      className="rounded-md border p-2 space-y-1"
      style={{ borderColor: statusBorder(STATUS_NEUTRAL) }}
      data-testid="wiring-assets-panel"
    >
      {assets.map((a) => {
        const color = BINARY_KINDS.includes(a.kind) ? STATUS_WARNING : STATUS_NEUTRAL;
        return (
          <div key={a.name} className="flex items-start gap-2 text-2xs">
            <span
              className="px-1.5 py-0.5 rounded font-medium flex-shrink-0"
              style={{ backgroundColor: statusBg(color), color, border: `1px solid ${statusBorder(color)}` }}
            >
              {a.kind}
            </span>
            <span className="font-mono text-text-secondary flex-shrink-0">{a.name}</span>
            <span className="text-text-muted">{a.note}</span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/components/wiring-assets-panel.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/modules/shared/WiringAssetsPanel.tsx src/__tests__/components/wiring-assets-panel.test.tsx
git commit -m "$(cat <<'EOF'
feat(matrix): WiringAssetsPanel — per-module wiring-asset breakdown

Presentational list of a module's editor-authored dependencies; binary-only
kinds flagged in the warning color. Part of improvements/01 #5 UI.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Wire the panel into `FeatureMatrix` (spec C, part 2)

**Files:**
- Modify: `src/components/modules/shared/FeatureMatrix.tsx` (imports lines 13–14; state near line 163; badge lines 457–470; insertion after line 547)

This task is a localized UI change with no new test (the panel itself is tested in Task 5; rendering `FeatureMatrix` in isolation requires heavy store/hook mocking and is out of proportion). It is verified by `npm run validate` (typecheck + lint) in Task 7 and a manual check.

- [ ] **Step 1: Add the value import**

Change line 13 from:

```ts
import { buildDependencyMap, computeBlockers, moduleNeedsBinaryContent } from '@/lib/feature-definitions';
```

to:

```ts
import { buildDependencyMap, computeBlockers, moduleNeedsBinaryContent, getWiringAssets } from '@/lib/feature-definitions';
```

Add, immediately after line 14 (`import type { DependencyInfo, ResolvedDependency } from '@/lib/feature-definitions';`):

```ts
import { WiringAssetsPanel } from './WiringAssetsPanel';
```

- [ ] **Step 2: Add state and the asset list**

Immediately after the existing line (≈153):

```ts
  const needsBinaryContent = useMemo(() => moduleNeedsBinaryContent(moduleId), [moduleId]);
```

add:

```ts
  const wiringAssets = useMemo(() => getWiringAssets(moduleId), [moduleId]);
  const [showWiring, setShowWiring] = useState(false);
```

(`useState` and `useMemo` are already imported on line 3.)

- [ ] **Step 3: Turn the badge into a toggle button**

Replace the badge block (currently lines 457–470) — the `{needsBinaryContent && ( <span ...>...</span> )}` — with a `<button>` that toggles `showWiring` and shows a chevron:

```tsx
        {needsBinaryContent && (
          <button
            type="button"
            onClick={() => setShowWiring((v) => !v)}
            aria-expanded={showWiring}
            className="flex items-center gap-1 text-2xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium transition-colors"
            style={{
              backgroundColor: statusBg(STATUS_WARNING),
              color: STATUS_WARNING,
              border: `1px solid ${statusBorder(STATUS_WARNING)}`,
            }}
            title="This module depends on binary content (Widget/Animation Blueprint or Behavior Tree) that cannot be generated from code — it must be authored in the editor. Click to list it."
          >
            <Boxes className="w-3 h-3" />
            needs binary content
            {showWiring ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
        )}
```

(`Boxes`, `ChevronDown`, `ChevronRight`, `statusBg`, `statusBorder`, `STATUS_WARNING` are all already imported.)

- [ ] **Step 4: Render the panel below the summary row**

The summary flex row (opened at line 455) closes at line 547. Immediately after that closing `</div>` (line 547) and before the `{/* Review progress bar */}` comment (line 549), insert:

```tsx
      {showWiring && wiringAssets.length > 0 && (
        <WiringAssetsPanel assets={wiringAssets} />
      )}
```

- [ ] **Step 5: Typecheck the file**

Run: `npm run typecheck`
Expected: PASS (no type errors).

- [ ] **Step 6: Commit**

```bash
git add src/components/modules/shared/FeatureMatrix.tsx
git commit -m "$(cat <<'EOF'
feat(matrix): expand binary-content badge into a wiring-asset breakdown

The "needs binary content" badge is now a toggle that reveals the module's
editor-authored dependencies via WiringAssetsPanel. Completes improvements/01
#5 UI.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Full validation and memory update

**Files:** none (verification + memory)

- [ ] **Step 1: Run the full CI check**

Run: `npm run validate`
Expected: PASS — typecheck + lint + all tests green, including the 5 new/modified test files (`wiring-requirements`, `wiring-dispatch`, `wiring-smoke`, `cliPanelStore`, `wiring-assets-panel`) and the unchanged `wiring-section`, `context-injection`, `ground-truth-pass`, `feature-definitions-wiring`, `ue-gotchas`, `slice-prompts`.

If lint flags a hardcoded-hex or `console` issue in a new file, fix it (all colors must come from `@/lib/chart-colors`; no raw `console`).

- [ ] **Step 2: Spot-check the dispatch output by eye (optional but recommended)**

Run:
```bash
npx vitest run src/__tests__/prompts/wiring-dispatch.test.ts --reporter=verbose
```
Confirm the `arpg-ui` checklist case asserts both `## Wiring Requirements` and `WBP_ARPGHUD`, proving #5's data now feeds #1's prompt.

- [ ] **Step 3: Update auto-memory**

Update `C:\Users\kazda\.claude\projects\C--Users-kazda-kiro-pof\memory\reference_prompt_knowledge_injection.md` to note that Wiring Requirements now also reaches dispatch prompts (via `formatWiringRequirements` in `buildTaskPrompt` for `checklist`/`quick-action`/`feature-fix`), so the list of "what reaches dispatch" is no longer just gotchas + tripwire. Add a one-line pointer in `MEMORY.md` if a new memory file is created instead.

- [ ] **Step 4: Final confirmation**

Report to the user: which §01 items are now closed (A #1, B #6, C #5 UI, D1 tests), that D2 was dropped (gemini CLI absent from repo) and `game.md` is out of scope, and the final `npm run validate` result. Do NOT push — the user pushes the app repo manually.

---

## Self-Review

**Spec coverage:**
- A (#1 wiring injection) → Tasks 1–3. ✓
- B (#6 cap guard) → Task 4. ✓
- C (#5 UI) → Tasks 5–6. ✓
- D1 (registry-wide wiring-smoke) → Task 3. ✓
- D2 dropped, `game.md` out of scope — recorded in spec, restated in Task 7 Step 4. ✓
- Spec "verification this work succeeded" (validate green, shared text source, matrix breakdown, no-clobber) → Task 7 + Tasks 1/4/6. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code; every run step shows the command + expected result. ✓

**Type consistency:** `formatWiringRequirements(opts?: WiringRequirementsOptions)` and `WiringRequirement` defined in Task 1 are imported identically in Tasks 1 (prompt-builder) and 2 (cli-task). `getWiringAssets`/`WiringAsset` match `feature-definitions.ts`. `CLISessionState` fields in the Task 4 fixture match the interface (id, label, projectPath, claudeSessionId, currentExecutionId, currentTaskId, isRunning, lastTaskSuccess, accentColor, createdAt, lastActivityAt, enabledSkills). `TaskFactory` signatures (`checklist`/`quickAction`/`featureFix`/`askClaude`/`featureReview`) match `cli-task.ts`. `MAX_SESSIONS` defined and referenced consistently. ✓

**Risk notes:** No existing test calls `buildTaskPrompt`, and the only snapshot test is `ue-gotchas` (untouched), so Task 2's prompt change breaks no existing test. The new `wiring-requirements` test uses no snapshot. `WiringRequirement` moves modules but is re-exported from `prompt-builder.ts`, so any external importer keeps working.
