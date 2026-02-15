import { NextResponse } from 'next/server';
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
        return NextResponse.json(getTelemetryStats());

      case 'history':
        return NextResponse.json(getSnapshotHistory(Number(searchParams.get('limit') || 20)));

      case 'latest':
        return NextResponse.json(getLatestSnapshot());

      case 'suggestions':
        return NextResponse.json(getAllSuggestions());

      case 'pending':
        return NextResponse.json(getPendingSuggestions());

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
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
          return NextResponse.json({ error: 'projectPath required' }, { status: 400 });
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

        return NextResponse.json({
          snapshot,
          newSuggestions: newSuggestions.filter(s => !pendingGenres.has(s.subGenre)),
        });
      }

      case 'resolve': {
        const suggestionId = body.suggestionId as string;
        const resolveAction = body.resolveAction as 'accept' | 'dismiss';
        if (!suggestionId || !resolveAction || (resolveAction !== 'accept' && resolveAction !== 'dismiss')) {
          return NextResponse.json({ error: 'suggestionId and resolveAction required' }, { status: 400 });
        }
        resolveSuggestion(suggestionId, resolveAction);
        return NextResponse.json({ ok: true });
      }

      case 'resolve-skills': {
        const latest = getLatestSnapshot();
        const accepted = getAcceptedSubGenres();
        const patterns = latest?.detectedPatterns ?? [];
        const skills = resolveSkillsFromPatterns(patterns, accepted);
        return NextResponse.json({ skills, patternCount: patterns.length, acceptedCount: accepted.length });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
