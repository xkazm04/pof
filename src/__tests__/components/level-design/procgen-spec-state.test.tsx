/**
 * The ProcgenSpec IS the wizard's state — one reducer, held by the level-design
 * view, so it survives a tab switch and the UE handoff reads what the designer
 * last set.
 *
 * Before: five component-local useStates reset on every tab switch (the wizard
 * is mounted only while its tab is active), and a publish effect then wrote the
 * DEFAULT spec over the Dungeon (UE) handoff. Configure → Dungeon (UE) → back
 * silently lost everything.
 */
import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import { LevelDesignView } from '@/components/modules/content/level-design/LevelDesignView';
import { ProceduralLevelWizard } from '@/components/modules/content/level-design/ProceduralLevelWizard';
import { ProcgenSpecHandoff } from '@/components/modules/content/level-design/ProcgenSpecHandoff';
import {
  procgenSpecReducer, initialProcgenSpecState,
} from '@/components/modules/content/level-design/ProceduralLevelWizard/specState';
import {
  buildProcgenSpec, previewConfigFromSpec, ueDungeonParamsFromSpec, type ProcgenSpec,
} from '@/lib/level-design/procgen-spec';
import { generatePreview } from '@/lib/level-design/procgen-preview';
import { hashSeed } from '@/lib/level-design/frandom-stream';
import type { LevelDesignDocument } from '@/types/level-design';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/modules/content/level-design/useRunHistory', () => ({
  useRunHistory: () => ({ runs: [], error: null }),
}));

// Record every handoffSpec the real Dungeon (UE) panel is rendered with.
const handoffs = vi.hoisted(() => [] as (ProcgenSpec | null)[]);
vi.mock('@/components/modules/content/level-design/ProcGenDungeonPanel', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/components/modules/content/level-design/ProcGenDungeonPanel')>();
  type Props = Parameters<typeof real.ProcGenDungeonPanel>[0];
  return {
    ...real,
    ProcGenDungeonPanel: (props: Props) => {
      handoffs.push(props.handoffSpec ?? null);
      return <real.ProcGenDungeonPanel {...props} />;
    },
  };
});

afterEach(() => {
  cleanup();
  handoffs.length = 0;
});

