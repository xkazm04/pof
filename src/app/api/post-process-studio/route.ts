import { type NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { PRESETS } from '@/lib/post-process-studio/presets';
import { estimateGPUBudget } from '@/lib/post-process-studio/gpu-estimator';
import type { PPStudioEffect, PPResolution } from '@/types/post-process-studio';

// ── GET — presets and defaults ──────────────────────────────────────────────

export async function GET() {
  return apiSuccess({ presets: PRESETS });
}

// ── POST — actions ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action as string;

    if (action === 'estimate') {
      const effects = body.effects as PPStudioEffect[];
      const resolution = (body.resolution ?? '1080p') as PPResolution;
      if (!effects || !Array.isArray(effects)) {
        return apiError('Missing effects array', 400);
      }
      const budget = estimateGPUBudget(effects, resolution);
      return apiSuccess({ budget });
    }

    if (action === 'generate') {
      const effects = body.effects as PPStudioEffect[];
      const presetName = body.presetName as string | null;
      if (!effects || !Array.isArray(effects)) {
        return apiError('Missing effects array', 400);
      }

      const prompt = buildGeneratePrompt(effects, presetName);
      return apiSuccess({ prompt });
    }

    return apiError('Unknown action', 400);
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Internal error', 500);
  }
}

// ── Prompt builder ──────────────────────────────────────────────────────────

function buildGeneratePrompt(
  effects: PPStudioEffect[],
  presetName: string | null,
): string {
  const sorted = [...effects].sort((a, b) => a.priority - b.priority);
  const effectSections = sorted.map((e, i) => {
    const paramLines = e.params
      .map((p) => `  - ${p.ueProperty} = ${p.value} (${p.description})`)
      .join('\n');
    return `### ${i + 1}. ${e.name}
- UE class: ${e.ueClass}
- ${e.description}
- Parameters:
${paramLines}`;
  }).join('\n\n');

  const effectNames = sorted.map((e) => e.name).join(', ');
  const presetNote = presetName
    ? `\nThis configuration is based on the "${presetName}" cinematic mood preset.\n`
    : '';

  return `## Task: Generate Post-Process Volume from Recipe Studio
${presetNote}
Generate a complete C++ post-process volume configuration with these ${sorted.length} effects: **${effectNames}**.

### Effect Stack (ordered by priority)

${effectSections}

### Required Output

1. **PostProcessVolume Actor** (extends APostProcessVolume)
   - Header + CPP files
   - UPROPERTY for each effect parameter (grouped by effect category)
   - \`ApplySettings()\` method that writes all values to FPostProcessSettings
   - PostEditChangeProperty for live editor preview

2. **PostProcessComponent** (UActorComponent)
   - For attaching local PP zones to actors
   - UPROPERTY BlendRadius + BlendWeight
   - Subset of most-used effects configurable per-instance

3. **PostProcessSubsystem** (UWorldSubsystem)
   - Global manager for priority-based blending
   - Blueprint-callable override functions for gameplay integration
   - RegisterVolume / UnregisterVolume pattern

### UE5 Best Practices
- Use FPostProcessSettings struct members directly
- Expose all parameters as UPROPERTY(EditAnywhere, BlueprintReadWrite)
- Group UPROPERTYs: "PostProcess|Bloom", "PostProcess|ColorGrading", etc.
- Use PostEditChangeProperty for live preview
- ALWAYS verify the build compiles after changes`;
}
