import { apiSuccess, apiError } from '@/lib/api-utils';
import {
  saveSnapshot,
  getLatestSnapshot,
  getSnapshotHistory,
  saveSuggestion,
  getPendingSuggestions,
  getAllSuggestions,
  resolveSuggestion,
  getAcceptedSubGenres,
  getTelemetryStats,
} from '@/lib/telemetry-db';
import {
  extractSignals,
  detectPatterns,
  generateSuggestions,
} from '@/lib/genre-evolution-engine';
import type { DynamicProjectContext } from '@/lib/prompt-context';
import type { ScanTelemetryPayload } from '@/types/telemetry';
import { resolveSkillsFromPatterns } from '@/components/cli/skills';

// ─── GET: stats, history, suggestions ────────────────────────────────────────

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') ?? 'stats';

    switch (action) {
      case 'stats':
        return apiSuccess(getTelemetryStats());

      case 'history':
        return apiSuccess(getSnapshotHistory(Number(searchParams.get('limit') || 20)));

      case 'latest':
        return apiSuccess(getLatestSnapshot());

      case 'suggestions':
        return apiSuccess(getAllSuggestions());

      case 'pending':
        return apiSuccess(getPendingSuggestions());

      default:
        return apiError(`Unknown action: ${action}`, 400);
    }
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Internal error');
  }
}

// ─── POST: scan project, resolve suggestion ──────────────────────────────────

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action = body.action as string;

    switch (action) {
      case 'scan': {
        const { projectPath, dynamicContext } = body as ScanTelemetryPayload & {
          dynamicContext: DynamicProjectContext | null;
        };
        if (!projectPath) {
          return apiError('projectPath required', 400);
        }

        // Extract signals from the project scan data
        const signals = extractSignals(dynamicContext ?? null, projectPath);

        // Detect gameplay patterns
        const detectedPatterns = detectPatterns(signals);

        // Save snapshot
        const snapshot = {
          id: `snap-${Date.now()}`,
          scannedAt: new Date().toISOString(),
          projectPath,
          signals,
          detectedPatterns,
        };
        saveSnapshot(snapshot);

        // Generate new suggestions based on detected patterns
        const accepted = getAcceptedSubGenres();
        const newSuggestions = generateSuggestions(detectedPatterns, accepted);

        // Save new suggestions (dedup by sub-genre — don't re-suggest pending ones)
        const pending = getPendingSuggestions();
        const pendingGenres = new Set(pending.map(s => s.subGenre));
        for (const suggestion of newSuggestions) {
          if (!pendingGenres.has(suggestion.subGenre)) {
            saveSuggestion(suggestion);
          }
        }

        return apiSuccess({
          snapshot,
          newSuggestions: newSuggestions.filter(s => !pendingGenres.has(s.subGenre)),
        });
      }

      case 'resolve': {
        const suggestionId = body.suggestionId as string;
        const resolveAction = body.resolveAction as 'accept' | 'dismiss';
        if (!suggestionId || !resolveAction || (resolveAction !== 'accept' && resolveAction !== 'dismiss')) {
          return apiError('suggestionId and resolveAction required', 400);
        }
        resolveSuggestion(suggestionId, resolveAction);
        return apiSuccess({ ok: true });
      }

      case 'resolve-skills': {
        const latest = getLatestSnapshot();
        const accepted = getAcceptedSubGenres();
        const patterns = latest?.detectedPatterns ?? [];
        const skills = resolveSkillsFromPatterns(patterns, accepted);
        return apiSuccess({ skills, patternCount: patterns.length, acceptedCount: accepted.length });
      }

      default:
        return apiError(`Unknown action: ${action}`, 400);
    }
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Internal error');
  }
}