beforeAll(() => {
  if (!('ResizeObserver' in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

const DOC: LevelDesignDocument = {
  id: 7,
  name: 'Sunken Crypt',
  description: '',
  designNarrative: '',
  rooms: [],
  connections: [],
  difficultyArc: [],
  pacingNotes: '',
  syncStatus: 'synced',
  syncReport: [],
  lastGeneratedAt: null,
  lastCodeHash: null,
  createdAt: '2026-08-18 10:00:00',
  updatedAt: '2026-08-18 10:00:00',
};

function installApi() {
  const envelope = (data: unknown) => ({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ success: true, data }),
    text: () => Promise.resolve(''),
  });
  globalThis.fetch = vi.fn(async (url: string | URL) => {
    if (String(url).startsWith('/api/level-design')) return envelope({ docs: [DOC] });
    return envelope({});
  }) as unknown as typeof fetch;
}

const tab = (name: RegExp) => screen.getAllByRole('button').find((b) => name.test(b.textContent ?? ''))!;
const radio = (label: RegExp) => screen.getByRole('radio', { name: label });

/** The wizard's defaults BEFORE this change — literal, so a drift in the reducer's initial state shows. */
const PRE_CHANGE_DEFAULT = buildProcgenSpec({
  algorithm: 'bsp',
  levelType: 'dungeon',
  gridWidth: 64, gridHeight: 64, roomCountMin: 8, roomCountMax: 15, corridorWidth: 3,
  seed: '',
  constraints: {
    spawnPoints: true, lootPlacement: true, bossRoom: true, secretRooms: false, safeZones: false,
    ensureConnected: false,
  },
});

describe('procgenSpecReducer', () => {
  it('selectLevelType applies that type\'s default size and keeps the algorithm and resolved seed', () => {
    const initial = initialProcgenSpecState();
    const { spec } = procgenSpecReducer(initial, { type: 'selectLevelType', levelType: 'openworld' });
    expect(spec.levelType).toBe('openworld');
    expect(spec.gridWidth).toBe(256);
    expect(spec.gridHeight).toBe(256);
    expect(spec.roomCountMin).toBe(20);
    expect(spec.roomCountMax).toBe(40);
    expect(spec.corridorWidth).toBe(5);
    expect(spec.algorithm).toBe('bsp');
    expect(spec.seedValue).toBe(hashSeed(spec.seedLabel));
  });

  it('[guard] the initial spec previews the same grid as the pre-change default wizard', () => {
    const initial = initialProcgenSpecState().spec;
    const now = generatePreview(previewConfigFromSpec(initial));
    const before = generatePreview(previewConfigFromSpec(PRE_CHANGE_DEFAULT));
    expect(now.seedValue).toBe(1337);
    expect(now.grid.flat().join()).toBe(before.grid.flat().join());
  });

  it('[guard] ProcgenSpecHandoff given the lifted spec offers exactly its UE projection', () => {
    let state = initialProcgenSpecState();
    state = procgenSpecReducer(state, { type: 'setAlgorithm', algorithm: 'cellular' });
    state = procgenSpecReducer(state, { type: 'setSeed', seed: 'abc' });
    state = procgenSpecReducer(state, { type: 'updateSize', key: 'roomCountMax', value: 30 });
    const params = ueDungeonParamsFromSpec(state.spec);
    render(<ProcgenSpecHandoff spec={state.spec} onAdopt={vi.fn()} />);
    expect(screen.getByText(`Adopt ${params.roomCount} rooms / seed ${params.seed}`)).toBeTruthy();
  });
});

describe('the spec survives the tab round trip and the handoff keeps it', () => {
  it('wizard → Dungeon (UE) → wizard: the handoff and the wizard both hold cellular / abc', async () => {
    installApi();
    render(<LevelDesignView />);
    await waitFor(() => screen.getByText('Sunken Crypt'));
    fireEvent.click(screen.getByText('Sunken Crypt'));
    await waitFor(() => screen.getByText(/Flow Editor/));

    fireEvent.click(tab(/^Procgen$/));
    fireEvent.click(radio(/^Cellular Automata/));
    fireEvent.change(screen.getByPlaceholderText('0xRND...'), { target: { value: 'abc' } });

    fireEvent.click(tab(/^Dungeon \(UE\)$/));
    await waitFor(() => screen.getByTestId('dungeon-handoff-summary'));
    const firstVisit = handoffs.at(-1);
    expect(firstVisit?.algorithm).toBe('cellular');
    expect(firstVisit?.seedLabel).toBe('abc');

    // Back to the wizard: it remounts holding the designer's answers.
    fireEvent.click(tab(/^Procgen$/));
    expect(radio(/^Cellular Automata/).getAttribute('aria-checked')).toBe('true');
    expect((screen.getByPlaceholderText('0xRND...') as HTMLInputElement).value).toBe('abc');

    // …and the remount did not publish the default spec over the handoff.
    handoffs.length = 0;
    fireEvent.click(tab(/^Dungeon \(UE\)$/));
    await waitFor(() => screen.getByTestId('dungeon-handoff-summary'));
    expect(handoffs.length).toBeGreaterThan(0);
    for (const spec of handoffs) {
      expect(spec?.algorithm).toBe('cellular');
      expect(spec?.seedLabel).toBe('abc');
      expect(spec?.seedValue).toBe(hashSeed('abc'));
    }
    expect(screen.getByTestId('dungeon-handoff-summary').textContent ?? '').toContain('abc');
    // Renders the whole level-design view (like level-doc-commits); under full-suite load it needs headroom.
  });
});

describe('the wizard dispatches the spec it shows', () => {
  it('Execute hands onGenerate the spec: a resolved seedValue and the on-screen ensureConnected', () => {
    const onGenerate = vi.fn();
    render(<ProceduralLevelWizard onGenerate={onGenerate} isGenerating={false} />);
    fireEvent.click(radio(/^Cellular Automata/));
    const toggle = screen.getByRole('button', { name: /^Ensure Connected\./ });
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: /Execute .* Routine/i }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
    const sent = onGenerate.mock.calls[0][0] as ProcgenSpec;
    expect(typeof sent.seedValue).toBe('number');
    expect(sent.seedValue).toBe(1337);
    expect(sent.algorithm).toBe('cellular');
    expect(sent.constraints.ensureConnected).toBe(true);
  });
});
