import { apiSuccess, apiError } from '@/lib/api-utils';
import { PRESETS } from '@/lib/post-process-studio/presets';

// ── GET — presets ───────────────────────────────────────────────────────────

export async function GET() {
  return apiSuccess({ presets: PRESETS });
}

// ── POST — retired ──────────────────────────────────────────────────────────
//
// This route used to build a SECOND post-process prompt (`action: 'generate'`,
// a generic APostProcessVolume with no module name, folder or budget) and a
// caller-less `estimate`. The prompt is now composed client-side by the one
// builder on the CLITask rail: TaskFactory.postProcess(toStackSpec(...)) →
// buildPostProcessPrompt. The budget is the pure estimateGPUBudget.

export async function POST() {
  return apiError(
    'post-process-studio no longer builds prompts or estimates: dispatch TaskFactory.postProcess(toStackSpec(effects, resolution))',
    400,
  );
}
