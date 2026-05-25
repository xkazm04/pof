# Wire the Rich GAS Editors into Spellbook Logic (B2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the spellbook `logic` track edit a persisted `EnrichedAbilitySpec` through the legacy `EffectTimelineEditor` + `TagRulesEditor`, with debounced write-back and an AI "Draft" assist.

**Architecture:** Reuse the B1 data layer (`abilitySpecStore` + `/api/ability-spec`) untouched. Add one callback-bearing CLI task (`draft-ability-spec`, mirroring `evaluate-track`) that POSTs a proposed `{effects, tagRules}` to `/api/ability-spec`. In `SpellbookLogicWorkspace`, load the spec on entity open (falling back to `deriveDefaultSpec`), mount the two controlled editors bound to the spec, and persist edits optimistically + debounced.

**Tech Stack:** Next.js 16 / React 19, Zustand v5 store, Vitest + Testing Library, the existing `@@CALLBACK` task system.

**Reference spec:** `docs/superpowers/specs/2026-05-25-pof-ecw-ability-spec-b2-design.md`

**Invariants:** branch-local commits on `feature/entity-centric-workspace`; `@/` imports; `logger` (not `console`); no hardcoded hex (editors already use chart-colors); timing via `UI_TIMEOUTS`; co-author every commit with `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`. Each task ends targeted vitest green + `npx tsc --noEmit` clean **excluding the 3 pre-existing foreign `AssetInspector.tsx` errors** (filter with `| grep -v AssetInspector`).

---

## File Structure

| File | Change | Responsibility |
|------|--------|----------------|
| `src/lib/ability/logic-prompts.ts` | Modify | add `buildAbilitySpecDraftPrompt(ref, instruction)` — pure prompt body for the draft task |
| `src/lib/cli-task.ts` | Modify | `'draft-ability-spec'` task type + `DraftAbilitySpecTask` + `buildTaskPrompt` case + `TaskFactory.draftAbilitySpec` |
| `src/__tests__/lib/cli-task-draft-ability-spec.test.ts` | Create | the draft task's unit tests |
| `src/lib/constants.ts` | Modify | add `UI_TIMEOUTS.specSaveDebounce` |
| `src/components/ecw/pipeline/workspaces/SpellbookLogicWorkspace.tsx` | Modify | load-on-open, mount the two editors, debounced persist, Draft dispatch |
| `src/__tests__/components/ecw/pipeline/SpellbookLogicWorkspace.test.tsx` | Modify | editors render populated; edit persists; Draft dispatches the new task |

---

## Task 1: `draft-ability-spec` CLI plumbing

**Files:**
- Modify: `src/lib/ability/logic-prompts.ts` (append a function)
- Modify: `src/lib/cli-task.ts` (import, type union, interface, `buildTaskPrompt` case, factory method)
- Test: `src/__tests__/lib/cli-task-draft-ability-spec.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/lib/cli-task-draft-ability-spec.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { TaskFactory, buildTaskPrompt } from '@/lib/cli-task';
import type { ProjectContext } from '@/lib/prompt-context';
import type { AbilityRef } from '@/lib/ability/logic-prompts';

const ctx: ProjectContext = {
  projectName: 'PoF',
  projectPath: 'C:/Users/kazda/Documents/Unreal Projects/PoF',
  ueVersion: '5.7',
} as ProjectContext;

const ref: AbilityRef = {
  name: 'Fireball', element: 'Fire', tag: 'Ability.Fire.Fireball', category: 'Offensive', tier: 'advanced',
};

describe('draft-ability-spec task (ECW B2)', () => {
  it('TaskFactory.draftAbilitySpec builds a typed task', () => {
    const t = TaskFactory.draftAbilitySpec(
      'arpg-gas',
      { catalogId: 'spellbook', entityId: 'off-fire-01', ref, instruction: 'make it burn over time' },
      'http://localhost:3000',
      'Draft Fireball',
    );
    expect(t.type).toBe('draft-ability-spec');
    expect(t.catalogId).toBe('spellbook');
    expect(t.entityId).toBe('off-fire-01');
    expect(t.ref.name).toBe('Fireball');
    expect(t.instruction).toBe('make it burn over time');
    expect(t.appOrigin).toBe('http://localhost:3000');
  });

  it('buildTaskPrompt names the ability and folds in designer intent', () => {
    const t = TaskFactory.draftAbilitySpec(
      'arpg-gas',
      { catalogId: 'spellbook', entityId: 'off-fire-01', ref, instruction: 'make it burn over time' },
      'http://localhost:3000',
      'Draft',
    );
    const prompt = buildTaskPrompt(t, ctx);
    expect(prompt).toContain('Fireball');
    expect(prompt).toContain('make it burn over time');
    expect(prompt).toMatch(/GameplayEffect/i);
  });

  it('buildTaskPrompt embeds a @@CALLBACK to /api/ability-spec with effects/tagRules', () => {
    const t = TaskFactory.draftAbilitySpec(
      'arpg-gas',
      { catalogId: 'spellbook', entityId: 'off-fire-01', ref },
      'http://localhost:3000',
      'Draft',
    );
    const prompt = buildTaskPrompt(t, ctx);
    expect(prompt).toMatch(/@@CALLBACK:cb-/);
    expect(prompt).toContain('/api/ability-spec');
    expect(prompt).toContain('"effects"');
    expect(prompt).toContain('"tagRules"');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/__tests__/lib/cli-task-draft-ability-spec.test.ts`
