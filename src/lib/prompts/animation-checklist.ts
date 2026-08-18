/**
 * The animation Setup Guide's prompt builder — and the SHIPPING prompt body for
 * every step the guide dispatches.
 *
 * This builder used to have zero non-test consumers: the Setup Guide dispatched
 * `TaskFactory.checklist('animations', step.id, step.prompt, …)`, so only the
 * step's bare `prompt` string reached Claude and the authored Mixamo-retarget +
 * commandlet-automation guidance below never shipped. The `checklist` handler
 * (`cli-task-handlers.ts`) now looks the step up by `itemId` through
 * {@link findAnimationChecklistStep} and composes the task body HERE, then
 * appends the wiring + `@@CALLBACK` sections — so editing this file changes what
 * actually gets dispatched.
 */

import { getModuleName, getModuleDomainContext, type ProjectContext } from '@/lib/prompt-context';
import { getEngineFacts } from '@/lib/engine-facts';
import { PromptBuilder } from '@/lib/prompts/prompt-builder';
import { GENERATE_ALL_DIRECTLY, MIXAMO_DOWNLOAD_CONTRACT } from '@/lib/prompts/_shared';
import type { ChecklistStep } from '@/components/modules/content/animations/AnimationChecklist/types';
import { ANIMATION_STEPS } from '@/components/modules/content/animations/AnimationChecklist/constants';
import { moduleKnowledge } from '@/lib/prompts/module-knowledge';

/**
 * Resolve a Setup Guide step from the `itemId` a `ChecklistTask` carries.
 *
 * Returns `undefined` for anything that is NOT a Setup Guide step — notably the
 * `animations` roadmap items in `module-registry`, which own their own prompts
 * and keep the generic checklist body.
 *
 * Imports the step table directly from `…/AnimationChecklist/constants` (not the
 * component barrel) so nothing in the prompt path pulls in the React tree.
 */
export function findAnimationChecklistStep(itemId: string): ChecklistStep | undefined {
  return ANIMATION_STEPS.find((s) => s.id === itemId);
}

export function buildAnimationChecklistPrompt(step: ChecklistStep, ctx: ProjectContext): string {
  const moduleName = getModuleName(ctx.projectName);
  const facts = getEngineFacts(ctx.ueVersion);
  // Preserved from the generic checklist body this builder replaces — routing the
  // dispatch through the builder must not COST the prompt its module role line.
  const domainContext = getModuleDomainContext('animations', ctx.ueVersion);

  const builder = new PromptBuilder()
    .withProjectContext(ctx, {
      ...moduleKnowledge('animations'),
      extraRules: [
        GENERATE_ALL_DIRECTLY,
        'Use UE5 C++ best practices for animation systems.',
        'All animation-related UPROPERTYs should be EditAnywhere, BlueprintReadWrite.',
        'Place animation classes under Source/' + moduleName + '/Animation/.',
        'Place editor-only classes (commandlets) under Source/' + moduleName + 'Editor/.',
        'Include .h and .cpp files for every class.',
      ],
    })
    .withRawTask(
      `## Task: Step ${step.number} — ${step.title}\n\n` +
      `### Overview\n${step.description}\n\n` +
      `### Detailed Requirements\n${step.details.map((d, i) => `${i + 1}. ${d}`).join('\n')}\n\n` +
      `### Implementation\n${step.prompt}`,
    )
    .withRawBestPractices(
      `### UE5 Animation Best Practices\n` +
      `- Use NativeUpdateAnimation() instead of BlueprintUpdateAnimation() for C++ AnimInstances\n` +
      `- Cache component references in NativeInitializeAnimation() to avoid per-frame lookups\n` +
      `- Montage callbacks: use FOnMontageEnded / FOnMontageBlendingOut delegates\n` +
      `- Anim Notify States must handle interrupted montages gracefully (NotifyEnd always called)\n` +
      `- Use FGameplayTag for state communication between anim notifies and gameplay code\n` +
      `- TSoftObjectPtr for all animation asset references to support async loading\n` +
      `- Root motion: enable per-montage, disable for locomotion blend spaces\n\n` +
      `### Mixamo Import & Retargeting Best Practices\n` +
      // The download contract is single-sourced with the `mixamo-import` task
      // handler (`_shared.ts`) — the two used to state it in different words.
      `${MIXAMO_DOWNLOAD_CONTRACT}\n` +
      `- After import, verify the strip took: bone names must show "Hips", not "mixamorig:Hips"\n` +
      `- For attacks/dodges that need root motion: use RootMotionGeneratorOp post-process to extract from hip translation\n` +
      `- IK Retargeter Python API (UE5.7+): use IKRetargeterController for scriptable batch retargeting\n` +
      `  - auto_map_chains(AutoMapChainType.FUZZY) handles Mixamo→UE5 bone chain mapping automatically\n` +
      `  - IKRetargetBatchOperation.duplicate_and_retarget() processes hundreds of animations in one call\n` +
      `- Align retarget pose for T-pose (Mixamo) vs A-pose (UE5 Mannequin) differences\n` +
      `- UE5.7+: enable spatially aware retargeting, crotch height constraints, and stretch chain operators for better results\n\n` +
      // Provenance, not a capability claim: these were verified on 5.7. State the
      // project's actual engine alongside it rather than implying re-verification.
      `### Commandlet Automation Notes (verified on UE 5.7; this project builds on UE ${facts.version})\n` +
      `- **Automatable via commandlet**: BlendSpace1D, AnimMontage shells (with sections + linking) — runs headless in ~0.06s\n` +
      `- **NOT automatable**: AnimBP state machine graph, Anim Notify placement on montage timeline — requires editor\n` +
      `- **BlendSpace gotcha**: GetBlendParameter() returns const. Use FProperty reflection on "BlendParameters" UPROPERTY instead\n` +
      `- **SavePackage gotcha**: UPackage::SavePackage() returns bool in UE 5.7. UPackage::Save() returns FSavePackageResultStruct — different methods\n` +
      `- **Editor module pattern**: Separate PoFEditor module (Type: Editor in .uproject), depends on UnrealEd + AssetTools\n` +
      `- **Commandlet run**: UnrealEditor-Cmd.exe Project.uproject -run=CommandletName -nopause -unattended -nosplash`,
    );

  if (domainContext) builder.withDomainContext(domainContext);

  return builder.build();
}
