import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { readJsonObject, MALFORMED_BODY_ERROR } from '@/app/api/blender-mcp/_lib/body';
import { parseBlueprintJson, summarizeBlueprintForPrompt } from '@/lib/blueprint-parser';
import { generateCppFromBlueprint } from '@/lib/blueprint-cpp-codegen';
import { computeSemanticDiff } from '@/lib/blueprint-semantic-diff';

// ─── POST /api/blueprint-transpiler ─────────────────────────────────────────
//
// transpile and diff each return the parse they were computed from (`asset` +
// `summary`, additive), so a client action is ONE request and the server parses
// the Blueprint once. `parse` stays for callers that only want the parse.

export async function POST(request: NextRequest) {
  try {
    const raw = await readJsonObject(request);
    if (!raw) return apiError(MALFORMED_BODY_ERROR, 400);
    const body = raw as { action?: string; blueprintJson?: unknown; existingCpp: string; projectName?: string; moduleName?: string };
    const action = body.action as string;

    // The parser takes text or an object; anything else "parsed" to an empty Blueprint.
    const input = body.blueprintJson;
    if (input !== undefined && typeof input !== 'string' && (typeof input !== 'object' || input === null || Array.isArray(input))) {
      return apiError('blueprintJson must be a JSON string or object', 400);
    }
    const blueprintJson = input as string;

    switch (action) {
      case 'parse':
        return handleParse(blueprintJson);

      case 'transpile':
        return handleTranspile(blueprintJson, body.projectName, body.moduleName);

      case 'diff':
        return handleDiff(blueprintJson, body.existingCpp, body.projectName);

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
    return apiSuccess({ ...result, asset, summary: summarizeBlueprintForPrompt(asset) });
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
    return apiSuccess({ ...result, asset, summary: summarizeBlueprintForPrompt(asset) });
  } catch (e) {
    return apiError(`Diff failed: ${e instanceof Error ? e.message : 'Error'}`, 400);
  }
}
