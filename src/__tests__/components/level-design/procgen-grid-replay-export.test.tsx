/**
 * The handoff offers the replay export, and states BOTH halves of its claim.
 *
 * Registry standard: `game-production/procedural-level-planning` —
 * `seed-determinism-contract`: a contract states its limits, so the panel that
 * announces exact parity must announce the unverified rung in the same breath.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { ProcgenSpecHandoff } from '@/components/modules/content/level-design/ProcgenSpecHandoff';
import { buildProcgenSpec, type ProcgenSpec } from '@/lib/level-design/procgen-spec';
import { PROCGEN_GRID_EXPORT_VERSION } from '@/lib/level-design/procgen-grid-export';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const spec = (): ProcgenSpec => buildProcgenSpec({
  algorithm: 'cellular',
  levelType: 'dungeon',
  gridWidth: 32,
  gridHeight: 32,
  roomCountMin: 6,
  roomCountMax: 12,
  corridorWidth: 3,
  seed: '149',
  constraints: {
    spawnPoints: true, lootPlacement: true, bossRoom: true, secretRooms: false, safeZones: false,
    ensureConnected: false,
  },
});

function renderHandoff() {
  return render(<ProcgenSpecHandoff spec={spec()} onAdopt={() => {}} />);
}

describe('ProcgenGridReplayExport in the handoff', () => {
  it('offers the export beside the lossy ARPGLevelGenerator adoption', () => {
    const { getByTestId } = renderHandoff();
    expect(getByTestId('dungeon-adopt-spec')).toBeTruthy();
    expect(getByTestId('procgen-export-grid').textContent).toContain('Export grid for UE replay');
  });

  it('states the proven half AND the unverified half', () => {
    const { getByTestId } = renderHandoff();
    expect(getByTestId('procgen-replay-proven').textContent).toContain('Exact by construction');
    const unverified = getByTestId('procgen-replay-unverified').textContent ?? '';
    expect(unverified).toContain('UNVERIFIED');
    expect(unverified).toMatch(/no live replay/i);
  });

  it('names the engine facts rather than restating them in the component', () => {
    const { getByTestId } = renderHandoff();
    const panel = getByTestId('procgen-grid-replay').textContent ?? '';
    expect(panel).toContain('UE grid replay');
    expect(panel).toContain('procgen_replay.py');
    expect(panel).toContain(`v${PROCGEN_GRID_EXPORT_VERSION}`);
  });

  it('downloads a named artifact and reports what was written', () => {
    const created: string[] = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => { created.push('blob:x'); return 'blob:x'; });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clicks: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push(this.download);
    });

    const { getByTestId } = renderHandoff();
    fireEvent.click(getByTestId('procgen-export-grid'));

    expect(created).toHaveLength(1);
    expect(clicks).toEqual(['procgen-cellular-32x32-149.json']);
    const note = getByTestId('procgen-export-note').textContent ?? '';
    expect(note).toContain('procgen-cellular-32x32-149.json');
    expect(note).toContain('32x32 cells');
    expect(note).toContain('scripts/ue/procgen_replay.py');
  });
});