Expected: FAIL — `TaskFactory.draftAbilitySpec is not a function`.

- [ ] **Step 3: Add the draft prompt builder**

Append to `src/lib/ability/logic-prompts.ts` (after `buildLogicChangePrompt`):

```ts
/**
 * CLI prompt to DRAFT a starter EnrichedAbilitySpec (GameplayEffects + activation
 * tag rules) for a spellbook ability. App-side data authoring only — the callback
 * POSTs the proposed effects[]/tagRules[] to /api/ability-spec; no UE files are
 * touched. Pure; SpellbookLogicWorkspace dispatches it via "Draft with AI".
 */
export function buildAbilitySpecDraftPrompt(ability: AbilityRef, instruction: string): string {
  const trimmed = instruction.trim();
  const element = ability.element || 'physical';
  return [
    `Draft a GAS authoring spec for the spellbook ability "${ability.name}" (gameplay tag ${ability.tag || 'Ability'}, ${ability.category}/${ability.element}/${ability.tier}).`,
    `Propose the GameplayEffects it applies and the activation tag rules that gate it, reusing standard GAS conventions for a ${element} ability — do NOT invent new systems.`,
    trimmed ? `Designer intent: "${trimmed}"` : 'No extra intent — propose a sensible, on-theme starter set.',
    'Each effect: id, name (GE_-style), duration ("instant"|"duration"|"infinite"), durationSec, cooldownSec, color (hex), modifiers (each {attribute, operation:"add"|"multiply", magnitude}), grantedTags (string[]).',
    'Each tag rule: id, sourceTag, targetTag, type ("blocks"|"cancels"|"requires"). Include the standard "blocked while State.Dead / State.Stunned" activation rules.',
    'This edits ONLY the app-side ability spec — do not modify any UE C++ or assets.',
  ].join('\n');
}
```

- [ ] **Step 4: Add the import to `cli-task.ts`**

In `src/lib/cli-task.ts`, after the existing `import { trackLabel, trackHint, type PipelineTrackId } from '@/lib/pipeline/tracks';` line (around line 24), add:

```ts
import { buildAbilitySpecDraftPrompt, type AbilityRef } from '@/lib/ability/logic-prompts';
```

- [ ] **Step 5: Add the task type to the union**

In `src/lib/cli-task.ts`, in the `CLITaskType` union (ends with `| 'evaluate-track';`), add a member:

```ts
  | 'evaluate-track'
  | 'draft-ability-spec';
```

- [ ] **Step 6: Add the `DraftAbilitySpecTask` interface**

In `src/lib/cli-task.ts`, after the `EvaluateTrackTask` interface (around line 279), add:

```ts
/**
 * Draft-ability-spec task (ECW Option B2) — asks Claude to propose a starter
 * EnrichedAbilitySpec (GameplayEffects + tag rules) for a catalog ability, then
 * writes effects[]/tagRules[] back to /api/ability-spec via @@CALLBACK so the
 * rich editors populate. App-side only; no UE files touched.
 */
export interface DraftAbilitySpecTask extends CLITask {
  type: 'draft-ability-spec';
  catalogId: string;
  entityId: string;
  ref: AbilityRef;
  instruction: string;
  appOrigin: string;
}
```

