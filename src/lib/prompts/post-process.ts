import { buildProjectContextHeader, getModuleName, type ProjectContext } from '@/lib/prompt-context';
import { GENERATE_ALL_DIRECTLY } from '@/lib/prompts/_shared';
import type { PPStudioEffect, PPStudioParam } from '@/types/post-process-studio';

/**
 * Canonical post-process stack config consumed by the prompt builder.
 * Effects are the single source of truth ({@link PPStudioEffect}) — each
 * carries its own `enabled`/`priority`/current param values, so no separate
 * stack array is needed.
 */
export interface PostProcessStackConfig {
  effects: PPStudioEffect[];
}

function formatParamLine(p: PPStudioParam): string {
  return `  - ${p.ueProperty} (${p.type}) = ${p.value}  [range: ${p.min} – ${p.max}] — ${p.description}`;
}

function formatEffectSection(effect: PPStudioEffect): string {
  const paramLines = effect.params.map(formatParamLine).join('\n');

  return `### ${effect.priority + 1}. ${effect.name} ${effect.enabled ? '(ENABLED)' : '(DISABLED — skip)'}
- UE class: ${effect.ueClass}
- Description: ${effect.description}
- Est. GPU cost: ${effect.gpuCostMs}ms @ 1080p
- Parameters:
${paramLines}`;
}

export function buildPostProcessPrompt(config: PostProcessStackConfig, ctx: ProjectContext): string {
  const moduleName = getModuleName(ctx.projectName);
  const header = buildProjectContextHeader(ctx, {
    extraRules: [
      GENERATE_ALL_DIRECTLY,
      'Use UE5 Post Process Volume best practices.',
      'Expose all parameters as UPROPERTY(EditAnywhere, BlueprintReadWrite) for designer tuning.',
    ],
  });

  const sorted = [...config.effects].sort((a, b) => a.priority - b.priority);
  const enabled = sorted.filter((e) => e.enabled);

  const effectSections = sorted.map(formatEffectSection).join('\n\n');

  const enabledNames = enabled.map((e) => e.name).join(', ');

  return `${header}

## Task: Create Post-Process Volume Setup

Generate a complete C++ post-process volume configuration with the following ${enabled.length} enabled effects: **${enabledNames}**.

### Effect Stack (ordered by priority)

${effectSections}

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
   - Notes on performance cost per effect

### UE5 Best Practices
- Use FPostProcessSettings struct members directly — do not create custom post-process materials unless needed
- Expose Blend Weight and Priority on the volume for designers
- Group UPROPERTYs by category: "PostProcess|Bloom", "PostProcess|ColorGrading", etc.
- Use PostEditChangeProperty to live-preview changes in editor
- Consider mobile: some effects (SSAO, motion blur) are expensive on mobile — add bMobileOptimized flag`;
}
