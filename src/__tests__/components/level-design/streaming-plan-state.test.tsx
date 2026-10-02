/**
 * The streaming plan survives the planner unmounting: the level-design view
 * owns the reducer and hands it down as `store`, like the procgen spec.
 *
 * Before: `useStreamingZonePlanner` reseeded DEFAULT_ZONES in component-local
 * useState on every mount, and the planner is mounted only while the Streaming
 * tab is active, so one tab round trip discarded every painted zone and link.
 */
import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { useMemo, useReducer } from 'react';
import { render, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { StreamingZonePlanner } from '@/components/modules/content/level-design/StreamingZonePlanner';
import { LevelDesignView } from '@/components/modules/content/level-design/LevelDesignView';
import type { LevelDesignDocument } from '@/types/level-design';
import {
  streamingPlanReducer, initialStreamingPlan, type StreamingPlanStore,
} from '@/lib/level-design/streaming-plan';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/modules/content/level-design/useRunHistory', () => ({
  useRunHistory: () => ({ runs: [], error: null }),
}));

afterEach(cleanup);

beforeAll(() => {
  if (!('ResizeObserver' in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

function Host({ show }: { show: boolean }) {
  const [state, dispatch] = useReducer(streamingPlanReducer, undefined, initialStreamingPlan);
  const store = useMemo<StreamingPlanStore>(() => ({ state, dispatch }), [state]);
  return show ? <StreamingZonePlanner store={store} onGenerate={() => {}} isGenerating={false} /> : null;
}

const emptyCellAt00 = (c: HTMLElement) => c.querySelector('rect[x="1"][y="1"][fill="transparent"]');
const zoneNames = (c: HTMLElement) => Array.from(c.querySelectorAll('svg text')).map((t) => t.textContent);

describe('StreamingZonePlanner under a parent-held reducer', () => {
  it('a painted zone survives unmount + remount with the same store', () => {
    const { container, rerender } = render(<Host show />);
    fireEvent.click(screen.getByRole('button', { name: /Forest/ }));
    const cell = emptyCellAt00(container);
    expect(cell).not.toBeNull();
    fireEvent.click(cell!);
    expect(emptyCellAt00(container)).toBeNull();
    expect(zoneNames(container)).toContain('Forest');

    rerender(<Host show={false} />);
    expect(container.querySelector('svg')).toBeNull();

    rerender(<Host show />);
    expect(emptyCellAt00(container)).toBeNull();
    expect(zoneNames(container)).toContain('Forest');
  });
});

const DOC: LevelDesignDocument = {
  id: 7, name: 'Sunken Crypt', description: '', designNarrative: '', rooms: [], connections: [],
  difficultyArc: [], pacingNotes: '', syncStatus: 'synced', syncReport: [], lastGeneratedAt: null,
  lastCodeHash: null, createdAt: '2026-09-30 10:00:00', updatedAt: '2026-09-30 10:00:00',
};

function installApi() {
  const envelope = (data: unknown) => ({
    ok: true, status: 200,
    json: () => Promise.resolve({ success: true, data }),
    text: () => Promise.resolve(''),
  });
  globalThis.fetch = vi.fn(async (url: string | URL) => {
    if (String(url).startsWith('/api/level-design')) return envelope({ docs: [DOC] });
    return envelope({});
  }) as unknown as typeof fetch;
}

const tab = (name: RegExp) => screen.getAllByRole('button').find((b) => name.test(b.textContent ?? ''))!;

describe('the level-design view keeps the streaming plan across tabs', () => {
  it('Streaming -> Difficulty -> Streaming: the painted zone is still on the grid', async () => {
    installApi();
    const { container } = render(<LevelDesignView />);
    await waitFor(() => screen.getByText('Sunken Crypt'));
    fireEvent.click(screen.getByText('Sunken Crypt'));
    await waitFor(() => screen.getByText(/Flow Editor/));

    fireEvent.click(tab(/^Streaming$/));
    fireEvent.click(screen.getByRole('button', { name: /Forest/ }));
    fireEvent.click(emptyCellAt00(container)!);
    expect(zoneNames(container)).toContain('Forest');

    fireEvent.click(tab(/^Difficulty$/));
    expect(emptyCellAt00(container)).toBeNull();
    expect(zoneNames(container)).not.toContain('Forest');

    fireEvent.click(tab(/^Streaming$/));
    expect(emptyCellAt00(container)).toBeNull();
    expect(zoneNames(container)).toContain('Forest');
    // Renders the whole level-design view; under full-suite load it needs headroom.
  }, 20_000);
});
