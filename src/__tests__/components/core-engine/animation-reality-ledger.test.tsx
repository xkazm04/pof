import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const projectState = vi.hoisted(() => ({ projectPath: '' }));
vi.mock('@/stores/projectStore', () => ({
  useProjectStore: (sel: (s: { projectPath: string }) => unknown) => sel(projectState),
}));

import { AnimationRealityLedger } from '@/components/modules/core-engine/sub_animation/budget/AnimationRealityLedger';
import { BudgetTracker } from '@/components/modules/core-engine/sub_animation/budget/BudgetCoveragePanels';
import * as animData from '@/components/modules/core-engine/sub_animation/_shared/data';

const LEDGER = {
  projectPath: 'C:/proj',
  summary: {
    sourceFiles: 42, contentAssets: 310, referenced: 18, existing: 15,
    missing: 3, emptyShells: 2, orphans: 4, runtimeFallbacks: 1, status: 'red' as const,
  },
  missing: [
    { path: '/Game/Anims/AM_SaberSlash', kind: 'montage', referencedBy: ['PoFCharacter.cpp'] },
    { path: '/Game/Anims/AM_Dodge', kind: 'montage', referencedBy: ['PoFCharacter.cpp'] },
    { path: '/Game/Chars/SKM_Hero', kind: 'skeletalMesh', referencedBy: ['PoFCharacter.cpp'] },
  ],
  emptyShells: [
    { path: '/Game/Anims/AM_HitReact', kind: 'montage', sizeBytes: 2048, referencedBy: ['PoFCombat.cpp'] },
    { path: '/Game/Anims/AM_Death', kind: 'montage', sizeBytes: 3072, referencedBy: ['PoFCombat.cpp'] },
  ],
  orphans: [
    { path: '/Game/Anims/AM_Unused1', kind: 'montage', sizeBytes: 12000 },
    { path: '/Game/Anims/AM_Unused2', kind: 'montage', sizeBytes: 13000 },
    { path: '/Game/Anims/AS_Unused3', kind: 'sequence', sizeBytes: 14000 },
    { path: '/Game/Anims/AS_Unused4', kind: 'sequence', sizeBytes: 15000 },
  ],
  runtimeFallbacks: [
    { signal: 'No playable montage for Attack', source: 'PoF.log' },
  ],
};

function mockFetchOk() {
  const spy = vi.fn().mockResolvedValue({
    json: async () => ({ success: true, data: LEDGER }),
  });
  vi.stubGlobal('fetch', spy);
  return spy;
}

const clickRun = async (container: HTMLElement) => {
  const btn = container.querySelector<HTMLButtonElement>('[data-testid="anim-ledger-run"]');
  expect(btn).not.toBeNull();
  await act(async () => { btn!.click(); });
};

describe('Animation Reality Ledger panel', () => {
  beforeEach(() => { projectState.projectPath = ''; });

  it('with no projectPath says it has NOT READ a project and offers no findings', () => {
    const { container } = render(<AnimationRealityLedger />);
    const text = container.textContent ?? '';

    // The honesty requirement: an empty panel must not read as "all clear".
    expect(container.querySelector('[data-testid="anim-ledger-state"]')?.getAttribute('data-state'))
      .toBe('no-project');
    expect(text.toUpperCase()).toContain('NOT READ');
    expect(text).not.toMatch(/all clear|no issues|clean bill/i);
    // No finding rows at all.
    expect(container.querySelectorAll('[data-testid="anim-ledger-finding"]').length).toBe(0);
    // The action is unavailable, not silently a no-op.
    const btn = container.querySelector<HTMLButtonElement>('[data-testid="anim-ledger-run"]');
    expect(btn?.disabled).toBe(true);
  });

  it('does not read the project on mount — only on the explicit action', async () => {
    projectState.projectPath = 'C:/proj';
    const spy = mockFetchOk();
    const { container } = render(<AnimationRealityLedger />);

    // Mounting must never walk Content/ (the route is a filesystem walk).
    await act(async () => { await Promise.resolve(); });
    expect(spy).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="anim-ledger-state"]')?.getAttribute('data-state'))
      .toBe('not-read');

    await clickRun(container);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0][0])).toContain('/api/animation-ledger?projectPath=');
  });

  it('renders missing / emptyShells / orphans / runtimeFallbacks and the summary status', async () => {
    projectState.projectPath = 'C:/proj';
    mockFetchOk();
    const { container } = render(<AnimationRealityLedger />);
    await clickRun(container);

    const text = container.textContent ?? '';
    expect(container.querySelector('[data-testid="anim-ledger-state"]')?.getAttribute('data-state'))
      .toBe('read');
    expect(container.querySelector('[data-testid="anim-ledger-summary"]')?.getAttribute('data-status'))
      .toBe('red');

    // Every ledger bucket reaches the screen.
    for (const p of ['AM_SaberSlash', 'AM_HitReact', 'AM_Unused1', 'No playable montage for Attack']) {
      expect(text).toContain(p);
    }
    // One row per finding across the four buckets (3 + 2 + 4 + 1).
    expect(container.querySelectorAll('[data-testid="anim-ledger-finding"]').length).toBe(10);

    // Counts come from the ledger summary, not from the row arrays being re-counted.
    const counts = Array.from(container.querySelectorAll('[data-testid^="anim-ledger-count-"]'))
      .map((el) => [el.getAttribute('data-testid'), el.getAttribute('data-count')]);
    expect(Object.fromEntries(counts)).toMatchObject({
      'anim-ledger-count-missing': '3',
      'anim-ledger-count-emptyShells': '2',
      'anim-ledger-count-orphans': '4',
      'anim-ledger-count-runtimeFallbacks': '1',
    });
  });

  it('reports the reason when the read fails instead of falling back to an empty panel', async () => {
    projectState.projectPath = 'C:/proj';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ success: false, error: 'projectPath has no Content/ or Source/ — not a UE project root' }),
    }));
    const { container } = render(<AnimationRealityLedger />);
    await clickRun(container);

    expect(container.querySelector('[data-testid="anim-ledger-state"]')?.getAttribute('data-state'))
      .toBe('error');
    expect(container.textContent).toContain('not a UE project root');
    expect(container.querySelectorAll('[data-testid="anim-ledger-finding"]').length).toBe(0);
  });
});

