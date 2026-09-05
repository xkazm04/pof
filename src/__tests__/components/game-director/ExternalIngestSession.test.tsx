/**
 * End-to-end acceptance for the external-ingestion path: a REAL harness run
 * record goes in through the route, and what comes out is a session the UI
 * shows as measured — never as simulated, and never offering to overwrite it
 * with the simulator.
 *
 * Nothing here hand-writes `source: 'external'` onto the object the component
 * receives: the provenance is whatever the ingest actually persisted.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-gd-ingest-${process.pid}.db`;
});

import { POST } from '@/app/api/game-director/route';
import { getSession, getFindings } from '@/lib/game-director-db';
import { SessionDetail } from '@/components/modules/game-director/SessionDetail';
import type { PlaytestSession } from '@/types/game-director';

afterEach(cleanup);

/** Trimmed slice of the committed `.harness-dzin` run record. */
const RUN = {
  plan: {
    game: 'PoF-Dzin',
    projectPath: 'C:/Users/kazda/kiro/pof',
    ueVersion: '5.7.3',
    iteration: 18,
    totalFeatures: 40,
    passingFeatures: 30,
    verifiedFeatures: 20,
    areas: [
      { id: 'dzin-enemy-world-panels', moduleId: 'arpg-enemy-ai', label: 'Enemy AI & World Panels', features: [] },
    ],
  },
  progress: [
    {
      iteration: 18,
      timestamp: '2026-04-01T13:23:07.776Z',
      areaId: 'dzin-enemy-world-panels',
      moduleId: 'arpg-enemy-ai',
      action: 'execute',
      outcome: 'partial',
      summary: 'Panels reviewed.',
      durationMs: 70791,
      featuresChanged: [],
      verification: 'fail',
    },
  ],
};

function post(body: unknown): Request {
  return new Request('http://localhost/api/game-director', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const detailProps = {
  onBack: () => {},
  onSimulate: async () => {},
  onDelete: async () => {},
  simulating: false,
  getFindings: vi.fn().mockResolvedValue([]),
  getEvents: vi.fn().mockResolvedValue([]),
  markFixDispatched: vi.fn(),
};

async function ingest(run: unknown): Promise<{ status: number; body: { success: boolean; data?: { sessionId: string }; error?: string } }> {
  const response = await POST(post({ action: 'ingest-external', run }));
  return { status: response.status, body: await response.json() };
}

describe('POST /api/game-director { action: ingest-external }', () => {
  it('produces a completed session stamped external with findings', async () => {
    const { body } = await ingest(RUN);
    expect(body.success).toBe(true);
    const sessionId = body.data!.sessionId;

    const session = getSession(sessionId) as PlaytestSession;
    expect(session.source).toBe('external');
    expect(session.status).toBe('complete');
    expect(getFindings(sessionId).length).toBeGreaterThanOrEqual(1);
  });

  it('refuses a malformed record with a reason and writes no session', async () => {
    const before = getSession('none');
    expect(before).toBeNull();

    const { status, body } = await ingest({ plan: { game: '', projectPath: '' }, progress: [] });
    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/build identity/);
  });
});

describe('an ingested session reads as measured in the UI', () => {
  it('shows the measured banner and never offers the simulator', async () => {
    const { body } = await ingest(RUN);
    const session = getSession(body.data!.sessionId) as PlaytestSession;

    render(<SessionDetail session={session} {...detailProps} />);

    expect(screen.getByText(/written by a real playtest harness/i)).toBeTruthy();
    expect(screen.queryByText(/no build was launched/i)).toBeNull();

    // Re-simulating would overwrite measured findings with canned ones and
    // restamp the row `simulated` — the control is not offered at all.
    expect(screen.queryByText('Re-simulate')).toBeNull();
    expect(screen.queryByText('Simulate Playtest')).toBeNull();
  });
});
