import { buildProjectContextHeader, getModuleName, type ProjectContext } from '@/lib/prompt-context';
import { GENERATE_ALL_DIRECTLY } from '@/lib/prompts/_shared';
import { moduleKnowledge } from '@/lib/prompts/module-knowledge';
import type { PostProcessStackSpec, PPSpecEffect, PPSpecParam } from '@/lib/post-process-studio/stack-spec';

/**
 * The ONE post-process prompt builder. Both surfaces (Recipe Studio, Materials
 * Stack Builder) project the shared store through `toStackSpec` and dispatch
 * `TaskFactory.postProcess(spec)`; the `post-process` task handler returns this
 * string verbatim. The spec carries the resolution-aware cost of every effect and
 * the frame budget, so the budget the user tuned against shapes the output.
 */

function formatParamLine(p: PPSpecParam): string {
  return `  - ${p.ueProperty} (${p.type}) = ${p.value}  [range: ${p.min} – ${p.max}] — ${p.description}`;
}

function formatEffectSection(effect: PPSpecEffect, index: number, spec: PostProcessStackSpec): string {
  const paramLines = effect.params.map(formatParamLine).join('\n');

  return `### ${index + 1}. ${effect.name}
- UE class: ${effect.ueClass}
- Description: ${effect.description}
- Est. GPU cost: ${effect.estCostMs}ms @ ${spec.resolution}
- Parameters:
${paramLines}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatBudgetSection(spec: PostProcessStackSpec): string {
  const verdict = spec.overBudget
    ? `OVER by ${round2(spec.totalCostMs - spec.budgetMs)}ms`
    : `within budget (${round2(spec.budgetMs - spec.totalCostMs)}ms headroom)`;
  const costliest = [...spec.effects]
    .sort((a, b) => b.estCostMs - a.estCostMs)
    .map((e) => `${e.name} ${e.estCostMs}ms`)
    .join(', ');
  const rule = spec.overBudget
    ? '- The stack is over budget: give each effect a `bEnable<Effect>` UPROPERTY and gate the costliest effects above behind the post-process scalability quality level, so lower quality tiers drop them first.'
    : '- Keep the generated setup within this budget: do not add effects beyond the stack above.';
  return `### GPU Budget

**GPU budget @ ${spec.resolution}: ${spec.totalCostMs}ms of ${spec.budgetMs}ms — ${verdict}.**
- Costliest first: ${costliest || 'none'}
${rule}`;
}

export function buildPostProcessPrompt(spec: PostProcessStackSpec, ctx: ProjectContext): string {
  const moduleName = getModuleName(ctx.projectName);
  const header = buildProjectContextHeader(ctx, {
    ...moduleKnowledge('materials'),
    extraRules: [
      GENERATE_ALL_DIRECTLY,
      'Use UE5 Post Process Volume best practices.',
      'Expose all parameters as UPROPERTY(EditAnywhere, BlueprintReadWrite) for designer tuning.',
    ],
  });

  const effectSections = spec.effects.map((e, i) => formatEffectSection(e, i, spec)).join('\n\n');
  const enabledNames = spec.effects.map((e) => e.name).join(', ');
  const presetNote = spec.presetName
    ? `\nThis stack is based on the "${spec.presetName}" cinematic mood preset.\n`
    : '';
  const disabledNote = spec.disabled.length > 0
    ? `\n\nDisabled (do not generate): ${spec.disabled.join(', ')}`
    : '';

  return `${header}

## Task: Create Post-Process Volume Setup
${presetNote}
Generate a complete C++ post-process volume configuration with the following ${spec.effects.length} enabled effects: **${enabledNames}**.

### Effect Stack (ordered by priority)

${effectSections}${disabledNote}

${formatBudgetSection(spec)}

### Required Files (all under Source/${moduleName}/PostProcess/)

1. **A${moduleName}PostProcessVolume** (extends APostProcessVolume)
   - Header + CPP files
   - Override BeginPlay to configure all enabled effects programmatically
   - UPROPERTY for each enabled effect's parameters (grouped by effect in UPROPERTY Category)
   - \`void ApplySettings()\` — applies all UPROPERTY values to the volume's FPostProcessSettings
   - Call ApplySettings() in BeginPlay and whenever parameters change (PostEditChangeProperty in editor)

2. **U${moduleName}PostProcessComponent** (UActorComponent)
   - Attach to any actor to create a local post-process zone
   - Uses a UPostProcessComponent internally
   - UPROPERTY float BlendRadius, float BlendWeight
   - Subset of effects configurable per-instance (most common: bloom, DOF, color grading)

3. **U${moduleName}PostProcessSubsystem** (UWorldSubsystem)
   - Global manager that registers volumes and handles priority-based blending
   - \`void RegisterVolume(A${moduleName}PostProcessVolume*)\`
   - \`void SetGlobalOverride(FName EffectName, float Value)\` for gameplay-driven overrides (e.g., low-health vignette)
   - Blueprint-callable functions for common runtime adjustments

4. **Setup Instructions**
   - How to place the volume in a level
   - How to set Infinite Extent (Unbound) for global effects
   - Priority ordering explanation matching the stack above
   - Notes on performance cost per effect against the GPU budget above

### UE5 Best Practices
- Use FPostProcessSettings struct members directly — do not create custom post-process materials unless needed
- Expose Blend Weight and Priority on the volume for designers
- Group UPROPERTYs by category: "PostProcess|Bloom", "PostProcess|ColorGrading", etc.
- Use PostEditChangeProperty to live-preview changes in editor
- Consider mobile: some effects (SSAO, motion blur) are expensive on mobile — add bMobileOptimized flag`;
}