- [ ] **Step 7: Add the `buildTaskPrompt` case**

In `src/lib/cli-task.ts`, in the `switch (task.type)` block, after the `case 'evaluate-track': { … }` block (around line 829, before `default:`), add:

```ts
    case 'draft-ability-spec': {
      const dt = task as DraftAbilitySpecTask;
      const base = buildAbilitySpecDraftPrompt(dt.ref, dt.instruction);
      const cbId = registerCallback({
        url: `${dt.appOrigin}/api/ability-spec`,
        method: 'POST',
        staticFields: { catalogId: dt.catalogId, entityId: dt.entityId },
        schemaHint:
          '  "effects": [\n' +
          '    { "id": "<id>", "name": "GE_<Name>", "duration": "instant|duration|infinite", "durationSec": 0, "cooldownSec": 0, "color": "#rrggbb", "modifiers": [{ "attribute": "Health", "operation": "add|multiply", "magnitude": 0 }], "grantedTags": [] }\n' +
          '  ],\n' +
          '  "tagRules": [\n' +
          '    { "id": "<id>", "sourceTag": "<tag>", "targetTag": "State.Dead", "type": "blocks|cancels|requires" }\n' +
          '  ]',
      });
      return `${base}\n\n${buildCallbackSection(getCallback(cbId)!)}`;
    }
```

- [ ] **Step 8: Add the `TaskFactory.draftAbilitySpec` method**

In `src/lib/cli-task.ts`, in the `TaskFactory` object, after the `evaluateTrack(…) { … },` method (around line 1049, before the closing `};`), add:

```ts
  /** Create a draft-ability-spec task (ECW B2) — proposes a starter GAS spec and
   *  writes effects[]/tagRules[] back to /api/ability-spec via callback. */
  draftAbilitySpec(
    moduleId: SubModuleId,
    params: { catalogId: string; entityId: string; ref: AbilityRef; instruction?: string },
    appOrigin: string,
    label: string,
  ): DraftAbilitySpecTask {
    return {
      type: 'draft-ability-spec',
      moduleId,
      prompt: '',
      label,
      catalogId: params.catalogId,
      entityId: params.entityId,
      ref: params.ref,
      instruction: params.instruction ?? '',
      appOrigin,
    };
  },
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `npx vitest run src/__tests__/lib/cli-task-draft-ability-spec.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 10: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -v AssetInspector | grep -iE "error TS" | head`
Expected: no output (clean).

- [ ] **Step 11: Commit**

```bash
git add src/lib/ability/logic-prompts.ts src/lib/cli-task.ts src/__tests__/lib/cli-task-draft-ability-spec.test.ts
git commit -m "$(cat <<'EOF'
feat(ability): draft-ability-spec CLI task — AI-propose a GAS spec (B2.1)

New callback-bearing task (mirrors evaluate-track): proposes EnrichedAbilitySpec
effects[]/tagRules[] for a catalog ability and POSTs them to /api/ability-spec.
buildAbilitySpecDraftPrompt lives with the other logic prompts.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Wire the editors into `SpellbookLogicWorkspace`

**Files:**
- Modify: `src/lib/constants.ts` (add one `UI_TIMEOUTS` key)
- Modify: `src/components/ecw/pipeline/workspaces/SpellbookLogicWorkspace.tsx` (replace file)
- Test: `src/__tests__/components/ecw/pipeline/SpellbookLogicWorkspace.test.tsx` (replace file)

- [ ] **Step 1: Add the debounce constant**

In `src/lib/constants.ts`, inside the `UI_TIMEOUTS` object (after `dbSettle: 300,` around line 87), add:

```ts
  /** Debounce before persisting an edited ability spec to /api/ability-spec. */
  specSaveDebounce: 600,
```

- [ ] **Step 2: Write the failing test (replace the test file)**

Replace the entire contents of `src/__tests__/components/ecw/pipeline/SpellbookLogicWorkspace.test.tsx` with:

