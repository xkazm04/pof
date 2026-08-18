/**
 * The UE panels now REMEMBER.
 *
 * Both re-rolled the seed with `Math.random()` and kept nothing, so the seed
 * behind a good map was gone one click later, and a run that failed was
 * indistinguishable from a run nobody started. This suite renders the panels
 * against a history payload and asserts: every run is a row, a failure shows its
 * reason, and one click puts an old seed back in the field.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { mockFetch } from '@/__tests__/setup';
import { ProcGenDungeonPanel } from '@/components/modules/content/level-design/ProcGenDungeonPanel';
import { BiomeScatterPanel } from '@/components/modules/content/level-design/BiomeScatterPanel';
import type { ProcgenRun, ScatterRun } from '@/types/procgen';

afterEach(cleanup);

const baseRun = {
  algorithm: 'ARPGLevelGenerator',
  params: {},
  docId: 7 as number | null,
  mapPath: '/Game/Maps/ProcGenDungeon',
  success: true,
  failureReason: '',
  createdAt: '2026-08-18 10:00:00',
};

const PROCGEN_RUNS: ProcgenRun[] = [
  { ...baseRun, id: 3, seed: 9090, roomCount: 0, success: false, failureReason: 'no room templates in the pool' },
  { ...baseRun, id: 2, seed: 4242, roomCount: 9 },
  { ...baseRun, id: 1, seed: 1337, roomCount: 6, docId: null },
];

const SCATTER_RUNS: ScatterRun[] = [
  { ...baseRun, id: 2, seed: 88, instanceCount: 120, algorithm: 'AARPGVegetationScatter' },
  { ...baseRun, id: 1, seed: 55, instanceCount: 0, success: false, failureReason: 'arena floor actor not found' },
];

describe('ProcGenDungeonPanel run history', () => {
  it('lists every run — failures included, with their reason', async () => {
    mockFetch({ body: { success: true, data: { runs: PROCGEN_RUNS } } });
    const { findByTestId, getByTestId } = render(
      <ProcGenDungeonPanel onGenerate={vi.fn()} isGenerating={false} />,
    );

    const list = await findByTestId('dungeon-history-list');
    expect(list.querySelectorAll('li')).toHaveLength(3);

    const failed = getByTestId('dungeon-history-row-3');
    expect(failed.getAttribute('data-outcome')).toBe('failed');
    expect(getByTestId('dungeon-history-reason-3').textContent).toMatch(/no room templates/);

    // The successful rows say what they produced and which doc they belong to.
    expect(getByTestId('dungeon-history-row-2').textContent).toMatch(/9 rooms/);
    expect(getByTestId('dungeon-history-row-2').textContent).toMatch(/doc #7/);
  });

  it('does not read a failed latest run as "0 rooms"', async () => {
    mockFetch({ body: { success: true, data: { runs: PROCGEN_RUNS } } });
    const { findByTestId } = render(<ProcGenDungeonPanel onGenerate={vi.fn()} isGenerating={false} />);
    await findByTestId('dungeon-history-list');

    const summary = document.body.textContent ?? '';
    expect(summary).toMatch(/Last run FAILED \(seed 9090\)/);
    expect(summary).not.toMatch(/Last run: 0 rooms/);
  });

  it('one click puts an earlier seed back in the field, and generates with it', async () => {
    mockFetch({ body: { success: true, data: { runs: PROCGEN_RUNS } } });
    const onGenerate = vi.fn();
    const { findByTestId, getByTestId, getByRole } = render(
      <ProcGenDungeonPanel onGenerate={onGenerate} isGenerating={false} />,
    );
    await findByTestId('dungeon-history-list');

    const seed = getByTestId('dungeon-seed-input') as HTMLInputElement;
    expect(seed.value).toBe('1337');

    fireEvent.click(getByTestId('dungeon-history-reuse-2'));
    expect(seed.value).toBe('4242');

    fireEvent.click(getByRole('button', { name: /generate dungeon/i }));
    expect(onGenerate).toHaveBeenCalledWith(6, 4242);
  });

  it('shows the empty state when nothing has ever run', async () => {
    mockFetch({ body: { success: true, data: { runs: [] } } });
    const { findByTestId } = render(<ProcGenDungeonPanel onGenerate={vi.fn()} isGenerating={false} />);
    expect((await findByTestId('dungeon-history-empty')).textContent).toMatch(/including a failed one/);
  });

  it('surfaces a history load failure instead of rendering an empty (reassuring) list', async () => {
    mockFetch({ body: { success: false, error: 'procgen store offline' } });
    const { findByTestId, queryByTestId } = render(
      <ProcGenDungeonPanel onGenerate={vi.fn()} isGenerating={false} />,
    );
    expect((await findByTestId('dungeon-fetch-error')).textContent).toContain('procgen store offline');
    expect(queryByTestId('dungeon-history-empty')).toBeNull();
  });

  it('does not poll while a generation is in flight', async () => {
    const fetchMock = mockFetch({ body: { success: true, data: { runs: [] } } });
    render(<ProcGenDungeonPanel onGenerate={vi.fn()} isGenerating={true} />);
    await waitFor(() => expect(fetchMock).not.toHaveBeenCalled());
  });
});

describe('BiomeScatterPanel run history', () => {
  it('lists runs and reuses a seed', async () => {
    mockFetch({ body: { success: true, data: { runs: SCATTER_RUNS } } });
    const onGenerate = vi.fn();
    const { findByTestId, getByTestId, getByRole } = render(
      <BiomeScatterPanel onGenerate={onGenerate} isGenerating={false} />,
    );

    await findByTestId('scatter-history-list');
    expect(getByTestId('scatter-history-row-2').textContent).toMatch(/120 instances/);
    expect(getByTestId('scatter-history-reason-1').textContent).toMatch(/arena floor actor not found/);

    fireEvent.click(getByTestId('scatter-history-reuse-1'));
    expect((getByTestId('scatter-seed-input') as HTMLInputElement).value).toBe('55');

    fireEvent.click(getByRole('button', { name: /scatter props/i }));
    expect(onGenerate).toHaveBeenCalledWith(1, 55);
  });
});
