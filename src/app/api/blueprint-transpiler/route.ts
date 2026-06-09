import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { parseBlueprintJson, summarizeBlueprintForPrompt } from '@/lib/blueprint-parser';
import { generateCppFromBlueprint } from '@/lib/blueprint-cpp-codegen';
import { computeSemanticDiff } from '@/lib/blueprint-semantic-diff';

// ─── POST /api/blueprint-transpiler ─────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action as string;

    switch (action) {
      case 'parse':
        return handleParse(body.blueprintJson);

      case 'transpile':
        return handleTranspile(body.blueprintJson, body.projectName, body.moduleName);

      case 'diff':
        return handleDiff(body.blueprintJson, body.existingCpp, body.projectName);

      default:
        return apiError(`Unknown action: ${action}`, 400);
    }
  } catch (error) {
    console.error('Blueprint transpiler error:', error);
    return apiError(error instanceof Error ? error.message : 'Transpiler error');
  }
}

// ─── Parse Blueprint JSON ───────────────────────────────────────────────────

function handleParse(blueprintJson: string) {
  if (!blueprintJson) return apiError('blueprintJson is required', 400);

  try {
    const asset = parseBlueprintJson(blueprintJson);
    return apiSuccess({
      asset,
      summary: summarizeBlueprintForPrompt(asset),
    });
  } catch (e) {
    return apiError(`Failed to parse Blueprint JSON: ${e instanceof Error ? e.message : 'Parse error'}`, 400);
  }
}

// ─── Transpile to C++ ───────────────────────────────────────────────────────

function handleTranspile(
  blueprintJson: string,
  projectName?: string,
  moduleName?: string,
) {
  if (!blueprintJson) return apiError('blueprintJson is required', 400);

  try {
    const asset = parseBlueprintJson(blueprintJson);
    const result = generateCppFromBlueprint(asset, projectName ?? 'MyProject', moduleName);
    return apiSuccess(result);
  } catch (e) {
    return apiError(`Transpilation failed: ${e instanceof Error ? e.message : 'Error'}`, 400);
  }
}

// ─── Semantic Diff ──────────────────────────────────────────────────────────

function handleDiff(
  blueprintJson: string,
  existingCpp: string,
  projectName?: string,
) {
  if (!blueprintJson) return apiError('blueprintJson is required', 400);
  if (!existingCpp) return apiError('existingCpp is required', 400);

  try {
    const asset = parseBlueprintJson(blueprintJson);
    const result = computeSemanticDiff(asset, existingCpp, projectName ?? 'MyProject');
    return apiSuccess(result);
  } catch (e) {
    return apiError(`Diff failed: ${e instanceof Error ? e.message : 'Error'}`, 400);
  }
}
