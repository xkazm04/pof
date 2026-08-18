import { describe, it, expect } from 'vitest';
import { TaskFactory, buildTaskPrompt } from '@/lib/cli-task';
import { MIXAMO_DOWNLOAD_CONTRACT } from '@/lib/prompts/_shared';
import { findAnimationChecklistStep } from '@/lib/prompts/animation-checklist';
import { ANIMATION_STEPS } from '@/components/modules/content/animations/AnimationChecklist/constants';
import { getModuleChecklist } from '@/lib/module-registry';
import type { ProjectContext } from '@/lib/prompt-context';

/**
 * The animations Setup Guide (`AnimationsView.handleGenerateStep`) dispatches a
 * plain `TaskFactory.checklist` task, so for a long time only the step's bare
 * `prompt` string reached Claude: the authored Mixamo-retarget and
 * commandlet-automation guidance in `prompts/animation-checklist.ts` had zero
 * non-test consumers and never shipped.
 *
 * This rail pins the wiring at the level that matters — the string
 * `buildTaskPrompt` actually emits for a real dispatched task — not the builder
 * in isolation (which is what let the gap hide for two months).
 */

const CTX: ProjectContext = {
  projectName: 'PoF',
  projectPath: 'C:\\proj\\PoF',
  ueVersion: '5.8.0',
};

const ORIGIN = 'http://localhost:3000';

/** Exactly how `AnimationsView.handleGenerateStep` dispatches a guide step. */
function dispatch(stepId: string, prompt: string): string {
  return buildTaskPrompt(
    TaskFactory.checklist('animations', stepId, prompt, 'Anim Setup', ORIGIN),
    CTX,
  );
}

/** The guide steps that have a CLI prompt — the ones the Run button dispatches. */
const RUNNABLE_STEPS = ANIMATION_STEPS.filter((s) => s.prompt);

describe('animations Setup Guide dispatch routes through the authored builder', () => {
  it('has runnable steps to assert on', () => {
    expect(RUNNABLE_STEPS.length).toBeGreaterThan(0);
  });

  it.each(RUNNABLE_STEPS.map((s) => [s.id] as const))(
    'the emitted prompt for %s carries the Mixamo retarget guidance',
    (stepId) => {
      const step = ANIMATION_STEPS.find((s) => s.id === stepId)!;
      const prompt = dispatch(step.id, step.prompt!);

      // The single-sourced manual-download contract (`_shared.ts`).
      expect(prompt).toContain(MIXAMO_DOWNLOAD_CONTRACT);
      // The retarget guidance that only ever existed in the stranded builder.
      expect(prompt).toContain('### Mixamo Import & Retargeting Best Practices');
      expect(prompt).toContain('auto_map_chains(AutoMapChainType.FUZZY)');
      expect(prompt).toContain('IKRetargetBatchOperation.duplicate_and_retarget()');
      expect(prompt).toContain('bone names must show "Hips", not "mixamorig:Hips"');
    },
  );

  it.each(RUNNABLE_STEPS.map((s) => [s.id] as const))(
    'the emitted prompt for %s carries the commandlet automation notes',
    (stepId) => {
      const step = ANIMATION_STEPS.find((s) => s.id === stepId)!;
      const prompt = dispatch(step.id, step.prompt!);

      expect(prompt).toContain('### Commandlet Automation Notes');
      // Engine provenance is stamped from the project's own version, not a fixed 5.7.
      expect(prompt).toContain('this project builds on UE 5.8');
      expect(prompt).toContain('**BlendSpace gotcha**');
      expect(prompt).toContain('**SavePackage gotcha**');
      expect(prompt).toContain('-run=CommandletName -nopause -unattended -nosplash');
      // ...and the animation-specific placement rules from the builder's extraRules.
      expect(prompt).toContain('Place animation classes under Source/PoF/Animation/.');
      expect(prompt).toContain('Place editor-only classes (commandlets) under Source/PoFEditor/.');
    },
  );

  it('renders the whole step, not just its `prompt` field', () => {
    const step = ANIMATION_STEPS.find((s) => s.id === 'step-commandlet-assets')!;
    const prompt = dispatch(step.id, step.prompt!);

    expect(prompt).toContain(`## Task: Step ${step.number} — ${step.title}`);
    expect(prompt).toContain(step.description);
    for (const detail of step.details) expect(prompt).toContain(detail);
    expect(prompt).toContain(step.prompt!);
  });

  it('stays inside the CLITask abstraction — callback + wiring sections survive', () => {
    const step = ANIMATION_STEPS.find((s) => s.id === 'step-animbp')!;
    const prompt = dispatch(step.id, step.prompt!);

    expect(prompt).toContain('@@CALLBACK:');
    expect(prompt).toContain('@@END_CALLBACK');
    // The callback's static fields — proof this is still the CHECKLIST callback
    // (the URL itself is held in the registry, never printed into the prompt).
    expect(prompt).toContain('- `moduleId`: `"animations"`');
    expect(prompt).toContain('- `itemId`: `"step-animbp"`');
    expect(prompt).toContain('- `promptVariantId`: `"static"`');
    expect(prompt).toContain('## Wiring Requirements');
    // Routing through the builder must not cost the module role line.
    expect(prompt).toContain('## Domain Context');
  });

  it('every guide step id resolves — a renamed id cannot silently unwire the guidance', () => {
    for (const step of ANIMATION_STEPS) {
      expect(findAnimationChecklistStep(step.id)?.id).toBe(step.id);
    }
  });
});

describe('non-guide checklist items keep the generic body', () => {
  it('the `animations` module-registry roadmap items are untouched', () => {
    const roadmap = getModuleChecklist('animations');
    expect(roadmap.length).toBeGreaterThan(0);

    for (const item of roadmap) {
      // Registry ids (`anim-N`) must not collide with guide ids (`step-*`).
      expect(findAnimationChecklistStep(item.id)).toBeUndefined();
    }

    const prompt = dispatch(roadmap[0].id, roadmap[0].prompt);
    expect(prompt).toContain('## Task\n');
    expect(prompt).not.toContain('### Commandlet Automation Notes');
  });

  it('other modules are untouched', () => {
    const prompt = buildTaskPrompt(
      TaskFactory.checklist('arpg-combat', 'combat-hit-detect', 'Implement melee hit detection.', 'Combat', ORIGIN),
      CTX,
    );
    expect(prompt).toContain('## Task\nImplement melee hit detection.');
    expect(prompt).not.toContain('### Mixamo Import & Retargeting Best Practices');
  });
});
