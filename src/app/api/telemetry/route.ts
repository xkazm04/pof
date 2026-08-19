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
  getTelemetryScopeReport,
  GENRE_SUGGESTION_SCOPE,
} from '@/lib/telemetry-db';
import {
  extractSignals,
  detectPatterns,
  generateSuggestions,
} from '@/lib/genre-evolution-engine';
import type { DynamicProjectContext } from '@/lib/prompt-context';
import type { ScanTelemetryPayload } from '@/types/telemetry';
import { resolveSkillsFromPatterns } from '@/components/cli/skills';

// The active project travels EXPLICITLY on every telemetry read (`?projectPath=` /
// body field). Nothing here infers it: a read that guessed its own scope is exactly
// the mis-attribution this endpoint's snapshots used to feed straight into prompts.
// Omitting it is a legitimate UNSCOPED read (unattributed rows only) — never "the
// newest scan of whichever project happened to run last".

// ─── GET: stats, history, suggestions ────────────────────────────────────────

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') ?? 'stats';
    const projectPath = searchParams.get('projectPath');

    switch (action) {
      case 'stats':
        return apiSuccess(getTelemetryStats(projectPath));

      case 'history':
        return apiSuccess(getSnapshotHistory(Number(searchParams.get('limit') || 20), projectPath));

      case 'latest':
        return apiSuccess(getLatestSnapshot(projectPath));

      case 'scope':
        return apiSuccess({
          snapshots: getTelemetryScopeReport(projectPath),
          subGenreScope: GENRE_SUGGESTION_SCOPE,
        });

      case 'suggestions':
        return apiSuccess(getAllSuggestions(200));

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
        // These patterns decide which domain skill packs get injected into CLI
        // PROMPTS. Reading "the newest snapshot of any project" meant a scan of one
        // project silently changed what another project's prompts carried, so the
        // caller must name the project it is dispatching for. REFUSING is the right
        // failure: the caller (useModuleCLI) treats an error as "inject nothing",
        // which is honest, where a global read was a wrong answer presented as a
        // right one.
        const projectPath = typeof body.projectPath === 'string' ? body.projectPath.trim() : '';
        if (!projectPath) {
          return apiError(
            'projectPath required — skill packs are resolved from THIS project\'s telemetry scan, and an unscoped read would inject another project\'s patterns',
            400,
          );
        }
        const latest = getLatestSnapshot(projectPath);
        const accepted = getAcceptedSubGenres();
        const patterns = latest?.detectedPatterns ?? [];
        const skills = resolveSkillsFromPatterns(patterns, accepted);
        return apiSuccess({
          skills,
          patternCount: patterns.length,
          acceptedCount: accepted.length,
          // Which scan the patterns came from — a null snapshotId means this project
          // has never been scanned, not that it has no patterns.
          projectPath,
          snapshotId: latest?.id ?? null,
          scannedAt: latest?.scannedAt ?? null,
          // Accepted sub-genres are global; say so rather than let the scoped
          // snapshot imply the whole payload is scoped.
          subGenreScope: GENRE_SUGGESTION_SCOPE,
        });
      }

      default:
        return apiError(`Unknown action: ${action}`, 400);
    }
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Internal error');
  }
}
