import { apiSuccess, apiError } from '@/lib/api-utils';
import {
  createSession,
  listSessions,
  getSession,
  deleteSession,
  updateSessionStatus,
  updateSessionSummary,
  addFinding,
  getFindings,
  addEvent,
  getEvents,
  getDirectorStats,
} from '@/lib/game-director-db';
import type {
  CreateSessionPayload,
  PlaytestConfig,
  PlaytestFinding,
  PlaytestSummary,
  DirectorEvent,
  PlaytestStatus,
} from '@/types/game-director';

// ─── GET: list sessions, get single session, get findings, get events, get stats
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') ?? 'list';
    const sessionId = searchParams.get('sessionId');

    switch (action) {
      case 'list':
        return apiSuccess(listSessions());

      case 'get':
        if (!sessionId) return apiError('sessionId required', 400);
        const session = getSession(sessionId);
        if (!session) return apiError('Session not found', 404);
        return apiSuccess(session);

      case 'findings':
        if (!sessionId) return apiError('sessionId required', 400);
        return apiSuccess(getFindings(sessionId));

      case 'events':
        if (!sessionId) return apiError('sessionId required', 400);
        return apiSuccess(getEvents(sessionId));

      case 'stats':
        return apiSuccess(getDirectorStats());

      default:
        return apiError(`Unknown action: ${action}`, 400);
    }
  } catch (err) {
    console.error('[game-director] GET error:', err);
    return apiError(String(err));
  }
}

