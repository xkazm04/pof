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

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ErrorMemoryRequest;
    const { action } = body;

    switch (action) {
      // ── Record build errors from the CLI ──────────────────────
      case 'record-errors': {
        if (!body.moduleId || !body.errors || body.errors.length === 0) {
          return apiError('moduleId and errors[] required', 400);
        }

        // Fingerprint the raw errors
        const fingerprinted = fingerprintErrors(
          body.errors.map((e) => ({ message: e.message, code: e.code, file: e.file })),
        );

        // Store in DB (upsert — increments occurrence count for existing fingerprints)
        const records = recordErrors(body.moduleId, fingerprinted);
        return apiSuccess(records);
      }

      // ── Get all errors for a module ───────────────────────────
      case 'get-module-errors': {
        if (!body.moduleId) return apiError('moduleId required', 400);
        const errors = getModuleErrors(body.moduleId);
        return apiSuccess(errors);
      }

      // ── Get relevant errors for prompt injection ──────────────
      case 'get-relevant-errors': {
        if (!body.moduleId) return apiError('moduleId required', 400);
        const keywords = body.taskKeywords ?? [];
        const relevant = getRelevantErrors(body.moduleId, keywords);
        return apiSuccess(relevant);
      }

      // ── Mark an error as resolved ─────────────────────────────
      case 'mark-resolved': {
        if (!body.fingerprint) return apiError('fingerprint required', 400);
        markResolved(body.fingerprint);
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
