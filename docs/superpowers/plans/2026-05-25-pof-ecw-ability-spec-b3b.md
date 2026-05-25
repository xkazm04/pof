# Generate the Wiring Ability C++ (B3b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the single "Generate C++" dispatch so one run authors the GameplayEffects (B3a) **and** a `UGA_Gen_*` ability that applies them on activation and carries the spec's activation tag rules — additively in `Abilities/Generated/`.

**Architecture:** Rename + grow the pure prompt builder into `buildGenerateAbilityBundlePrompt` (GE section, with B3a's proven idiom corrections, + a new ability section); thread an optional `scalars` (manaCost/cooldown) through the existing callback-free `generate-gas-effects` task; the "Generate C++" button passes the entity scalars. No new task type or button.

**Tech Stack:** Next.js 16 / React 19, Vitest, the existing CLITask/`buildTaskPrompt`/`TaskFactory` system.

**Reference spec:** `docs/superpowers/specs/2026-05-25-pof-ecw-ability-spec-b3b-design.md`

**Invariants:** branch-local commits on `feature/entity-centric-workspace`; `@/` imports; `logger` (not `console`); co-author every commit with `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`. Each task ends targeted vitest green + `npx tsc --noEmit` clean **excluding the 3 pre-existing foreign `AssetInspector.tsx` errors** (filter with `| grep -v AssetInspector`).

---

## File Structure

| File | Change | Responsibility |
|------|--------|----------------|
| `src/lib/ability/effect-codegen-prompt.ts` | Rewrite | `buildGenerateAbilityBundlePrompt(ref, effects, tagRules, scalars?)` — GE section (idiom-corrected) + ability section |
| `src/__tests__/lib/ability/effect-codegen-prompt.test.ts` | Rewrite | tests for both sections + scalar threading |
| `src/lib/cli-task.ts` | Modify | import rename; `GenerateGasEffectsTask.scalars?`; case calls the bundle prompt; factory accepts `scalars` |
| `src/__tests__/lib/cli-task-generate-gas-effects.test.ts` | Modify | assert ability section present + scalars carried |
| `src/components/ecw/pipeline/workspaces/SpellbookLogicWorkspace.tsx` | Modify | "Generate C++" passes `scalars: { manaCost, cooldown }` |
| `src/__tests__/components/ecw/pipeline/SpellbookLogicWorkspace.test.tsx` | Modify | assert the dispatched task carries `scalars` |

---

## Task 1: `buildGenerateAbilityBundlePrompt` (rename + idiom fix + ability section)

**Files:**
- Rewrite: `src/lib/ability/effect-codegen-prompt.ts`
- Rewrite: `src/__tests__/lib/ability/effect-codegen-prompt.test.ts`

- [ ] **Step 1: Replace the test file**

Replace the entire contents of `src/__tests__/lib/ability/effect-codegen-prompt.test.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import { buildGenerateAbilityBundlePrompt } from '@/lib/ability/effect-codegen-prompt';
import type { AbilityRef } from '@/lib/ability/logic-prompts';
import type { EditorEffect, TagRule } from '@/lib/ability/spec';

const ref: AbilityRef = {
  name: 'Fireball', element: 'Fire', tag: 'Ability.Fire.Fireball', category: 'Offensive', tier: 'advanced',
};
const effects: EditorEffect[] = [{
  id: 'off-fire-01-primary', name: 'Fire Strike', duration: 'duration', durationSec: 3, cooldownSec: 1,
  color: '#f87171', modifiers: [{ attribute: 'Health', operation: 'add', magnitude: -40 }], grantedTags: ['State.Burning'],
}];
const tagRules: TagRule[] = [
  { id: 'r1', sourceTag: 'Ability.Fire.Fireball', targetTag: 'State.Dead', type: 'blocks' },
  { id: 'r2', sourceTag: 'Ability.Fire.Fireball', targetTag: 'State.Channeling', type: 'requires' },
];

describe('buildGenerateAbilityBundlePrompt', () => {
  it('Part A — names the ability and enumerates each effect with its detail', () => {
    const p = buildGenerateAbilityBundlePrompt(ref, effects, tagRules);
    expect(p).toContain('Fireball');
    expect(p).toContain('Fire Strike');
    expect(p).toContain('Health');
    expect(p).toMatch(/-40/);
    expect(p).toContain('State.Burning');
  });

  it('Part A — points at the real GE idiom + additive Effects/Generated/ folder', () => {
    const p = buildGenerateAbilityBundlePrompt(ref, effects, tagRules);
    expect(p).toContain('Effects/Generated/');
    expect(p).toContain('UGE_Gen_');
    expect(p).toContain('ARPGAttributeSet');
    expect(p).toContain('FGameplayEffectModifierMagnitude'); // proven idiom (not bare FScalableFloat(x))
    expect(p).toContain('UTargetTagsGameplayEffectComponent'); // proven granted-tag idiom
    expect(p).toMatch(/GE_Stun/);
  });

  it('Part B — instructs the wiring ability + maps tag rules to activation tags', () => {
    const p = buildGenerateAbilityBundlePrompt(ref, effects, tagRules);
    expect(p).toContain('Abilities/Generated/');
    expect(p).toContain('UGA_Gen_');
    expect(p).toMatch(/ARPGGameplayAbility/);
    expect(p).toMatch(/GA_WarCry/);
    expect(p).toContain('ActivationBlockedTags');   // blocks
    expect(p).toContain('ActivationRequiredTags');  // requires
    expect(p).toContain('CancelAbilitiesWithTag');  // cancels
    expect(p).toContain('StaticClass');             // references the generated GE classes
  });

  it('Part B — threads the mana-cost scalar when supplied', () => {
    const p = buildGenerateAbilityBundlePrompt(ref, effects, tagRules, { manaCost: 15, cooldown: 6 });
    expect(p).toContain('AbilityManaCost = 15');
  });

  it('Part C — instructs the build + report + tag-delta manifest', () => {
    const p = buildGenerateAbilityBundlePrompt(ref, effects, tagRules);
    expect(p).toMatch(/build/i);
    expect(p).toMatch(/PoF\*?\.log|Saved\/Logs/);
    expect(p).toContain('README.md');
  });

  it('handles an ability with no effects without crashing', () => {
    const p = buildGenerateAbilityBundlePrompt(ref, [], []);
    expect(p).toContain('Fireball');
    expect(typeof p).toBe('string');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/__tests__/lib/ability/effect-codegen-prompt.test.ts`
Expected: FAIL — `buildGenerateAbilityBundlePrompt` is not exported.

- [ ] **Step 3: Rewrite the prompt builder**

Replace the entire contents of `src/lib/ability/effect-codegen-prompt.ts` with:

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

const RULE_TARGET: Record<TagRule['type'], string> = {
  blocks: 'ActivationBlockedTags',
  requires: 'ActivationRequiredTags',
  cancels: 'CancelAbilitiesWithTag',
};

/** One bullet describing how a tag rule maps onto the generated ability. */
function describeRule(r: TagRule): string {
  return `- ${r.type} "${r.targetTag}" → ${RULE_TARGET[r.type]}`;
}

/**
 * Build the authoring contract for the "Generate C++" bundle dispatch (B3a + B3b).
 * Pure. Instructs Claude to write, additively into the UE project: (A) one buildable
 * UGameplayEffect subclass per effect (Effects/Generated/), and (B) a UARPGGameplayAbility
 * subclass (Abilities/Generated/) that applies those effects and carries the activation
 * tag rules — then (C) build the PoF module and report. The GE idiom matches what the
 * B3a UE proof confirmed compiles. No UE files are authored here.
 */
export function buildGenerateAbilityBundlePrompt(
  ability: AbilityRef,
  effects: EditorEffect[],
  tagRules: TagRule[],
  scalars?: { manaCost?: number; cooldown?: number },
): string {
  const effectList = effects.length
    ? effects.map(describeEffect).join('\n')
    : '- (none authored yet — report that there is nothing to generate and stop)';
  const ruleList = tagRules.length ? tagRules.map(describeRule).join('\n') : '- (no activation rules)';
  const manaNote = scalars?.manaCost != null
    ? `Set \`AbilityManaCost = ${scalars.manaCost}\`.`
    : 'No mana cost provided — leave a `// TODO: mana cost` comment.';

  return [
    `Generate the C++ bundle for the ability "${ability.name}" (gameplay tag ${ability.tag || 'Ability'}, ${ability.category}/${ability.element}/${ability.tier}): its GameplayEffects AND the ability that applies them.`,
    '',
    'Effects to generate:',
    effectList,
    '',
    'Activation tag rules to wire onto the ability:',
    ruleList,
    '',
    '## Contract — Part A: GameplayEffects',
    '1. READ FIRST for the project idiom — do NOT invent a new system:',
    '   - `Source/PoF/AbilitySystem/Effects/GE_Heal.cpp` (instant additive), `GE_Regen_Health.cpp` (periodic duration), `GE_Stun.cpp` (granted tags) for the UGameplayEffect constructor patterns;',
    '   - `Source/PoF/AbilitySystem/ARPGAttributeSet.h` for the real attributes and their `Get<Attr>Attribute()` accessors;',
    '   - `Source/PoF/AbilitySystem/ARPGGameplayTags.h` for the natively-declared tags.',
    '2. Write ONE `UGameplayEffect` subclass per effect into `Source/PoF/AbilitySystem/Effects/Generated/`. Name each `UGE_Gen_<AbilityName>_<EffectName>` (file `GE_Gen_<AbilityName>_<EffectName>.{h,cpp}`, both parts sanitized; include bare `GE_Gen_<…>.generated.h`). Additive — never edit hand-written `GE_*`.',
    '3. Constructor: `DurationPolicy = EGameplayEffectDurationType::{Instant|HasDuration|Infinite}`; for HasDuration `DurationMagnitude = FGameplayEffectModifierMagnitude(FScalableFloat)` (set `.Value`); for a period set `Period.Value =` and `bExecutePeriodicEffectOnApplication = false` (DoT tick, NOT ability cooldown). Each modifier → `FGameplayModifierInfo` with `.Attribute = UARPGAttributeSet::Get<Attr>Attribute()`, `.ModifierOp = EGameplayModOp::Additive` (`+=`) or `Multiplicitive` (`*=`), `.ModifierMagnitude = FGameplayEffectModifierMagnitude(FScalableFloat)`; then `Modifiers.Add(...)`. Unknown attribute → `// TODO: unknown attribute` comment.',
    '4. Granted tags (UE 5.7 component idiom — see `GE_Stun.cpp`): create a `UTargetTagsGameplayEffectComponent`, add it to `GEComponents`, and `SetAndApplyTargetTagChanges` an `FInheritedTagContainer`. Declared tags via native refs `ARPGGameplayTags::<Tag>`; an UNdeclared tag via `FGameplayTag::RequestGameplayTag(FName("<tag>"), /*ErrorIfNotFound*/ false)` guarded by `IsValid()` (skip if invalid) and record it in the tag delta.',
    '',
    '## Contract — Part B: the wiring ability',
    '5. READ `Source/PoF/AbilitySystem/ARPGGameplayAbility.h` (base: `ApplyEffectToSelf`/`ApplyEffectToTarget`, `bAutoEndAbility`, `AbilityManaCost`) and `Source/PoF/AbilitySystem/GA_WarCry.cpp` (the commit → apply-GE → end idiom).',
    '6. Write ONE `UARPGGameplayAbility` subclass `UGA_Gen_<AbilityName>` (file `GA_Gen_<AbilityName>.{h,cpp}`) into `Source/PoF/AbilitySystem/Abilities/Generated/` (create the folder; additive — never touch hand-written `GA_*`).',
    `7. Constructor: ${manaNote} Set \`bAutoEndAbility = true\`. Wire the activation tag rules above — \`blocks\`→\`ActivationBlockedTags\`, \`requires\`→\`ActivationRequiredTags\`, \`cancels\`→\`CancelAbilitiesWithTag\` — using native refs \`ARPGGameplayTags::<Tag>\` for declared tags and the guarded \`RequestGameplayTag(...,false)\`+\`IsValid()\` pattern for undeclared ones (record those in the tag delta). Leave a \`// TODO: cooldown GE\` comment (out of scope).`,
    '8. `ActivateAbility`: `CommitAbility` (on failure `EndAbility(Handle, ActorInfo, ActivationInfo, true, true)` and return); then apply each generated GE — DAMAGING effects (a modifier reducing Health) via `ApplyEffectToTarget(TargetASC, UGE_Gen_<AbilityName>_<EffectName>::StaticClass())`, BUFFS/HEALS via `ApplyEffectToSelf(...)`; if ambiguous default to target and comment. Finish with `EndAbility(Handle, ActorInfo, ActivationInfo, true, false)`.',
    '',
    '## Contract — Part C: report + build',
    '9. Write `Source/PoF/AbilitySystem/Effects/Generated/README.md` listing the GE + ability files, the attribute mapping, the tag→ActivationTags wiring, and the TAG DELTA — every granted/rule tag NOT declared in `ARPGGameplayTags.h` (do NOT auto-edit the tags header).',
    '10. Build the PoF module (per the build command above; regenerate project files if new `.cpp` files require it). The headless build/editor exits non-zero on a benign shutdown crash — judge success by the newest `Saved/Logs/PoF*.log`, NOT the exit code.',
    '11. Report: files written, attributes mapped, activation tags wired, and any missing tags.',
  ].join('\n');
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/__tests__/lib/ability/effect-codegen-prompt.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Rename the call site in `cli-task.ts` (keeps tsc green)**

In `src/lib/cli-task.ts`, change the import line:

```ts
import { buildGenerateEffectsPrompt } from '@/lib/ability/effect-codegen-prompt';
```

to:

```ts
import { buildGenerateAbilityBundlePrompt } from '@/lib/ability/effect-codegen-prompt';
```

and the `generate-gas-effects` case body call (scalars threaded in Task 2):

```ts
    case 'generate-gas-effects': {
      const gt = task as GenerateGasEffectsTask;
      const header = buildProjectContextHeader(ctx, { knownAssetDomains });
      const body = buildGenerateAbilityBundlePrompt(gt.ref, gt.effects, gt.tagRules);
      return `${header}\n\n## Task\n${body}`;
    }
```

- [ ] **Step 6: Typecheck (clean)**

Run: `npx tsc --noEmit 2>&1 | grep -v AssetInspector | grep -iE "error TS" | head`
Expected: no output. (The rename is resolved at its only call site; `scalars` is added next task.)

- [ ] **Step 7: Commit**

```bash
git add src/lib/ability/effect-codegen-prompt.ts src/__tests__/lib/ability/effect-codegen-prompt.test.ts src/lib/cli-task.ts
git commit -m "$(cat <<'EOF'
feat(ability): buildGenerateAbilityBundlePrompt — GE + wiring ability (B3b.1)

Renames buildGenerateEffectsPrompt and grows it: Part A (GameplayEffects, with the
idiom corrections the B3a UE proof confirmed — FGameplayEffectModifierMagnitude,
UTargetTagsGameplayEffectComponent, Period.Value), Part B (a UGA_Gen_* ability that
applies the GEs + wires blocks/requires/cancels onto activation tags), Part C (build
+ report). Updates the cli-task call site to the new name.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: thread the bundle prompt + `scalars` through the CLI task

**Files:**
- Modify: `src/lib/cli-task.ts`
- Modify: `src/__tests__/lib/cli-task-generate-gas-effects.test.ts`

- [ ] **Step 1: Update the cli-task test (extend for ability section + scalars)**

Replace the entire contents of `src/__tests__/lib/cli-task-generate-gas-effects.test.ts` with:

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
const tagRules: TagRule[] = [{ id: 'r1', sourceTag: 'Ability.Fire.Fireball', targetTag: 'State.Dead', type: 'blocks' }];

describe('generate-gas-effects task (ECW B3a + B3b bundle)', () => {
  it('TaskFactory.generateGasEffects builds a typed task and carries scalars', () => {
    const t = TaskFactory.generateGasEffects('arpg-gas', { ref, effects, tagRules, scalars: { manaCost: 20, cooldown: 6 } }, 'http://localhost:3000', 'Gen C++ Fireball');
    expect(t.type).toBe('generate-gas-effects');
    expect(t.ref.name).toBe('Fireball');
    expect(t.effects).toHaveLength(1);
    expect(t.scalars?.manaCost).toBe(20);
    expect(t.appOrigin).toBe('http://localhost:3000');
  });

  it('buildTaskPrompt embeds the GE + ability bundle contract and is callback-free', () => {
    const t = TaskFactory.generateGasEffects('arpg-gas', { ref, effects, tagRules, scalars: { manaCost: 20 } }, 'http://localhost:3000', 'Gen');
    const prompt = buildTaskPrompt(t, ctx);
    expect(prompt).toContain('Fireball');
    expect(prompt).toContain('Fire Strike');
    expect(prompt).toContain('Effects/Generated/');   // Part A
    expect(prompt).toContain('Abilities/Generated/');  // Part B
    expect(prompt).toContain('UGA_Gen_');
    expect(prompt).toContain('AbilityManaCost = 20');  // scalar threaded
    expect(prompt).not.toContain('@@CALLBACK');        // callback-free
  });

  it('omits the mana cost when no scalars are supplied', () => {
    const t = TaskFactory.generateGasEffects('arpg-gas', { ref, effects, tagRules }, 'http://localhost:3000', 'Gen');
    const prompt = buildTaskPrompt(t, ctx);
    expect(prompt).toMatch(/TODO: mana cost/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/__tests__/lib/cli-task-generate-gas-effects.test.ts`
Expected: FAIL — `scalars` not accepted by the factory / `AbilityManaCost` not in prompt (scalars not yet threaded).

- [ ] **Step 3: Add `scalars` to the `GenerateGasEffectsTask` interface**

In `src/lib/cli-task.ts`, change the `GenerateGasEffectsTask` interface body to add the optional field:

```ts
export interface GenerateGasEffectsTask extends CLITask {
  type: 'generate-gas-effects';
  ref: AbilityRef;
  effects: EditorEffect[];
  tagRules: TagRule[];
  /** Optional entity scalars (catalog data) — used for AbilityManaCost on the generated ability. */
  scalars?: { manaCost?: number; cooldown?: number };
  appOrigin: string;
}
```

- [ ] **Step 4: Update the `buildTaskPrompt` case to thread scalars**

In `src/lib/cli-task.ts`, change the `generate-gas-effects` case body (set in B3b.1 without scalars) to pass `gt.scalars`:

```ts
    case 'generate-gas-effects': {
      const gt = task as GenerateGasEffectsTask;
      const header = buildProjectContextHeader(ctx, { knownAssetDomains });
      const body = buildGenerateAbilityBundlePrompt(gt.ref, gt.effects, gt.tagRules, gt.scalars);
      return `${header}\n\n## Task\n${body}`;
    }
```

- [ ] **Step 5: Update the `TaskFactory.generateGasEffects` method**

In `src/lib/cli-task.ts`, change the `generateGasEffects` factory to accept and pass `scalars`:

```ts
  /** Create a generate-gas-effects task (ECW B3a/B3b) — Claude writes buildable
   *  UGameplayEffect C++ + a UGA_Gen_* wiring ability into the additive Generated/ folders. */
  generateGasEffects(
    moduleId: SubModuleId,
    params: { ref: AbilityRef; effects: EditorEffect[]; tagRules: TagRule[]; scalars?: { manaCost?: number; cooldown?: number } },
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
      scalars: params.scalars,
      appOrigin,
    };
  },
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run src/__tests__/lib/cli-task-generate-gas-effects.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Run sibling cli-task tests + typecheck**

Run: `npx vitest run src/__tests__/lib/cli-task.test.ts src/__tests__/lib/cli-task-evaluate-track.test.ts src/__tests__/lib/cli-task-draft-ability-spec.test.ts`
Expected: all PASS.

Run: `npx tsc --noEmit 2>&1 | grep -v AssetInspector | grep -iE "error TS" | head`
Expected: no output.

- [ ] **Step 8: Commit**

```bash
git add src/lib/cli-task.ts src/__tests__/lib/cli-task-generate-gas-effects.test.ts
git commit -m "$(cat <<'EOF'
feat(ability): thread scalars through generate-gas-effects (B3b.2)

The generate-gas-effects task now carries an optional scalars {manaCost,cooldown}
and passes it to buildGenerateAbilityBundlePrompt so the generated ability can set
AbilityManaCost. Still callback-free.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: pass entity scalars from the "Generate C++" button

**Files:**
- Modify: `src/components/ecw/pipeline/workspaces/SpellbookLogicWorkspace.tsx`
- Modify: `src/__tests__/components/ecw/pipeline/SpellbookLogicWorkspace.test.tsx`

- [ ] **Step 1: Update the workspace test (assert scalars carried)**

In `src/__tests__/components/ecw/pipeline/SpellbookLogicWorkspace.test.tsx`, replace the existing "Generate C++" test with this version (adds a scalars assertion):

```tsx
  it('dispatches a generate-gas-effects task carrying entity scalars from "Generate C++"', () => {
    render(<SpellbookLogicWorkspace entity={fireball} trackId="logic" />);
    fireEvent.click(screen.getByRole('button', { name: /generate c\+\+/i }));
    expect(execute).toHaveBeenCalledTimes(1);
    const task = execute.mock.calls[0][0] as { type: string; scalars?: { manaCost?: number; cooldown?: number } };
    expect(task.type).toBe('generate-gas-effects');
    expect(task.scalars?.manaCost).toBe(20); // fireball fixture manaCost
    expect(task.scalars?.cooldown).toBe(6);  // fireball fixture cooldown
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/__tests__/components/ecw/pipeline/SpellbookLogicWorkspace.test.tsx -t "entity scalars"`
Expected: FAIL — the dispatched task has no `scalars`.

- [ ] **Step 3: Thread scalars into the dispatch**

In `src/components/ecw/pipeline/workspaces/SpellbookLogicWorkspace.tsx`, change the `generateCpp` handler:

```tsx
  const generateCpp = () =>
    void cli.execute(TaskFactory.generateGasEffects('arpg-gas', { ref, effects: spec.effects, tagRules: spec.tagRules }, getAppOrigin(), `Gen C++ · ${entity.name}`));
```

to:

```tsx
  const generateCpp = () =>
    void cli.execute(TaskFactory.generateGasEffects('arpg-gas', { ref, effects: spec.effects, tagRules: spec.tagRules, scalars: { manaCost: a.manaCost, cooldown: a.cooldown } }, getAppOrigin(), `Gen C++ · ${entity.name}`));
```

- [ ] **Step 4: Run the workspace suite to verify it passes**

Run: `npx vitest run src/__tests__/components/ecw/pipeline/SpellbookLogicWorkspace.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit 2>&1 | grep -v AssetInspector | grep -iE "error TS" | head`
Expected: no output.

Run: `npx eslint src/components/ecw/pipeline/workspaces/SpellbookLogicWorkspace.tsx`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/ecw/pipeline/workspaces/SpellbookLogicWorkspace.tsx src/__tests__/components/ecw/pipeline/SpellbookLogicWorkspace.test.tsx
git commit -m "$(cat <<'EOF'
feat(ecw): pass entity scalars to the Generate C++ bundle dispatch (B3b.3)

The Effect Mapping "Generate C++" button now threads the ability's manaCost/cooldown
into generate-gas-effects so the generated UGA_Gen_* ability can set AbilityManaCost.
Completes the B3b app-side surface.

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

Regenerate the bundle and confirm the ability + effects compile and link:

- [ ] In the UE project, the dispatched session (or I, acting as it) writes `UGE_Gen_Fireball_*` (Effects/Generated/) **and** `UGA_Gen_Fireball` (Abilities/Generated/) wiring the GEs + the default activation tag rules (block while Dead/Stunned), then builds `PoFEditor Win64 Development`.
- [ ] Confirm via the newest `Saved/Logs/PoF*.log` that both the GE files and `GA_Gen_Fireball.cpp` compiled and `UnrealEditor-PoF.dll` linked (`Result: Succeeded`); ignore the non-zero exit from the benign shutdown crash.
- [ ] Build command: `& "C:\Program Files\Epic Games\UE_5.7\Engine\Build\BatchFiles\Build.bat" PoFEditor Win64 Development -Project="C:\Users\kazda\Documents\Unreal Projects\PoF\PoF.uproject" -WaitMutex`.
- [ ] Commit the UE changes narrowly to `pof-exp` (only `Abilities/Generated/` + `Effects/Generated/` + READMEs); do not push.

Needs the UE editor; gated on operator availability; not a blocker for the app-side commits.

---

## Self-Review Notes (resolved during planning)

- **Spec coverage:** the bundle prompt's Part A (GE, idiom-corrected) + Part B (ability + tag-rule→activation mapping) + Part C (build/report) cover the spec's contract; `scalars` threading (Tasks 2–3) covers the manaCost note; the single dispatch / no-new-button / callback-free decisions are preserved (Task 2 keeps the type + asserts no `@@CALLBACK`); the UE proof is the separate gated section. tagRules→activation-tags is fully in B3b; cooldown-GE, native-tag edits, bespoke `GA_*`, the DataTable (B3c), and the functional test stay out of scope.
- **Placeholder scan:** the only `TODO` strings are intentional generated-code instructions (`// TODO: mana cost`, `// TODO: cooldown GE`, `// TODO: unknown attribute`).
- **Type consistency:** `buildGenerateAbilityBundlePrompt(ref, effects, tagRules, scalars?)` signature identical in the prompt file (Task 1 Step 3), the cli-task case (Task 2 Step 5), and the test (Task 1 Step 1); `GenerateGasEffectsTask.scalars?` and the factory `params.scalars` match (Task 2 Steps 4, 6); the workspace passes `scalars: { manaCost: a.manaCost, cooldown: a.cooldown }` matching the factory param shape (Task 3 Step 3). `a.manaCost`/`a.cooldown` are `number | undefined` on `AbilityData` — assignable to the optional `scalars` fields.
- **Every commit tsc-clean:** Task 1 folds the minimal `cli-task.ts` call-site rename in (Step 5), so its commit is fully green; Task 2 then only adds the `scalars` field/threading. No commit is left with a known tsc error.
```
