import { describe, it, expect } from 'vitest';
import type { ProjectContext } from '@/lib/prompt-context';
import type { SubModuleId } from '@/types/modules';
import { formatGotchas } from '@/lib/knowledge/ue-gotchas';
import { formatKnowledgeTips } from '@/lib/knowledge/knowledge-tips';
import { formatKnownAssets, knownAssetDomainsForModule } from '@/lib/knowledge/ue-known-assets';
import { expectGolden } from './golden';

import { generateFixPlan, generateBatchFixPlan } from '@/lib/evaluator/fix-plan-generator';
import { buildDeepEvalPassPrompt } from '@/lib/evaluator/deep-eval-engine';
import { buildAreaPrompt } from '@/lib/harness/executor';
import { buildTaskPrompt, TaskFactory } from '@/lib/cli-task';
import { getFeatureInitPrompt } from '@/components/modules/core-engine/unique-tabs/feature-init-prompts';
import { buildStackApplyPrompt } from '@/components/modules/core-engine/sub_character/ai-feel/build-apply-prompt';
import { buildBalancePrompt } from '@/components/modules/core-engine/sub_inventory/_shared/balance-prompt';
import { DUMMY_ITEMS } from '@/components/modules/core-engine/sub_inventory/_shared/data';
import { FEEL_PRESETS } from '@/lib/character-feel-optimizer';
import type { EvalFinding } from '@/lib/evaluator/finding-collector';
import type { ModuleArea, GamePlan, ProgressEntry } from '@/lib/harness/types';

/**
 * The off-rail join (sibling of the standalone-builders rail).
 *
 * Two classes of gap were audited:
 *  - **Unrouted header callers** — they DID call `buildProjectContextHeader`, but with no
 *    `promptKind`/`module`, so they got the conservative pitfall SUPERSET and none of the
 *    module's authored tips or known asset paths. Fixed by routing through `moduleKnowledge`.
 *  - **Fully off-rail surfaces** — no composition at all. Some turned out to be joined at
 *    their DISPATCH site (an `ask-claude` task composes the routed header for them); the
 *    genuinely raw one (feature-init) now dispatches as a task; the rest are exempt with a
 *    recorded reason below, which this file pins so an exemption can't be silently assumed.
 */

const CTX: ProjectContext = {
  projectName: 'PoF',
  projectPath: 'C:\\proj\\PoF',
  ueVersion: '5.8.0',
};

const FINDING: EvalFinding = {
  id: 'find-1',
  scanId: 'scan-1',
  moduleId: 'materials' as SubModuleId,
  pass: 'quality',
  category: 'Shader',
  severity: 'high',
  file: 'Source/PoF/Materials/ARPGSurface.cpp',
  line: 42,
  description: 'The surface master is recompiled per instance.',
  suggestedFix: 'Cache the MID and reuse it.',
  effort: 'medium',
} as unknown as EvalFinding;

const AREA: ModuleArea = {
  id: 'area-materials',
  moduleId: 'materials' as SubModuleId,
  label: 'Surface Materials',
  description: 'The shared surface master + its instances.',
  checklistItemIds: [],
  featureNames: [],
  dependsOn: [],
  status: 'pending',
  features: [],
} as unknown as ModuleArea;

const PLAN: GamePlan = {
  game: 'PoF',
  projectPath: CTX.projectPath,
  ueVersion: CTX.ueVersion,
  areas: [AREA],
  iteration: 3,
  totalFeatures: 1,
} as unknown as GamePlan;

const PROGRESS: ProgressEntry[] = [];

/** A surface that must carry its module's routed knowledge, plus a golden pin. */
interface JoinedCase {
  name: string;
  module: SubModuleId;
  build: () => string;
}

