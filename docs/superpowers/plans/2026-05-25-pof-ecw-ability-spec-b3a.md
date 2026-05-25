# Generate GameplayEffect C++ from the Ability Spec (B3a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a callback-free `generate-gas-effects` CLI dispatch (+ a "Generate C++" button on the Effect Mapping card) that hands Claude an ability's `spec.effects[]` and an authoring contract so it writes buildable `UGameplayEffect` subclasses additively into the UE project's `Effects/Generated/`.

**Architecture:** Pure prompt builder (`effect-codegen-prompt.ts`) + a new CLITask type in the established UE-dispatch family (mirrors `character-setup`: project-context header + body, **no `@@CALLBACK`**) + a workspace button. Generation is Claude-authored at dispatch; the UE build is the gate. No app-side persistence.

**Tech Stack:** Next.js 16 / React 19, Vitest + Testing Library, the existing CLITask/`buildTaskPrompt`/`TaskFactory` system.

**Reference spec:** `docs/superpowers/specs/2026-05-25-pof-ecw-ability-spec-b3a-design.md`

**Invariants:** branch-local commits on `feature/entity-centric-workspace`; `@/` imports; `logger` (not `console`); co-author every commit with `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`. Each task ends targeted vitest green + `npx tsc --noEmit` clean **excluding the 3 pre-existing foreign `AssetInspector.tsx` errors** (filter with `| grep -v AssetInspector`).

---

## File Structure

| File | Change | Responsibility |
|------|--------|----------------|
| `src/lib/ability/effect-codegen-prompt.ts` | Create | `buildGenerateEffectsPrompt(ref, effects, tagRules)` — pure authoring-contract body |
| `src/__tests__/lib/ability/effect-codegen-prompt.test.ts` | Create | unit tests for the prompt body |
| `src/lib/cli-task.ts` | Modify | `'generate-gas-effects'` task type + `GenerateGasEffectsTask` + `buildTaskPrompt` case (header + body, no callback) + `TaskFactory.generateGasEffects` |
| `src/__tests__/lib/cli-task-generate-gas-effects.test.ts` | Create | the task's unit tests |
| `src/components/ecw/pipeline/workspaces/SpellbookLogicWorkspace.tsx` | Modify | add a "Generate C++" button on the Effect Mapping card |
| `src/__tests__/components/ecw/pipeline/SpellbookLogicWorkspace.test.tsx` | Modify | clicking "Generate C++" dispatches a `generate-gas-effects` task |

---

## Task 1: `buildGenerateEffectsPrompt` (pure authoring contract)

**Files:**
- Create: `src/lib/ability/effect-codegen-prompt.ts`
- Test: `src/__tests__/lib/ability/effect-codegen-prompt.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/lib/ability/effect-codegen-prompt.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildGenerateEffectsPrompt } from '@/lib/ability/effect-codegen-prompt';
import type { AbilityRef } from '@/lib/ability/logic-prompts';
import type { EditorEffect, TagRule } from '@/lib/ability/spec';

const ref: AbilityRef = {
  name: 'Fireball', element: 'Fire', tag: 'Ability.Fire.Fireball', category: 'Offensive', tier: 'advanced',
};
const effects: EditorEffect[] = [{
  id: 'off-fire-01-primary', name: 'Fire Strike', duration: 'duration', durationSec: 3, cooldownSec: 1,
  color: '#f87171', modifiers: [{ attribute: 'Health', operation: 'add', magnitude: -40 }], grantedTags: ['State.Burning'],
}];
const tagRules: TagRule[] = [{ id: 'r1', sourceTag: 'Ability.Fire.Fireball', targetTag: 'State.Dead', type: 'blocks' }];

describe('buildGenerateEffectsPrompt', () => {
  it('names the ability and enumerates each effect with its detail', () => {
    const p = buildGenerateEffectsPrompt(ref, effects, tagRules);
    expect(p).toContain('Fireball');
    expect(p).toContain('Fire Strike');
    expect(p).toContain('Health');     // modifier attribute
    expect(p).toMatch(/-40/);          // modifier magnitude
    expect(p).toContain('State.Burning'); // granted tag
    expect(p).toMatch(/duration/i);    // duration policy info
  });

  it('points Claude at the real UE references and the additive Generated/ folder', () => {
    const p = buildGenerateEffectsPrompt(ref, effects, tagRules);
    expect(p).toContain('Effects/Generated/');
    expect(p).toContain('UGE_Gen_');
    expect(p).toContain('ARPGAttributeSet');
    expect(p).toContain('ARPGGameplayTags');
    expect(p).toMatch(/GE_Heal/); // read an existing GE for the idiom
  });

  it('instructs the build + report step and lists the tag delta source', () => {
    const p = buildGenerateEffectsPrompt(ref, effects, tagRules);
    expect(p).toMatch(/build/i);
    expect(p).toMatch(/PoF\*?\.log|Saved\/Logs/);   // judge by abslog
    expect(p).toContain('README.md');               // tag-delta manifest
  });

  it('handles an ability with no effects without crashing', () => {
    const p = buildGenerateEffectsPrompt(ref, [], []);
    expect(p).toContain('Fireball');
    expect(typeof p).toBe('string');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/__tests__/lib/ability/effect-codegen-prompt.test.ts`
