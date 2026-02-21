import { getModuleName, type ProjectContext } from '@/lib/prompt-context';
import { PromptBuilder } from '@/lib/prompts/prompt-builder';
import type { ChecklistStep } from '@/components/modules/content/animations/AnimationChecklist';

export function buildAnimationChecklistPrompt(step: ChecklistStep, ctx: ProjectContext): string {
  const moduleName = getModuleName(ctx.projectName);

  return new PromptBuilder()
    .withProjectContext(ctx, {
      extraRules: [
        'Generate all code files directly — do NOT ask for confirmation.',
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
      `- Strip "mixamorig:" bone prefix on FBX import — UE5 auto-strips when importing Mixamo FBX, verify bone names show "Hips" not "mixamorig:Hips"\n` +
      `- Download character mesh "With Skin" once, then all subsequent animations "Without Skin" to reuse the skeleton\n` +
      `- Check "In Place" for all locomotion anims (idle/walk/run) — root motion is driven by CharacterMovementComponent\n` +
      `- For attacks/dodges that need root motion: use RootMotionGeneratorOp post-process to extract from hip translation\n` +
      `- IK Retargeter Python API (UE5.7+): use IKRetargeterController for scriptable batch retargeting\n` +
      `  - auto_map_chains(AutoMapChainType.FUZZY) handles Mixamo→UE5 bone chain mapping automatically\n` +
      `  - IKRetargetBatchOperation.duplicate_and_retarget() processes hundreds of animations in one call\n` +
      `- Align retarget pose for T-pose (Mixamo) vs A-pose (UE5 Mannequin) differences\n` +
      `- UE5.7+: enable spatially aware retargeting, crotch height constraints, and stretch chain operators for better results\n\n` +
      `### UE 5.7 Automation Notes (Verified)\n` +
      `- **Automatable via commandlet**: BlendSpace1D, AnimMontage shells (with sections + linking) — runs headless in ~0.06s\n` +
      `- **NOT automatable**: AnimBP state machine graph, Anim Notify placement on montage timeline — requires editor\n` +
      `- **BlendSpace gotcha**: GetBlendParameter() returns const. Use FProperty reflection on "BlendParameters" UPROPERTY instead\n` +
      `- **SavePackage gotcha**: UPackage::SavePackage() returns bool in UE 5.7. UPackage::Save() returns FSavePackageResultStruct — different methods\n` +
      `- **Editor module pattern**: Separate PoFEditor module (Type: Editor in .uproject), depends on UnrealEd + AssetTools\n` +
      `- **Commandlet run**: UnrealEditor-Cmd.exe Project.uproject -run=CommandletName -nopause -unattended -nosplash`,
    )
    .build();
}