const JOINED: JoinedCase[] = [
  {
    name: 'fix-plan-single',
    module: 'materials' as SubModuleId,
    build: () => generateFixPlan(FINDING, CTX).prompt,
  },
  {
    name: 'fix-plan-batch',
    module: 'materials' as SubModuleId,
    build: () => generateBatchFixPlan([FINDING], 'materials', CTX)!.prompt,
  },
  {
    name: 'deep-eval-pass',
    module: 'materials' as SubModuleId,
    build: () => buildDeepEvalPassPrompt(CTX, 'materials' as SubModuleId, 'quality'),
  },
  {
    name: 'harness-area',
    module: 'materials' as SubModuleId,
    build: () => buildAreaPrompt(AREA, PLAN, PROGRESS, CTX, ''),
  },
  {
    // Was dispatched with the RAW registry string (no header at all); now a task.
    name: 'feature-init-dispatch',
    module: 'arpg-character' as SubModuleId,
    build: () => {
      const init = getFeatureInitPrompt('arpg-character' as SubModuleId, 'class-hierarchy');
      expect(init).toBeDefined();
      return buildTaskPrompt(
        TaskFactory.quickAction('arpg-character' as SubModuleId, init!.prompt, 'Init: class-hierarchy'),
        CTX,
      );
    },
  },
  {
    // Already joined at its dispatch site (`ask-claude`) — pinned so a refactor that
    // sends the builder's text raw is caught.
    name: 'ai-feel-apply-dispatch',
    module: 'arpg-character' as SubModuleId,
    build: () =>
      buildTaskPrompt(
        TaskFactory.askClaude(
          'arpg-character' as SubModuleId,
          buildStackApplyPrompt(FEEL_PRESETS[0], [], FEEL_PRESETS[0].profile),
          'Apply feel',
        ),
        CTX,
      ),
  },
  {
    name: 'inventory-balance-dispatch',
    module: 'arpg-inventory' as SubModuleId,
    build: () =>
      buildTaskPrompt(
        TaskFactory.askClaude('arpg-inventory' as SubModuleId, buildBalancePrompt(DUMMY_ITEMS.slice(0, 2)), 'Balance'),
        CTX,
      ),
  },
];

describe('off-rail surfaces join the knowledge routing', () => {
  for (const c of JOINED) {
    describe(c.name, () => {
      const prompt = c.build();

      it('carries the module-scoped UE pitfalls block', () => {
        const expected = formatGotchas('ue-cpp', c.module);
        expect(expected).not.toBe('');
        expect(prompt).toContain('## Known UE Pitfalls');
        expect(prompt).toContain(expected);
      });

      it('does not haul the unscoped pitfall superset', () => {
        const superset = formatGotchas('ue-cpp');
        const scoped = formatGotchas('ue-cpp', c.module);
        if (superset === scoped) return; // module legitimately owns every domain
        expect(prompt).not.toContain(superset);
      });

      it('carries the module KnowledgeTips when the module authors any', () => {
        const tips = formatKnowledgeTips(c.module, 'ue-cpp');
        if (!tips) return;
        expect(prompt).toContain(tips);
      });

      it('carries the module known-asset paths when the module owns any', () => {
        const assets = formatKnownAssets(knownAssetDomainsForModule(c.module));
        if (!assets) return;
        expect(prompt).toContain(assets);
      });

      it('matches its golden', () => {
        expectGolden(`offrail-${c.name}`, prompt.replace(/cb-\d+-\d+/g, 'cb-TEST'));
      });
    });
  }
});

/**
 * Surfaces deliberately NOT joined. Each entry is the recorded reason — an exemption is a
 * decision, not an oversight, so it lives in the repo next to the rail that would otherwise
 * demand the join.
 */
const EXEMPT: { file: string; reason: string; build: () => string }[] = [
  {
    file: 'components/modules/project-setup/prompts.ts — buildCreateProjectPrompt',
    reason:
      'It CREATES the project the header would describe. There is no Source/ root, no build ' +
      'command and no module to scope pitfalls to at the moment it runs, so a project-context ' +
      'header would state things that are not true yet.',
    build: () => '',
  },
  {
    file: 'components/modules/project-setup/prompts.ts — buildBuildVerifyPrompt',
    reason:
      'A terse diagnostic script that carries its own explicit engine + project paths and its ' +
      'own rule set ("Be concise. Do NOT use TodoWrite"). The standard header would duplicate ' +
      'the paths and add build rules that contradict its step-by-step verification flow.',
    build: () => '',
  },
  {
    file: 'lib/ability/logic-prompts.ts — buildAbilitySpecDraftPrompt',
    reason:
      'App-side data authoring only: it POSTs proposed effects/tagRules to /api/ability-spec and ' +
      'states "do not modify any UE C++ or assets". A UE header (build command + "ALWAYS verify ' +
      'the build compiles") would contradict the task\'s own constraint.',
    build: () => '',
  },
  {
    file: 'lib/ability/logic-prompts.ts — buildLogicChangePrompt',
    reason:
      'Has NO dispatch site in the app today (only tests reference it), so there is nothing to ' +
      'join — the composition belongs to whichever task dispatches it. When one is added it must ' +
      'go through a CLITask, which routes the header for its module.',
    build: () => '',
  },
];

describe('documented exemptions', () => {
  it('records a precise reason for every surface left off the rail', () => {
    expect(EXEMPT).toHaveLength(4);
    for (const e of EXEMPT) {
      expect(e.file).toMatch(/\.ts —/);
      // A reason has to actually say something — a one-word "n/a" is not a decision.
      expect(e.reason.length).toBeGreaterThan(80);
    }
  });
});