Expected: FAIL — `buildGenerateEffectsPrompt` is not exported / module missing.

- [ ] **Step 3: Implement the prompt builder**

Create `src/lib/ability/effect-codegen-prompt.ts`:

```ts
import type { AbilityRef } from '@/lib/ability/logic-prompts';
import type { EditorEffect, TagRule } from '@/lib/ability/spec';

const POLICY: Record<EditorEffect['duration'], string> = {
  instant: 'Instant',
  duration: 'HasDuration',
  infinite: 'Infinite',
};

/** One human-readable bullet describing an effect for the authoring contract. */
function describeEffect(e: EditorEffect): string {
  const mods = e.modifiers.length
    ? e.modifiers.map((m) => `${m.attribute} ${m.operation === 'add' ? '+=' : '*='} ${m.magnitude}`).join(', ')
    : 'no attribute modifiers';
  const tags = e.grantedTags.length ? `; grants ${e.grantedTags.join(', ')}` : '';
  const dur = e.duration === 'duration' ? ` (${e.durationSec}s)` : '';
  const period = e.cooldownSec > 0 ? `; period ${e.cooldownSec}s` : '';
  return `- "${e.name}" — DurationPolicy ${POLICY[e.duration]}${dur}; modifiers: ${mods}${period}${tags}`;
}

/**
 * Build the authoring contract for the generate-gas-effects dispatch (B3a). Pure.
 * Tells Claude to write one buildable UGameplayEffect subclass per effect into the
 * UE project's additive Effects/Generated/ folder, following the project's bespoke
 * GE_* conventions, then build the PoF module and report. `tagRules` is passed only
 * so the tag-delta report covers the rules' tags too. No UE files are authored here
 * — this is the prompt the CLI dispatch hands to Claude.
 */
export function buildGenerateEffectsPrompt(ability: AbilityRef, effects: EditorEffect[], tagRules: TagRule[]): string {
  const effectList = effects.length
    ? effects.map(describeEffect).join('\n')
    : '- (none authored yet — report that there is nothing to generate and stop)';
  const ruleTags = [...new Set(tagRules.flatMap((r) => [r.sourceTag, r.targetTag]))].filter(Boolean);
  const ruleTagNote = ruleTags.length
    ? `\nActivation rules reference these tags (include them in the tag-delta report if undeclared): ${ruleTags.join(', ')}.`
    : '';

  return [
    `Generate GameplayEffect C++ classes for the ability "${ability.name}" (gameplay tag ${ability.tag || 'Ability'}, ${ability.category}/${ability.element}/${ability.tier}) from its authored effects.`,
    '',
    'Effects to generate:',
    effectList,
    ruleTagNote,
    '',
    '## Contract',
    '1. READ FIRST for the project idiom — do NOT invent a new system:',
    '   - `Source/PoF/AbilitySystem/Effects/GE_Heal.h` and `.cpp` (and one more `GE_*`) for the UGameplayEffect constructor pattern;',
    '   - `Source/PoF/AbilitySystem/ARPGAttributeSet.h` for the real attribute names (Health, MaxHealth, Mana, Strength, Armor, AttackPower, …);',
    '   - `Source/PoF/AbilitySystem/ARPGGameplayTags.h` for the natively-declared gameplay tags.',
    '2. Write ONE `UGameplayEffect` subclass per effect into `Source/PoF/AbilitySystem/Effects/Generated/` (create the folder if absent). Name each `UGE_Gen_<AbilityName>_<EffectName>` with both parts sanitized to a valid C++ identifier. This folder is ADDITIVE — never edit or overwrite any hand-written `GE_*`.',
    '3. In each constructor: set `DurationPolicy` (Instant / HasDuration / Infinite) per the effect; for HasDuration set `DurationMagnitude = FScalableFloat(durationSec)`; if a period was given, set `Period = FScalableFloat(periodSec)` and add a comment that ability cooldown is a separate cooldown-GE concern. For each modifier add an `FGameplayModifierInfo` targeting `UARPGAttributeSet::Get<Attr>Attribute()` with `EGameplayModOp::Additive` (for `+=`) or `Multiplicitive` (for `*=`) and `FScalableFloat(magnitude)`. If an attribute name is not real, still emit it but mark it `// TODO: unknown attribute` rather than guessing.',
    '4. Granted tags → the effect\'s owned-tags container via `FGameplayTag::RequestGameplayTag(FName("<tag>"), /*ErrorIfNotFound*/ false)` so the class compiles even if the tag is not yet registered.',
    '5. Write `Source/PoF/AbilitySystem/Effects/Generated/README.md` listing the files created, the attribute mapping, and the TAG DELTA — every granted/rule tag NOT already declared in `ARPGGameplayTags.h`. Do NOT auto-edit the hand-written tags header.',
    '6. Build the PoF module (per the build command above; regenerate project files if a new `.cpp` requires it). The headless build/editor exits non-zero on a benign shutdown crash — judge success by the newest `Saved/Logs/PoF*.log`, NOT the exit code.',
    '7. Report: the files written, the attributes mapped, and any missing tags from the delta.',
  ].join('\n');
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/__tests__/lib/ability/effect-codegen-prompt.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -v AssetInspector | grep -iE "error TS" | head`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ability/effect-codegen-prompt.ts src/__tests__/lib/ability/effect-codegen-prompt.test.ts
git commit -m "$(cat <<'EOF'
feat(ability): buildGenerateEffectsPrompt — GE C++ authoring contract (B3a.1)

Pure prompt body for the generate-gas-effects dispatch: enumerates an ability's
effects and instructs Claude to write buildable UGameplayEffect subclasses into
Effects/Generated/ (read existing GE_* idiom, map modifiers to UARPGAttributeSet,
tag-delta manifest, build + judge by -abslog).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `generate-gas-effects` CLITask

**Files:**
- Modify: `src/lib/cli-task.ts` (import, type union, interface, `buildTaskPrompt` case, factory method)
- Test: `src/__tests__/lib/cli-task-generate-gas-effects.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/lib/cli-task-generate-gas-effects.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { TaskFactory, buildTaskPrompt } from '@/lib/cli-task';
import type { ProjectContext } from '@/lib/prompt-context';
import type { AbilityRef } from '@/lib/ability/logic-prompts';
import type { EditorEffect, TagRule } from '@/lib/ability/spec';

