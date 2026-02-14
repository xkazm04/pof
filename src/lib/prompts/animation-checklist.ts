import { buildProjectContextHeader, getModuleName, type ProjectContext } from '@/lib/prompt-context';
import type { ChecklistStep } from '@/components/modules/content/animations/AnimationChecklist';

export function buildAnimationChecklistPrompt(step: ChecklistStep, ctx: ProjectContext): string {
  const moduleName = getModuleName(ctx.projectName);
  const header = buildProjectContextHeader(ctx, {
    extraRules: [
      'Generate all code files directly — do NOT ask for confirmation.',
      'Use UE5 C++ best practices for animation systems.',
      'All animation-related UPROPERTYs should be EditAnywhere, BlueprintReadWrite.',
      'Place animation classes under Source/' + moduleName + '/Animation/.',
      'Include .h and .cpp files for every class.',
    ],
  });

  return `${header}

## Task: Step ${step.number} — ${step.title}

### Overview
${step.description}

### Detailed Requirements
${step.details.map((d, i) => `${i + 1}. ${d}`).join('\n')}

### Implementation
${step.prompt}

### UE5 Animation Best Practices
- Use NativeUpdateAnimation() instead of BlueprintUpdateAnimation() for C++ AnimInstances
- Cache component references in NativeInitializeAnimation() to avoid per-frame lookups
- Montage callbacks: use FOnMontageEnded / FOnMontageBlendingOut delegates
- Anim Notify States must handle interrupted montages gracefully (NotifyEnd always called)
- Use FGameplayTag for state communication between anim notifies and gameplay code
- TSoftObjectPtr for all animation asset references to support async loading
- Root motion: enable per-montage, disable for locomotion blend spaces`;
}