```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SpellbookLogicWorkspace } from '@/components/ecw/pipeline/workspaces/SpellbookLogicWorkspace';
import { usePipelineStore } from '@/stores/pipelineStore';
import { useAbilitySpecStore } from '@/stores/abilitySpecStore';
import { UI_TIMEOUTS } from '@/lib/constants';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

const { execute } = vi.hoisted(() => ({ execute: vi.fn((_t: unknown) => Promise.resolve()) }));
vi.mock('@/hooks/useModuleCLI', () => ({ useModuleCLI: () => ({ execute, sendPrompt: vi.fn(), isRunning: false }) }));
vi.mock('@/hooks/useEntityTrackHelp', () => ({ useEntityTrackHelp: () => ({ evaluate: vi.fn(), isRunning: false }) }));
// GET /api/ability-spec returns no persisted row → the workspace seeds deriveDefaultSpec.
vi.stubGlobal('fetch', vi.fn((..._a: unknown[]) => Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: null }) })));

const fireball: StoredCatalogEntity = {
  id: 'off-fire-01', catalogId: 'spellbook', name: 'Fireball', categoryPath: ['Offensive', 'Fire'], tags: [], lifecycle: 'planned',
  data: { id: 'off-fire-01', name: 'Fireball', category: 'Offensive', element: 'Fire', tier: 'advanced', damage: 40, manaCost: 20, cooldown: 6, color: '#f87171', tag: 'Ability.Fire.Fireball' },
};

describe('SpellbookLogicWorkspace', () => {
  beforeEach(() => {
    usePipelineStore.setState({ tracksByEntity: {} });
    useAbilitySpecStore.setState({ specByEntity: {} });
    execute.mockClear();
    vi.mocked(fetch).mockClear();
  });
  afterEach(cleanup);

  it('shows the scalar cards and mounts the two rich editors populated from the spec', () => {
    render(<SpellbookLogicWorkspace entity={fireball} trackId="logic" />);
    // Unchanged scalar cards (unique strings)
    expect(screen.getByText('Offensive')).toBeTruthy();
    expect(screen.getByText('advanced')).toBeTruthy();
    // The two GAS cards now carry the rich editors
    expect(screen.getByRole('heading', { name: 'Effect Mapping' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Requirements' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /add effect/i })).toBeTruthy(); // EffectTimelineEditor
    expect(screen.getByRole('button', { name: /add rule/i })).toBeTruthy();    // TagRulesEditor
    // deriveDefaultSpec seeds two activation rules vs Dead/Stunned
    expect(screen.getAllByText('State.Dead').length).toBeGreaterThan(0);
  });

  it('dispatches an aspect-scoped CLI change when a scalar card button is clicked', () => {
    render(<SpellbookLogicWorkspace entity={fireball} trackId="logic" />);
    fireEvent.click(screen.getByRole('button', { name: /tune damage/i }));
    expect(execute).toHaveBeenCalledTimes(1);
    const task = execute.mock.calls[0][0] as { type: string; prompt: string };
    expect(task.type).toBe('quick-action');
    expect(task.prompt).toContain('Fireball');
    expect(task.prompt).toMatch(/damage/i);
  });

  it('dispatches a draft-ability-spec task from "Draft with AI"', () => {
    render(<SpellbookLogicWorkspace entity={fireball} trackId="logic" />);
    fireEvent.click(screen.getByRole('button', { name: /draft with ai/i }));
    expect(execute).toHaveBeenCalledTimes(1);
    expect((execute.mock.calls[0][0] as { type: string }).type).toBe('draft-ability-spec');
  });

  it('persists an edit via debounced POST /api/ability-spec', async () => {
    vi.useFakeTimers();
    try {
      render(<SpellbookLogicWorkspace entity={fireball} trackId="logic" />);
      fireEvent.click(screen.getByRole('button', { name: /add effect/i }));
      // optimistic store update is synchronous: 1 seeded effect + 1 added = 2
      expect(useAbilitySpecStore.getState().getSpec('spellbook', 'off-fire-01')?.effects.length).toBe(2);
      await vi.advanceTimersByTimeAsync(UI_TIMEOUTS.specSaveDebounce + 50);
      const postCall = vi.mocked(fetch).mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === 'POST');
      expect(postCall).toBeTruthy();
      expect(String(postCall![0])).toContain('/api/ability-spec');
    } finally {
      vi.useRealTimers();
    }
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/__tests__/components/ecw/pipeline/SpellbookLogicWorkspace.test.tsx`
Expected: FAIL — the current workspace has no "Add Effect"/"Add Rule"/"Draft with AI" buttons and does not write to `abilitySpecStore`.

- [ ] **Step 4: Replace the workspace component**