const ctx: ProjectContext = {
  projectName: 'PoF',
  projectPath: 'C:/Users/kazda/Documents/Unreal Projects/PoF',
  ueVersion: '5.7',
} as ProjectContext;

const ref: AbilityRef = {
  name: 'Fireball', element: 'Fire', tag: 'Ability.Fire.Fireball', category: 'Offensive', tier: 'advanced',
};
const effects: EditorEffect[] = [{
  id: 'off-fire-01-primary', name: 'Fire Strike', duration: 'instant', durationSec: 0, cooldownSec: 0,
  color: '#f87171', modifiers: [{ attribute: 'Health', operation: 'add', magnitude: -40 }], grantedTags: [],
}];
const tagRules: TagRule[] = [];

describe('generate-gas-effects task (ECW B3a)', () => {
  it('TaskFactory.generateGasEffects builds a typed task', () => {
    const t = TaskFactory.generateGasEffects('arpg-gas', { ref, effects, tagRules }, 'http://localhost:3000', 'Gen C++ Fireball');
    expect(t.type).toBe('generate-gas-effects');
    expect(t.ref.name).toBe('Fireball');
    expect(t.effects).toHaveLength(1);
    expect(t.appOrigin).toBe('http://localhost:3000');
  });

  it('buildTaskPrompt embeds the authoring contract and is callback-free', () => {
    const t = TaskFactory.generateGasEffects('arpg-gas', { ref, effects, tagRules }, 'http://localhost:3000', 'Gen');
    const prompt = buildTaskPrompt(t, ctx);
    expect(prompt).toContain('Fireball');
    expect(prompt).toContain('Fire Strike');
    expect(prompt).toContain('Effects/Generated/');
    expect(prompt).not.toContain('@@CALLBACK'); // callback-free, like character-setup
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/__tests__/lib/cli-task-generate-gas-effects.test.ts`
Expected: FAIL — `TaskFactory.generateGasEffects is not a function`.

- [ ] **Step 3: Add the import to `cli-task.ts`**

In `src/lib/cli-task.ts`, just below the existing `import { buildAbilitySpecDraftPrompt, type AbilityRef } from '@/lib/ability/logic-prompts';` line, add:

```ts
import { buildGenerateEffectsPrompt } from '@/lib/ability/effect-codegen-prompt';
import type { EditorEffect, TagRule } from '@/lib/ability/spec';
```

- [ ] **Step 4: Add the task type to the union**

In `src/lib/cli-task.ts`, in the `CLITaskType` union (ends with `| 'draft-ability-spec';`), add a member:

```ts
  | 'draft-ability-spec'
  | 'generate-gas-effects';
```

- [ ] **Step 5: Add the `GenerateGasEffectsTask` interface**

In `src/lib/cli-task.ts`, after the `DraftAbilitySpecTask` interface, add:

```ts
/**
 * Generate-gas-effects task (ECW Option B3a) — hands Claude an ability's authored
 * effects + an authoring contract; Claude writes buildable UGameplayEffect
 * subclasses additively into the UE project's Effects/Generated/, then builds the
 * PoF module and reports. Callback-free (verification is the build/-abslog, like
 * character-setup). No UE files are authored app-side.
 */
export interface GenerateGasEffectsTask extends CLITask {
  type: 'generate-gas-effects';
  ref: AbilityRef;
  effects: EditorEffect[];
  tagRules: TagRule[];
  appOrigin: string;
}
```

- [ ] **Step 6: Add the `buildTaskPrompt` case**

In `src/lib/cli-task.ts`, in the `switch (task.type)` block, after the `case 'draft-ability-spec': { … }` block (before `default:`), add:

```ts
    case 'generate-gas-effects': {
      const gt = task as GenerateGasEffectsTask;
      const header = buildProjectContextHeader(ctx, { knownAssetDomains });
      const body = buildGenerateEffectsPrompt(gt.ref, gt.effects, gt.tagRules);
      return `${header}\n\n## Task\n${body}`;
    }
```

- [ ] **Step 7: Add the `TaskFactory.generateGasEffects` method**

In `src/lib/cli-task.ts`, in the `TaskFactory` object, after the `draftAbilitySpec(…) { … },` method (before the closing `};`), add:

```ts
  /** Create a generate-gas-effects task (ECW B3a) — Claude writes buildable
   *  UGameplayEffect C++ from the ability's effects into Effects/Generated/. */
  generateGasEffects(
    moduleId: SubModuleId,
    params: { ref: AbilityRef; effects: EditorEffect[]; tagRules: TagRule[] },
    appOrigin: string,
    label: string,
  ): GenerateGasEffectsTask {
    return {
      type: 'generate-gas-effects',
      moduleId,
      prompt: '',
      label,
      ref: params.ref,
      effects: params.effects,
      tagRules: params.tagRules,
      appOrigin,
    };
  },
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run src/__tests__/lib/cli-task-generate-gas-effects.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 9: Run sibling cli-task tests (shared file)**

Run: `npx vitest run src/__tests__/lib/cli-task.test.ts src/__tests__/lib/cli-task-evaluate-track.test.ts src/__tests__/lib/cli-task-draft-ability-spec.test.ts`
Expected: all PASS.

- [ ] **Step 10: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -v AssetInspector | grep -iE "error TS" | head`
Expected: no output.

- [ ] **Step 11: Commit**

```bash
git add src/lib/cli-task.ts src/__tests__/lib/cli-task-generate-gas-effects.test.ts
git commit -m "$(cat <<'EOF'
feat(ability): generate-gas-effects CLI task — emit GE C++ to Generated/ (B3a.2)

Callback-free UE-dispatch task (character-setup family): project-context header +
buildGenerateEffectsPrompt body. Claude writes buildable UGameplayEffect subclasses
into Effects/Generated/ and builds the PoF module; verification is the -abslog.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: "Generate C++" button on the Effect Mapping card

**Files:**
- Modify: `src/components/ecw/pipeline/workspaces/SpellbookLogicWorkspace.tsx`
- Test: `src/__tests__/components/ecw/pipeline/SpellbookLogicWorkspace.test.tsx` (add one test)

The Effect Mapping `Card` currently has a single header button ("Draft with AI"). The `Card` component only renders one action button. We add a small secondary button **inside the card body** (above the editor) so both the AI draft (header) and the C++ generation (body) are reachable without changing the `Card` API.

- [ ] **Step 1: Write the failing test**

In `src/__tests__/components/ecw/pipeline/SpellbookLogicWorkspace.test.tsx`, add this test inside the existing `describe('SpellbookLogicWorkspace', …)` block (after the "Draft with AI" test):

```tsx
  it('dispatches a generate-gas-effects task from "Generate C++"', () => {
    render(<SpellbookLogicWorkspace entity={fireball} trackId="logic" />);
    fireEvent.click(screen.getByRole('button', { name: /generate c\+\+/i }));
    expect(execute).toHaveBeenCalledTimes(1);
    expect((execute.mock.calls[0][0] as { type: string }).type).toBe('generate-gas-effects');
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/__tests__/components/ecw/pipeline/SpellbookLogicWorkspace.test.tsx -t "Generate C\+\+"`
Expected: FAIL — no "Generate C++" button.

- [ ] **Step 3: Add the dispatch + button**

In `src/components/ecw/pipeline/workspaces/SpellbookLogicWorkspace.tsx`, add the dispatch handler next to the existing `draftSpec` (after it):

```tsx
  const generateCpp = () =>
    void cli.execute(TaskFactory.generateGasEffects('arpg-gas', { ref, effects: spec.effects, tagRules: spec.tagRules }, getAppOrigin(), `Gen C++ · ${entity.name}`));
```

Then change the Effect Mapping card to render the editor with a "Generate C++" button above it. Replace this block:

```tsx
        <Card icon={<Sparkles className="w-4 h-4 text-text-muted" />} title="Effect Mapping" action="Draft with AI" busy={cli.isRunning} onChange={draftSpec}>
          <EffectTimelineEditor effects={spec.effects} onChange={onEffectsChange} />
        </Card>
```

with:

```tsx
        <Card icon={<Sparkles className="w-4 h-4 text-text-muted" />} title="Effect Mapping" action="Draft with AI" busy={cli.isRunning} onChange={draftSpec}>
          <div className="flex justify-end">
            <button
              onClick={generateCpp}
              disabled={cli.isRunning || spec.effects.length === 0}
              className="focus-ring px-2 py-1 rounded text-2xs border border-border/50 text-text hover:bg-surface/40 disabled:opacity-50"
            >
              Generate C++
            </button>
          </div>
          <EffectTimelineEditor effects={spec.effects} onChange={onEffectsChange} />
        </Card>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/__tests__/components/ecw/pipeline/SpellbookLogicWorkspace.test.tsx`
Expected: PASS (5 tests — the 4 existing + the new one).

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit 2>&1 | grep -v AssetInspector | grep -iE "error TS" | head`
Expected: no output.

Run: `npx eslint src/components/ecw/pipeline/workspaces/SpellbookLogicWorkspace.tsx`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/ecw/pipeline/workspaces/SpellbookLogicWorkspace.tsx src/__tests__/components/ecw/pipeline/SpellbookLogicWorkspace.test.tsx
git commit -m "$(cat <<'EOF'
feat(ecw): "Generate C++" button dispatches generate-gas-effects (B3a.3)

The Effect Mapping card gains a Generate C++ action (disabled when no effects are
authored) that hands the ability's spec.effects[] to the generate-gas-effects
dispatch. Completes the B3a app-side surface.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Final Verification (app side)

- [ ] **Run the full ability + workspace + cli-task suite**

Run: `npx vitest run src/__tests__/lib/ability src/__tests__/lib/cli-task-generate-gas-effects.test.ts src/__tests__/lib/cli-task-draft-ability-spec.test.ts src/__tests__/components/ecw/pipeline/SpellbookLogicWorkspace.test.tsx`
Expected: all green.

- [ ] **Typecheck the whole project (excluding the pre-existing AssetInspector errors)**

Run: `npx tsc --noEmit 2>&1 | grep -iE "error TS" | grep -v AssetInspector | wc -l`
Expected: `0`.

---

## UE-side proof (separate, operator/editor-gated — NOT part of the app commits)

The app-side deliverable above is the dispatch mechanism. The actual C++ generation + build runs against the UE editor and is the **build gate** from the spec. Run it once an ability has authored effects:

- [ ] Open the app, navigate to a spellbook ability's **Logic** track, author/draft effects, click **Generate C++**, and let the dispatched CLI session write the `UGE_Gen_*` classes into `Source/PoF/AbilitySystem/Effects/Generated/` and build the `PoF` module.
- [ ] Confirm success by the newest `Saved/Logs/PoF*.log` (build succeeded; ignore a non-zero exit from the benign shutdown crash) and review `Effects/Generated/README.md` for the file list + tag delta.
- [ ] Commit the UE changes narrowly in the `pof-exp` repo (`-abslog` discipline; only the `Generated/` folder + README).

This step needs the UE editor + an ability with authored effects; it is gated on operator availability and is **not** a blocker for the app-side commits.

---

## Self-Review Notes (resolved during planning)

- **Spec coverage:** authoring contract (Task 1 prompt) covers spec §"authoring contract" points 1–7; the callback-free dispatch + header (Task 2) covers §architecture; the button (Task 3) covers §components; app-side tests (all 3 tasks) cover §testing; the UE build gate is the separate "UE-side proof" section. tagRules→activation-tags, the seeder, and the functional test remain explicitly out of scope (B3b/B3c/stretch).
- **Placeholder scan:** the only `TODO` strings are inside the *generated-code instruction* (`// TODO: unknown attribute`) — intentional contract text, not a plan placeholder.
- **Type consistency:** `AbilityRef` (from `logic-prompts.ts`), `EditorEffect`/`TagRule` (from `@/lib/ability/spec`) used consistently across Tasks 1–3; `TaskFactory.generateGasEffects(moduleId, { ref, effects, tagRules }, appOrigin, label)` signature identical in the factory (Task 2 Step 7), the cli-task test (Task 2 Step 1), and the workspace call (Task 3 Step 3). `buildProjectContextHeader` + `knownAssetDomains` are already in scope in `buildTaskPrompt` (used by the other cases).
- **No-callback consistency:** Task 2's case uses no `registerCallback`; the test asserts the prompt has no `@@CALLBACK` — matches the spec's callback-free decision.
```
