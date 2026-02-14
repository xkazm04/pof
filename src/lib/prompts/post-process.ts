import { buildProjectContextHeader, getModuleName, type ProjectContext } from '@/lib/prompt-context';
import type { PostProcessStackConfig, PPEffect, PPStackEntry } from '@/components/modules/content/materials/PostProcessStackBuilder';

function formatEffectSection(effect: PPEffect, entry: PPStackEntry): string {
  const paramLines = effect.params
    .map((p) => `  - ${p.name} (${p.type}) = ${p.defaultValue}${p.range ? `  [range: ${p.range}]` : ''} — ${p.description}`)
    .join('\n');

  return `### ${entry.priority + 1}. ${effect.name} ${entry.enabled ? '(ENABLED)' : '(DISABLED — skip)'}
- UE class: ${effect.ueClass}
- Description: ${effect.description}
- Parameters:
${paramLines}`;
}

export function buildPostProcessPrompt(config: PostProcessStackConfig, ctx: ProjectContext): string {
  const moduleName = getModuleName(ctx.projectName);
  const header = buildProjectContextHeader(ctx, {
    extraRules: [
      'Generate all code files directly — do NOT ask for confirmation.',
      'Use UE5 Post Process Volume best practices.',
      'Expose all parameters as UPROPERTY(EditAnywhere, BlueprintReadWrite) for designer tuning.',
    ],
  });

  const sorted = [...config.stack].sort((a, b) => a.priority - b.priority);
  const enabled = sorted.filter((s) => s.enabled);
  const effectMap = new Map(config.effects.map((e) => [e.id, e]));

  const effectSections = sorted.map((entry) => {
    const effect = effectMap.get(entry.effectId);
    if (!effect) return '';
    return formatEffectSection(effect, entry);
  }).filter(Boolean).join('\n\n');

  const enabledNames = enabled
    .map((e) => effectMap.get(e.effectId)?.name)
    .filter(Boolean)
    .join(', ');

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
- Use FPostProcessSettings struct members directly — do not create custom post-process materials unless needed (stencil effect is the exception)
- For Custom Stencil: create a simple post-process material that reads SceneTexture:CustomDepth and CustomStencil
- Expose Blend Weight and Priority on the volume for designers
- Group UPROPERTYs by category: "PostProcess|Bloom", "PostProcess|ColorGrading", etc.
- Use PostEditChangeProperty to live-preview changes in editor
- Consider mobile: some effects (SSAO, motion blur) are expensive on mobile — add bMobileOptimized flag`;
}
