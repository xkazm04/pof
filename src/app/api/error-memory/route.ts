import { type NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import {
  recordErrors,
  getModuleErrors,
  getRelevantErrors,
  markResolved,
  getErrorMemoryStats,
} from '@/lib/error-memory-db';
import { fingerprintErrors, extractTaskKeywords } from '@/lib/error-fingerprint';
import type { ErrorMemoryRequest } from '@/types/error-memory';
import type { SubModuleId } from '@/types/modules';

/** One raw compiler error as the fingerprinter reads it; a wrong kind here threw inside it as a 500. */
function isRawError(e: unknown): boolean {
  if (typeof e !== 'object' || e === null) return false;
  const { message, code, file } = e as Record<string, unknown>;
  return typeof message === 'string' && (code == null || typeof code === 'string') && (file == null || typeof file === 'string');
}

export async function POST(req: NextRequest) {
  try {
    const parsed: unknown = await req.json().catch(() => undefined);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return apiError('Request body must be a JSON object', 400);
    }
    const body = parsed as ErrorMemoryRequest;
    const { action } = body;
    if (body.moduleId !== undefined && typeof body.moduleId !== 'string') return apiError('moduleId must be a string', 400);

    switch (action) {
      // ── Record build errors from the CLI ──────────────────────
      case 'record-errors': {
        if (!body.moduleId || !Array.isArray(body.errors) || body.errors.length === 0) {
          return apiError('moduleId and errors[] required', 400);
        }
        if (!body.errors.every(isRawError)) {
          return apiError('each error must be an object with a string message', 400);
        }

        // Fingerprint the raw errors
        const fingerprinted = fingerprintErrors(
          body.errors.map((e) => ({ message: e.message, code: e.code, file: e.file })),
        );

        // Store in DB (upsert — increments occurrence count for existing fingerprints)
        const records = recordErrors(body.moduleId as SubModuleId, fingerprinted);
        return apiSuccess(records);
      }

      // ── Get all errors for a module ───────────────────────────
      case 'get-module-errors': {
        if (!body.moduleId) return apiError('moduleId required', 400);
        const errors = getModuleErrors(body.moduleId as SubModuleId);
        return apiSuccess(errors);
      }

      // ── Get relevant errors for prompt injection ──────────────
      case 'get-relevant-errors': {
        if (!body.moduleId) return apiError('moduleId required', 400);
        const keywords: unknown = body.taskKeywords ?? [];
        if (!Array.isArray(keywords) || !keywords.every((k) => typeof k === 'string')) {
          return apiError('taskKeywords must be an array of strings', 400);
        }
        const relevant = getRelevantErrors(body.moduleId as SubModuleId, keywords);
        return apiSuccess(relevant);
      }

      // ── Mark an error as resolved ─────────────────────────────
      case 'mark-resolved': {
        if (!body.moduleId) return apiError('moduleId required', 400);
        if (typeof body.fingerprint !== 'string' || !body.fingerprint) return apiError('fingerprint required', 400);
        markResolved(body.moduleId as SubModuleId, body.fingerprint);
        return apiSuccess({ resolved: true });
      }

      // ── Stats ─────────────────────────────────────────────────
      case 'get-stats': {
        const stats = getErrorMemoryStats();
        return apiSuccess(stats);
      }

      default:
        return apiError(`Unknown action: ${action}`, 400);
    }
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Internal error', 500);
  }
}