Replace the entire contents of `src/components/ecw/pipeline/workspaces/SpellbookLogicWorkspace.tsx` with:

```tsx
'use client';

import { useState, useEffect, useMemo, useRef, useCallback, type ReactNode } from 'react';
import { Tag, Swords, Timer, Droplet, Sparkles, ShieldAlert } from 'lucide-react';
import { PipelineTrackDetail } from '@/components/ecw/pipeline/PipelineTrackDetail';
import { EffectTimelineEditor } from '@/components/modules/core-engine/sub_ability/blueprint/EffectTimelineEditor';
import { TagRulesEditor } from '@/components/modules/core-engine/sub_ability/blueprint/TagRulesEditor';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { TaskFactory } from '@/lib/cli-task';
import { MODULE_COLORS } from '@/lib/chart-colors';
import { apiFetch } from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import { UI_TIMEOUTS, getAppOrigin } from '@/lib/constants';
import { calculateDamage, formulaPreview } from '@/lib/ability/damage-formula';
import { buildLogicChangePrompt, type LogicAspect, type AbilityRef } from '@/lib/ability/logic-prompts';
import { deriveDefaultSpec, type EnrichedAbilitySpec, type EditorEffect, type TagRule } from '@/lib/ability/spec';
import { useAbilitySpecStore, useEntityAbilitySpec } from '@/stores/abilitySpecStore';
import type { TrackWorkspaceProps } from '@/components/ecw/inspector/trackWorkspaceRegistry';

interface AbilityData {
  name?: string; category?: string; element?: string; tier?: string;
  damage?: number; manaCost?: number; cooldown?: number; color?: string; tag?: string;
}

function Badge({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <span className="text-2xs px-2 py-0.5 rounded-full bg-surface text-text-muted" style={color ? { color } : undefined}>
      {children}
    </span>
  );
}

function StatBar({ value, max }: { value: number; max: number }) {
  return (
    <div className="h-1.5 rounded-full bg-surface overflow-hidden w-full">
      <div className="h-full bg-emerald-500/70" style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
    </div>
  );
}

function Card({ icon, title, children, onChange, action, busy }: {
  icon: ReactNode; title: string; children: ReactNode; onChange?: () => void; action?: string; busy?: boolean;
}) {
  return (
    <section className="rounded-lg border border-border/40 bg-surface-deep p-3 space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <h4 className="text-sm font-semibold text-text">{title}</h4>
        {onChange && action && (
          <button
            onClick={onChange}
            disabled={busy}
            className="focus-ring ml-auto px-2 py-1 rounded text-2xs border border-border/50 text-text hover:bg-surface/40 disabled:opacity-50"
          >
            {busy ? 'Dispatching…' : action}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

/**
 * Spellbook Logic editor (ECW sub-project C + B2). The four scalar cards
 * (Type/Damage/Cooldown/Cost) display the catalog state with per-aspect
 * CLI-to-change (the source is seeded read-only, so changes go through Claude).
 * The Effect Mapping + Requirements cards bind the rich legacy editors to a
 * persisted EnrichedAbilitySpec (B1): edits write back to /api/ability-spec
 * (debounced), and "Draft with AI" asks Claude to propose a starter spec.
 */
export function SpellbookLogicWorkspace({ entity }: TrackWorkspaceProps) {
  const a = (entity.data ?? {}) as AbilityData;
  const [instruction, setInstruction] = useState('');

  // ── Enriched spec (B1 store; DB is source of truth) ─────────────────────────
  const loadSpec = useAbilitySpecStore((s) => s.loadSpec);
  const setSpec = useAbilitySpecStore((s) => s.setSpec);
  const slot = useEntityAbilitySpec(entity.catalogId, entity.id);
  const fallback = useMemo(
    () => deriveDefaultSpec(entity.catalogId, {
      id: entity.id, element: a.element, color: a.color, damage: a.damage, cooldown: a.cooldown, tag: a.tag,
    }),
    [entity.catalogId, entity.id, a.element, a.color, a.damage, a.cooldown, a.tag],
  );
  const spec = slot ?? fallback;

  const cli = useModuleCLI({
    moduleId: 'arpg-gas',
    sessionKey: `gen-${entity.id}`,
    label: `Logic · ${entity.name}`,
    accentColor: MODULE_COLORS.core,
    // After a "Draft with AI" run persists via callback, pull the drafted spec in.
    onComplete: () => {
      apiFetch<EnrichedAbilitySpec | null>(`/api/ability-spec?catalogId=${entity.catalogId}&entityId=${entity.id}`)
        .then((row) => { if (row) loadSpec(entity.catalogId, entity.id, row); })
        .catch(() => {});
    },
  });

  // Load the persisted spec on entity open. Falls back to the derived default,
  // but never clobbers an edit already made before the GET resolves.
  useEffect(() => {
    let cancelled = false;
    apiFetch<EnrichedAbilitySpec | null>(`/api/ability-spec?catalogId=${entity.catalogId}&entityId=${entity.id}`)
      .then((row) => {
        if (cancelled) return;
        const cur = useAbilitySpecStore.getState().getSpec(entity.catalogId, entity.id);
        if (cur == null) loadSpec(entity.catalogId, entity.id, row ?? fallback);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [entity.catalogId, entity.id, fallback, loadSpec]);

  // Optimistic + debounced write-back of an edited spec.
  const saveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persist = useCallback((next: EnrichedAbilitySpec) => {
    setSpec(entity.catalogId, entity.id, next);
    if (saveRef.current) clearTimeout(saveRef.current);
    saveRef.current = setTimeout(() => {
      saveRef.current = null;
      void apiFetch('/api/ability-spec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ catalogId: next.catalogId, entityId: next.entityId, effects: next.effects, tagRules: next.tagRules }),
      }).catch((e) => logger.error('ability-spec save failed', e));
    }, UI_TIMEOUTS.specSaveDebounce);
  }, [entity.catalogId, entity.id, setSpec]);
  useEffect(() => () => { if (saveRef.current) clearTimeout(saveRef.current); }, []);

  const onEffectsChange = useCallback((effects: EditorEffect[]) => persist({ ...spec, effects }), [persist, spec]);
  const onRulesChange = useCallback((tagRules: TagRule[]) => persist({ ...spec, tagRules }), [persist, spec]);

  const ref: AbilityRef = {
    name: entity.name, element: a.element ?? '', tag: a.tag ?? '', category: a.category ?? '', tier: a.tier ?? '',
  };
  const change = (aspect: LogicAspect) =>
    void cli.execute(TaskFactory.quickAction('arpg-gas', buildLogicChangePrompt(aspect, ref, instruction), `Logic · ${entity.name}`));
  const draftSpec = () =>
    void cli.execute(TaskFactory.draftAbilitySpec('arpg-gas', { catalogId: entity.catalogId, entityId: entity.id, ref, instruction }, getAppOrigin(), `Draft · ${entity.name}`));

  const damage = a.damage ?? 0;
  const manaCost = a.manaCost ?? 0;
  const cooldown = a.cooldown ?? 0;

  return (
    <div>
      <PipelineTrackDetail entity={entity} trackId="logic" />

      <div className="px-4 py-3 space-y-3">
        <Card icon={<Tag className="w-4 h-4 text-text-muted" />} title="Type" action="Reclassify" busy={cli.isRunning} onChange={() => change('type')}>
          <div className="flex flex-wrap items-center gap-1.5">
            {a.category && <Badge>{a.category}</Badge>}
            {a.element && <Badge color={a.color}>{a.element}</Badge>}
            {a.tier && <Badge>{a.tier}</Badge>}
          </div>
          {a.tag && <div className="text-2xs font-mono text-text-muted">{a.tag}</div>}
        </Card>

        <Card icon={<Swords className="w-4 h-4 text-text-muted" />} title="Damage" action="Tune damage" busy={cli.isRunning} onChange={() => change('damage')}>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-text font-semibold">{damage}</span>
            <StatBar value={damage} max={100} />
          </div>
          <div className="text-2xs text-text-muted">{formulaPreview({ damage })} · e.g. vs 50 armor ≈ {Math.round(calculateDamage(damage, 100, 50, 15, 1.5))}</div>
        </Card>

        <Card icon={<Timer className="w-4 h-4 text-text-muted" />} title="Cooldown" action="Change cooldown" busy={cli.isRunning} onChange={() => change('cooldown')}>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-text font-semibold">{cooldown}s</span>
            <StatBar value={cooldown} max={30} />
          </div>
        </Card>

        <Card icon={<Droplet className="w-4 h-4 text-text-muted" />} title="Cost" action="Tune cost" busy={cli.isRunning} onChange={() => change('cost')}>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-text font-semibold">{manaCost}</span>
            <StatBar value={manaCost} max={100} />
            <span className="text-text-muted text-2xs">mana</span>
          </div>
        </Card>

        <Card icon={<Sparkles className="w-4 h-4 text-text-muted" />} title="Effect Mapping" action="Draft with AI" busy={cli.isRunning} onChange={draftSpec}>
          <EffectTimelineEditor effects={spec.effects} onChange={onEffectsChange} />
        </Card>

        <Card icon={<ShieldAlert className="w-4 h-4 text-text-muted" />} title="Requirements">
          <TagRulesEditor rules={spec.tagRules} onChange={onRulesChange} effects={spec.effects} loadout={[]} />
        </Card>

        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="optional: describe the change for any aspect above (or the AI draft) before clicking it"
          rows={2}
          className="w-full bg-surface-deep border border-border/50 rounded p-2 text-xs text-text placeholder:text-text-muted/60 outline-none focus-ring resize-none"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/__tests__/components/ecw/pipeline/SpellbookLogicWorkspace.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -v AssetInspector | grep -iE "error TS" | head`
