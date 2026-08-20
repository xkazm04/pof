/**
 * The wizard and the UE dungeon tab now speak ONE ProcgenSpec — and the handoff
 * is required to state what it drops.
 *
 * The two surfaces used to share nothing: `ProceduralLevelConfig` (7 declared
 * inputs) versus `{ roomCount, seed }`, with no path between them. A shared type
 * alone would be worse than nothing, because ARPGLevelGenerator places
 * room-template actors from a pool and cannot reproduce the browser preview's
 * grid — so these tests pin the DISCLOSURE, not just the plumbing.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { ProcGenDungeonPanel } from '@/components/modules/content/level-design/ProcGenDungeonPanel';
import { ProceduralLevelWizard } from '@/components/modules/content/level-design/ProceduralLevelWizard';
import { buildProcgenSpec, type ProcgenSpec } from '@/lib/level-design/procgen-spec';

afterEach(cleanup);

// The panel fetches its run history on mount; a stub keeps that out of the way.
vi.mock('@/components/modules/content/level-design/useRunHistory', () => ({
  useRunHistory: () => ({ runs: [], error: null }),
}));

const SPEC_INPUT = {
  algorithm: 'bsp',
  levelType: 'arena',
  gridWidth: 128,
  gridHeight: 96,
  roomCountMin: 6,
  roomCountMax: 12,
  corridorWidth: 3,
  seed: 'dark-keep',
  constraints: {
    spawnPoints: true, lootPlacement: true, bossRoom: true, secretRooms: false, safeZones: false,
  },
} as const;

const SPEC: ProcgenSpec = buildProcgenSpec({ ...SPEC_INPUT });

const panel = (spec: ProcgenSpec | null, onGenerate = vi.fn()) =>
  render(<ProcGenDungeonPanel onGenerate={onGenerate} isGenerating={false} handoffSpec={spec} />);

describe('the UE dungeon tab consumes the wizard spec', () => {
  it('renders no handoff at all when the wizard has published none', () => {
    const { queryByTestId, getByTestId } = panel(null);
    expect(queryByTestId('dungeon-spec-handoff')).toBeNull();
    // …and the panel is still fully usable on its own.
    expect(getByTestId('dungeon-rooms-input')).toBeTruthy();
  });

  it('summarises the spec it was handed', () => {
    const { getByTestId } = panel(SPEC);
    const text = getByTestId('dungeon-handoff-summary').textContent ?? '';
    expect(text).toContain('BSP');
    expect(text).toContain('128x96');
    expect(text).toContain('dark-keep');
  });

  it('NAMES every declared input ARPGLevelGenerator throws away', () => {
    const { getByTestId } = panel(SPEC);
    const dropped = getByTestId('dungeon-handoff-ignored').textContent ?? '';
    expect(dropped).toContain('Algorithm (BSP)');
    expect(dropped).toContain('Level type (arena)');
    expect(dropped).toContain('Grid size (128x96)');
    expect(dropped).toContain('Corridor width (3)');
    expect(dropped).toContain('Gameplay constraints (3 on)');
    // The two it DOES read must not be listed as dropped.
    expect(dropped).not.toContain('Room count band');
    expect(dropped).not.toContain('Seed (');
  });

  it('reports every lossy step of the projection', () => {
    const { getByTestId } = panel(SPEC);
    const notes = getByTestId('dungeon-handoff-notes').textContent ?? '';
    expect(notes).toMatch(/Room band 6-12 collapsed to 9/);
    expect(notes).toMatch(/unsigned/); // the FNV seed for this label is negative
  });

  it('states outright that the UE bake will not reproduce the preview', () => {
    const { getByTestId } = panel(SPEC);
    const parity = getByTestId('dungeon-handoff-parity').textContent ?? '';
    expect(parity).toContain('Independent previews');
    expect(parity).toMatch(/room-template actors/);
    expect(parity).toMatch(/never the layout/);
  });

  it('adopting fills ONLY the two fields UE reads, and dispatches exactly those', () => {
    const onGenerate = vi.fn();
    const { getByTestId } = panel(SPEC, onGenerate);

    fireEvent.click(getByTestId('dungeon-adopt-spec'));

    const rooms = getByTestId('dungeon-rooms-input') as HTMLInputElement;
    const seed = getByTestId('dungeon-seed-input') as HTMLInputElement;
    expect(rooms.value).toBe('9');
    expect(Number(seed.value)).toBeGreaterThan(0);
    expect(Number(seed.value) | 0).toBe(SPEC.seedValue); // lossless round trip

    // The dispatch itself: click the generate button by its accessible text.
    const generate = [...document.querySelectorAll('button')]
      .find((b) => /Generate Dungeon/i.test(b.textContent ?? ''))!;
    fireEvent.click(generate);
    expect(onGenerate).toHaveBeenCalledWith(9, Number(seed.value));
  });

  it('a spec whose band is out of the panel range is clamped, and says so', () => {
    const wide = buildProcgenSpec({ ...SPEC_INPUT, roomCountMin: 40, roomCountMax: 60 });
    const { getByTestId } = panel(wide);
    fireEvent.click(getByTestId('dungeon-adopt-spec'));
    expect((getByTestId('dungeon-rooms-input') as HTMLInputElement).value).toBe('20');
    expect(getByTestId('dungeon-handoff-notes').textContent ?? '').toMatch(/clamped to 20/);
  });
});

describe('the wizard produces the spec the panel consumes', () => {
  it('publishes a spec with a resolved seed, and it drives the real disclosure', () => {
    const onSpecChange = vi.fn();
    render(<ProceduralLevelWizard onGenerate={vi.fn()} isGenerating={false} onSpecChange={onSpecChange} />);

    expect(onSpecChange).toHaveBeenCalled();
    const published = onSpecChange.mock.calls.at(-1)![0] as ProcgenSpec;
    expect(Number.isInteger(published.seedValue)).toBe(true);
    expect(published.constraints).toBeTruthy();
    expect(published.algorithm).toBe('bsp');

    cleanup();

    // The JOINT half: the wizard's own output, handed to the real panel.
    const { getByTestId } = panel(published);
    expect(getByTestId('dungeon-handoff-ignored').textContent ?? '')
      .toContain(`Grid size (${published.gridWidth}x${published.gridHeight})`);
    fireEvent.click(getByTestId('dungeon-adopt-spec'));
    const seed = Number((getByTestId('dungeon-seed-input') as HTMLInputElement).value);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed | 0).toBe(published.seedValue);
  });
});