describe('Animation Budget Tracker provenance', () => {
  it('renders no gauge current value — it announces the usage is unmeasured', () => {
    const { container } = render(<BudgetTracker />);
    const text = container.textContent ?? '';

    expect(container.querySelector('[data-testid="anim-budget-measured"]')?.getAttribute('data-measured'))
      .toBe('false');
    expect(text.toUpperCase()).toContain('NOT MEASURED');

    // The four literal `current` values that used to be presented as readings.
    for (const literal of ['2/4', '3/8', '1/4', '65/120']) {
      expect(text.replace(/\s+/g, '')).not.toContain(literal);
    }
    // No percentage ring: a percentage requires a current reading.
    expect(container.querySelectorAll('[data-testid="anim-budget-usage"]').length).toBe(0);
  });

  it('the budget limit model carries no `current` field at all', () => {
    const limits = (animData as Record<string, unknown>).BUDGET_LIMITS as Array<Record<string, unknown>>;
    expect(Array.isArray(limits)).toBe(true);
    expect(limits.length).toBeGreaterThan(0);
    for (const l of limits) {
      expect(Object.keys(l).sort()).toEqual(['label', 'target', 'unit']);
      expect('current' in l).toBe(false);
    }
    expect((animData as Record<string, unknown>).BUDGET_GAUGES).toBeUndefined();
  });
});

/* ── Guard: the fabricated notify-coverage fixtures reach no rendered surface ── */

const ANIM_DIR = path.join(process.cwd(), 'src', 'components', 'modules', 'core-engine', 'sub_animation');

function walkTs(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) walkTs(fp, acc);
    else if (/\.tsx?$/.test(e.name)) acc.push(fp);
  }
  return acc;
}

describe('guard: fabricated notify-coverage fixtures are unreachable', () => {
  const FABRICATED = ['NOTIFY_ISSUES', 'MONTAGE_COVERAGES'];

  it('no file in sub_animation/ references them — including _shared/data.ts itself', () => {
    const offenders: string[] = [];
    for (const file of walkTs(ANIM_DIR)) {
      const src = fs.readFileSync(file, 'utf8');
      for (const name of FABRICATED) {
        if (new RegExp(`\\b${name}\\b`).test(src)) {
          offenders.push(`${path.relative(process.cwd(), file)} → ${name}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('_shared/data.ts exports neither of them', () => {
    const mod = animData as Record<string, unknown>;
    for (const name of FABRICATED) expect(mod[name]).toBeUndefined();
  });

  it('the analyzer no longer reads the fixture montage table', () => {
    const src = fs.readFileSync(
      path.join(ANIM_DIR, 'state-graph', 'ResponsivenessAnalyzer.tsx'), 'utf8',
    );
    expect(src).not.toMatch(/\bMONTAGE_TIMINGS\b/);
    expect(src).not.toMatch(/\bRESPONSIVENESS_RESULTS\b/);
  });
});