Expected: no output (clean).

- [ ] **Step 7: Lint the touched files**

Run: `npx eslint src/components/ecw/pipeline/workspaces/SpellbookLogicWorkspace.tsx src/lib/constants.ts`
Expected: no errors (warnings on `any` tolerated per repo config).

- [ ] **Step 8: Commit**

```bash
git add src/lib/constants.ts src/components/ecw/pipeline/workspaces/SpellbookLogicWorkspace.tsx src/__tests__/components/ecw/pipeline/SpellbookLogicWorkspace.test.tsx
git commit -m "$(cat <<'EOF'
feat(ecw): wire EffectTimeline + TagRules editors into Spellbook Logic (B2.2)

The Effect Mapping / Requirements cards now bind the legacy rich editors to the
persisted EnrichedAbilitySpec (load-on-open with deriveDefaultSpec fallback,
optimistic + debounced write-back to /api/ability-spec). "Draft with AI" asks
Claude to propose a starter spec; onComplete refetches it. The four scalar cards
keep their CLI-to-change buttons.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Final Verification

- [ ] **Run the full ability + workspace suite**

Run: `npx vitest run src/__tests__/lib/ability src/__tests__/lib/cli-task-draft-ability-spec.test.ts src/__tests__/stores/abilitySpecStore.test.ts src/__tests__/components/ecw/pipeline/SpellbookLogicWorkspace.test.tsx`
Expected: all green.

- [ ] **Typecheck the whole project (excluding the pre-existing AssetInspector errors)**

Run: `npx tsc --noEmit 2>&1 | grep -iE "error TS" | grep -v AssetInspector | wc -l`
Expected: `0`.

---

## Self-Review Notes (resolved during planning)

- **Spec coverage:** spec load-on-open with `deriveDefaultSpec` fallback (Task 2 Step 4 `useEffect`); debounced write-back (Task 2 `persist`); both editors on the two cards; "Draft with AI" callback task (Task 1) + `onComplete` refetch (Task 2); the four scalar cards untouched. All spec sections map to a task.
- **Known limitation** (seed reflects scalars at seed time, no auto-resync) is intentionally not addressed — deferred to B3, per the spec.
- **Type consistency:** `EditorEffect`/`TagRule` are imported from `@/lib/ability/spec` (which re-exports them from `@/lib/gas-codegen`); `EffectTimelineEditor` expects `{ effects, onChange }` and `TagRulesEditor` expects `{ rules, onChange, effects, loadout }` (verified against the components); `loadout={[]}` is assignable to `GASLoadoutSlot[]`.
- **Test collisions handled:** the rich editors render `'Ability.Fire.Fireball'` (rule source tags) and timeline axis labels like `'6s'`, which would make the old `getByText('Ability.Fire.Fireball')` / `getByText(/6s/)` assertions match multiple nodes. The replaced test asserts unique scalars (`'Offensive'`, `'advanced'`), the two card headings, the editors' own `Add Effect` / `Add Rule` buttons, and `getAllByText('State.Dead')` instead.
- **No-clobber guard:** the load `useEffect` only seeds when the store slot is still `null` at GET-resolution, so a fast edit (or a fake-timer test) is not overwritten.
```