// ─── POST: create session, start session, add finding, add event, run analysis
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action = body.action as string;

    switch (action) {
      case 'create': {
        const { name, buildPath, config } = body as CreateSessionPayload & { action: string };
        const id = `gd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const session = createSession(id, name, buildPath, config);
        return apiSuccess(session);
      }

      case 'update-status': {
        const { sessionId, status } = body as { action: string; sessionId: string; status: PlaytestStatus };
        updateSessionStatus(sessionId, status);
        return apiSuccess({ ok: true });
      }

      case 'complete': {
        const { sessionId, summary, durationMs, systemsTestedCount, findingsCount } = body as {
          action: string;
          sessionId: string;
          summary: PlaytestSummary;
          durationMs: number;
          systemsTestedCount: number;
          findingsCount: number;
        };
        updateSessionSummary(sessionId, summary, durationMs, systemsTestedCount, findingsCount);
        return apiSuccess({ ok: true });
      }

      case 'add-finding': {
        const { finding } = body as { action: string; finding: PlaytestFinding };
        addFinding(finding);
        return apiSuccess({ ok: true });
      }

      case 'add-event': {
        const { event } = body as { action: string; event: DirectorEvent };
        addEvent(event);
        return apiSuccess({ ok: true });
      }

      case 'simulate': {
        // Simulate a playtest session for demo/dev purposes
        const { sessionId } = body as { action: string; sessionId: string };
        const session = getSession(sessionId);
        if (!session) return apiError('Session not found', 404);

        await simulatePlaytest(sessionId, session.config);
        const updatedSession = getSession(sessionId);
        return apiSuccess(updatedSession);
      }

      default:
        return apiError(`Unknown action: ${action}`, 400);
    }
  } catch (err) {
    console.error('[game-director] POST error:', err);
    return apiError(String(err));
  }
}

// ─── DELETE: remove session
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    if (!sessionId) return apiError('sessionId required', 400);
    deleteSession(sessionId);
    return apiSuccess({ ok: true });
  } catch (err) {
    console.error('[game-director] DELETE error:', err);
    return apiError(String(err));
  }
}

// ─── Simulation engine ──────────────────────────────────────────────────────
// Generates realistic-looking playtest data for the UI to render.
// In production, this would orchestrate actual UE5 Gauntlet automation.

async function simulatePlaytest(sessionId: string, config: PlaytestConfig) {
  updateSessionStatus(sessionId, 'launching');

  // Emit launch event
  addEvent({
    id: `ev-${Date.now()}-launch`,
    sessionId,
    timestamp: new Date().toISOString(),
    type: 'action',
    message: 'Launching packaged build in headless mode...',
  });

  updateSessionStatus(sessionId, 'playing');

  const startTime = Date.now();
  const systems = config.testCategories;
  const findings: PlaytestFinding[] = [];

  // Generate events and findings for each test category
  for (const category of systems) {
    addEvent({
      id: `ev-${Date.now()}-${category}-start`,
      sessionId,
      timestamp: new Date().toISOString(),
      type: 'system-test',
      message: `Testing ${category} systems...`,
      data: { category },
    });

    // Generate findings per category
    const categoryFindings = generateFindingsForCategory(sessionId, category);
    for (const f of categoryFindings) {
      findings.push(f);
      addFinding(f);
      addEvent({
        id: `ev-${Date.now()}-finding-${f.id}`,
        sessionId,
        timestamp: new Date().toISOString(),
        type: 'finding',
        message: `[${f.severity.toUpperCase()}] ${f.title}`,
        data: { findingId: f.id, category: f.category },
      });
    }

    // Screenshots
    addEvent({
      id: `ev-${Date.now()}-${category}-screenshot`,
      sessionId,
      timestamp: new Date().toISOString(),
      type: 'screenshot',
      message: `Captured screenshot during ${category} test`,
      data: { category },
    });
  }

  // Analysis phase
  updateSessionStatus(sessionId, 'analyzing');
  addEvent({
    id: `ev-${Date.now()}-analyze`,
    sessionId,
    timestamp: new Date().toISOString(),
    type: 'action',
    message: 'Analyzing captured screenshots with Claude Vision...',
  });

  // Build summary
  const criticals = findings.filter(f => f.severity === 'critical').length;
  const positives = findings.filter(f => f.severity === 'positive').length;
  const overallScore = Math.max(0, Math.min(100,
    80 - (criticals * 15) - (findings.filter(f => f.severity === 'high').length * 8)
    - (findings.filter(f => f.severity === 'medium').length * 3) + (positives * 5)
  ));

  const testCoverage: Record<string, number> = {};
  for (const cat of systems) {
    testCoverage[cat] = Math.floor(60 + Math.random() * 40);
  }

  const topIssue = findings.find(f => f.severity === 'critical' || f.severity === 'high');
  const topPraise = findings.find(f => f.severity === 'positive');

  const durationMs = Date.now() - startTime;

  updateSessionSummary(
    sessionId,
    {
      overallScore,
      totalScreenshotsAnalyzed: systems.length * 3,
      systemsTested: systems,
      testCoverage: testCoverage as PlaytestSummary['testCoverage'],
      topIssue: topIssue?.title ?? 'No critical issues found',
      topPraise: topPraise?.title ?? 'Overall build stability',
      playtimeSeconds: Math.floor(durationMs / 1000) + config.maxPlaytimeMinutes * 60,
    },
    durationMs,
    systems.length,
    findings.length,
  );
}

function generateFindingsForCategory(sessionId: string, category: string): PlaytestFinding[] {
  const now = Date.now();
  const templates: Record<string, PlaytestFinding[]> = {
    combat: [
      { id: `f-${now}-c1`, sessionId, category: 'gameplay-feel', severity: 'medium', title: 'Attack animation cancels feel sluggish', description: 'The window between combo attacks has a 200ms dead zone where input is ignored. Players expect immediate responsiveness during combo chains.', relatedModule: 'arpg-combat', screenshotRef: null, gameTimestamp: 45, suggestedFix: 'Reduce combo window gap from 200ms to 80ms. Buffer input during last 4 frames of attack recovery.', confidence: 85, createdAt: new Date().toISOString() },
      { id: `f-${now}-c2`, sessionId, category: 'animation-issue', severity: 'high', title: 'Hit reaction montage overlaps with dodge', description: 'When hit during dodge i-frames, both hit reaction and dodge animations play simultaneously causing visual jitter.', relatedModule: 'arpg-animation', screenshotRef: null, gameTimestamp: 72, suggestedFix: 'Add montage priority system. Dodge montages should have higher priority than hit reactions during i-frame window.', confidence: 92, createdAt: new Date().toISOString() },
      { id: `f-${now}-c3`, sessionId, category: 'positive-feedback', severity: 'positive', title: 'Weapon trail VFX timing is excellent', description: 'The Niagara weapon trail aligns perfectly with the attack montage window. The visual feedback clearly communicates the active hit frames.', relatedModule: 'arpg-combat', screenshotRef: null, gameTimestamp: 30, suggestedFix: '', confidence: 95, createdAt: new Date().toISOString() },
    ],
    exploration: [
      { id: `f-${now}-e1`, sessionId, category: 'level-pacing', severity: 'medium', title: 'Dead zone in north corridor', description: 'The north corridor between hub and arena is 40 seconds of empty walking with no visual interest, pickups, or enemies.', relatedModule: 'arpg-world', screenshotRef: null, gameTimestamp: 120, suggestedFix: 'Add 2-3 prop clusters, a small encounter, or collectibles along the corridor to maintain engagement.', confidence: 88, createdAt: new Date().toISOString() },
      { id: `f-${now}-e2`, sessionId, category: 'visual-glitch', severity: 'high', title: 'Z-fighting on overlapping floor meshes', description: 'Two floor plane meshes overlap at the dungeon entrance causing visible z-fighting flickering. Clearly visible during normal gameplay.', relatedModule: null, screenshotRef: null, gameTimestamp: 95, suggestedFix: 'Offset one mesh by 0.5 units on Z axis, or merge the two meshes in the editor.', confidence: 97, createdAt: new Date().toISOString() },
    ],
    dialogue: [
      { id: `f-${now}-d1`, sessionId, category: 'ux-problem', severity: 'medium', title: 'Dialogue choice text truncated at 1080p', description: 'Long dialogue options are clipped on the right side at 1920x1080 resolution. The last 2-3 words of choice #3 are not visible.', relatedModule: 'arpg-ui', screenshotRef: null, gameTimestamp: 180, suggestedFix: 'Add text wrapping to dialogue choice buttons or reduce font size for choices exceeding single-line width.', confidence: 90, createdAt: new Date().toISOString() },
      { id: `f-${now}-d2`, sessionId, category: 'positive-feedback', severity: 'positive', title: 'Typewriter text effect enhances immersion', description: 'The character-by-character text reveal with variable speed per sentence creates excellent pacing for dialogue reading.', relatedModule: 'arpg-ui', screenshotRef: null, gameTimestamp: 185, suggestedFix: '', confidence: 88, createdAt: new Date().toISOString() },
    ],
    'save-load': [
      { id: `f-${now}-s1`, sessionId, category: 'save-load', severity: 'critical', title: 'Inventory state not restored after load', description: 'Items picked up before saving are missing from inventory after loading the save. The save file contains the items but the deserialization fails silently.', relatedModule: 'arpg-inventory', screenshotRef: null, gameTimestamp: 300, suggestedFix: 'Check USaveGame::Serialize() — the InventoryItems TArray likely needs a custom serialization path. Verify UPROPERTY(SaveGame) tag on the array.', confidence: 95, createdAt: new Date().toISOString() },
      { id: `f-${now}-s2`, sessionId, category: 'save-load', severity: 'medium', title: 'Player rotation not preserved on load', description: 'After loading, the player always faces north regardless of saved rotation. Camera resets to default yaw.', relatedModule: 'arpg-save', screenshotRef: null, gameTimestamp: 310, suggestedFix: 'Ensure PlayerRotation FRotator is marked with UPROPERTY(SaveGame) and restored via Controller->SetControlRotation().', confidence: 87, createdAt: new Date().toISOString() },
    ],
    'ui-navigation': [
      { id: `f-${now}-u1`, sessionId, category: 'ux-problem', severity: 'high', title: 'Gamepad cannot navigate settings tabs', description: 'The settings menu tabs are not focusable via gamepad D-pad. Players must use mouse to switch between Video/Audio/Controls tabs.', relatedModule: 'arpg-ui', screenshotRef: null, gameTimestamp: 200, suggestedFix: 'Add UCommonActivatableWidget navigation to settings tabs. Bind LB/RB for tab switching.', confidence: 93, createdAt: new Date().toISOString() },
    ],
    'ai-behavior': [
      { id: `f-${now}-a1`, sessionId, category: 'ai-behavior', severity: 'high', title: 'Enemies stuck on nav mesh edge near stairs', description: 'Enemies attempting to path from arena floor to elevated platform get stuck at the bottom of stairs. They oscillate between two nav mesh polys.', relatedModule: 'arpg-enemy-ai', screenshotRef: null, gameTimestamp: 150, suggestedFix: 'Add NavLinkProxy at stair base. Check NavMesh agent step height (currently 45, may need 55 for these stairs).', confidence: 91, createdAt: new Date().toISOString() },
      { id: `f-${now}-a2`, sessionId, category: 'ai-behavior', severity: 'medium', title: 'All enemies attack simultaneously', description: 'When 4+ enemies aggro, all attack at once with no staggering. This creates unfair difficulty spikes and looks robotic.', relatedModule: 'arpg-enemy-ai', screenshotRef: null, gameTimestamp: 160, suggestedFix: 'Implement attack token system: max 2 simultaneous attackers, others circle at range. Use UAISquadManager.', confidence: 89, createdAt: new Date().toISOString() },
    ],
    'performance-stress': [
      { id: `f-${now}-p1`, sessionId, category: 'performance', severity: 'high', title: 'FPS drops to 28 during multi-enemy combat', description: 'With 6+ enemies on screen using Niagara VFX, frame rate drops from 60 to 28 FPS. GPU-bound per stat unit.', relatedModule: null, screenshotRef: null, gameTimestamp: 250, suggestedFix: 'Reduce Niagara particle count per system. Enable GPU instancing on enemy skeletal meshes. Profile with Unreal Insights.', confidence: 94, createdAt: new Date().toISOString() },
    ],
    'visual-quality': [
      { id: `f-${now}-v1`, sessionId, category: 'visual-glitch', severity: 'medium', title: 'Texture pop-in visible on LOD transition', description: 'Environment rocks show noticeable texture shimmer when transitioning from LOD1 to LOD0 at ~15 meters distance.', relatedModule: null, screenshotRef: null, gameTimestamp: 60, suggestedFix: 'Increase LOD bias for rock assets or enable dithered LOD transition in material settings.', confidence: 82, createdAt: new Date().toISOString() },
      { id: `f-${now}-v2`, sessionId, category: 'positive-feedback', severity: 'positive', title: 'Post-process color grading creates cohesive atmosphere', description: 'The warm-to-cool color grade transition between safe zones and hostile areas effectively communicates danger through environment alone.', relatedModule: null, screenshotRef: null, gameTimestamp: 80, suggestedFix: '', confidence: 90, createdAt: new Date().toISOString() },
    ],
  };

  return templates[category] ?? [];
}
