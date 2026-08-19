import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { AnimAssetEntry, AssetManifest } from '@/types/pof-bridge';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const bridge = vi.hoisted(() => ({
  manifest: null as AssetManifest | null,
  isConnected: false,
}));
vi.mock('@/hooks/useManifest', () => ({
  useManifest: () => ({
    manifest: bridge.manifest,
    isConnected: bridge.isConnected,
    isLoading: false,
    error: null,
    refresh: async () => {},
  }),
}));

import { ResponsivenessAnalyzer } from '@/components/modules/core-engine/sub_animation/state-graph/ResponsivenessAnalyzer';
import {
  computeResponsiveness, timingsFromManifest, stateFromMontageName,
  RESPONSIVENESS_GRADE_THRESHOLDS, getGrade,
  type DerivedMontageTiming,
} from '@/components/modules/core-engine/sub_animation/_shared/data';

const MS = /\d+\s*ms\b/;
const GRADE_WORDS = RESPONSIVENESS_GRADE_THRESHOLDS.map((t) => t.label);

function montage(over: Partial<AnimAssetEntry> & { path: string }): AnimAssetEntry {
  return {
    assetType: 'AnimMontage',
    skeletonPath: '/Game/Chars/SK_Hero',
    crossReferences: [],
    contentHash: 'h',
    ...over,
  } as AnimAssetEntry;
}

function manifestWith(animAssets: AnimAssetEntry[]): AssetManifest {
  return {
    version: 1, generatedAt: '2026-08-19T00:00:00Z', projectName: 'PoF',
    engineVersion: '5.8', assetCount: animAssets.length, checksumSha256: 'c',
    blueprints: [], materials: [], animAssets, dataTables: [], otherAssets: [],
  } as AssetManifest;
}

function setBridge(manifest: AssetManifest | null, isConnected: boolean) {
  bridge.manifest = manifest;
  bridge.isConnected = isConnected;
}

/* ── The pure engine ───────────────────────────────────────────────────────── */

describe('computeResponsiveness is a pure function of supplied timings', () => {
  it('returns nothing at all when given no timings — it invents no idle-latency row', () => {
    expect(computeResponsiveness([])).toEqual([]);
  });

  it('derives best/worst from the supplied cancel window, not from a literal table', () => {
    const timings: DerivedMontageTiming[] = [{
      name: 'AM_Combo1', state: 'Attacking', durationSec: 1.5,
      cancelWindowStartSec: 0.9, cancelWindowEndSec: 1.5,
      cancelNotify: 'ComboWindow', sourcePath: '/Game/Anims/AM_Combo1',
    }];
    const rows = computeResponsiveness(timings);

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.sourcePath === '/Game/Anims/AM_Combo1')).toBe(true);

    const cancelRow = rows.find((r) => r.from === 'Attacking' && r.to === 'Dodging');
    expect(cancelRow).toBeDefined();
    expect(cancelRow!.bestCase).toBeCloseTo(0.9, 6);
    expect(cancelRow!.worstCase).toBeCloseTo(1.5, 6);
    expect(cancelRow!.derivedFrom).toContain('ComboWindow');

    const playoutRow = rows.find((r) => r.from === 'Attacking' && r.to === 'Locomotion');
    expect(playoutRow!.bestCase).toBeCloseTo(1.5, 6);
    expect(playoutRow!.worstCase).toBeCloseTo(1.5, 6);
  });

  it('scales with the supplied numbers (doubling the duration doubles the latency)', () => {
    const base: DerivedMontageTiming = {
      name: 'AM_X', state: 'Attacking', durationSec: 1, sourcePath: '/Game/AM_X',
    };
    const a = computeResponsiveness([base]);
    const b = computeResponsiveness([{ ...base, durationSec: 2 }]);
    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i++) expect(b[i].avgCase).toBeCloseTo(a[i].avgCase * 2, 6);
  });

  it('keeps getGrade as the unchanged rubric', () => {
    expect(getGrade(0.04).label).toBe('Instant');
    expect(getGrade(0.383).label).toBe('Sluggish');
    expect(getGrade(10).label).toBe('Unresponsive');
  });
});

/* ── The manifest adapter ──────────────────────────────────────────────────── */

describe('timingsFromManifest reads only what the manifest carries', () => {
  it('reports montages it could not use instead of guessing their numbers', () => {
    const res = timingsFromManifest([
      montage({ path: '/Game/A/AM_Combo1', duration: 1.5, notifies: [{ name: 'ComboWindow', time: 0.9, notifyClass: 'AnimNotify' }] }),
      montage({ path: '/Game/A/AM_NoDuration' }),
      montage({ path: '/Game/A/AM_Whatever', duration: 2 }),
      montage({ path: '/Game/A/ABP_Hero', assetType: 'AnimBlueprint', duration: 1 }),
    ]);

    expect(res.montages).toBe(3);
    expect(res.timings.map((t) => t.name)).toEqual(['AM_Combo1']);
    expect(res.withoutDuration).toEqual(['AM_NoDuration']);
    expect(res.unclassified).toEqual(['AM_Whatever']);
    expect(res.timings[0].cancelWindowStartSec).toBeCloseTo(0.9, 6);
    expect(res.timings[0].cancelNotify).toBe('ComboWindow');
  });

  it('yields nothing for a null/absent manifest', () => {
    expect(timingsFromManifest(null).timings).toEqual([]);
    expect(timingsFromManifest(undefined).timings).toEqual([]);
  });

  it('classifies by name and refuses to default an unknown name to a state', () => {
    expect(stateFromMontageName('AM_DodgeRoll')).toBe('Dodging');
    expect(stateFromMontageName('AM_HeavyAttack')).toBe('Attacking');
    expect(stateFromMontageName('AM_DeathFwd')).toBe('Death');
    expect(stateFromMontageName('AM_Sprint')).toBe('Locomotion');
    expect(stateFromMontageName('AM_Xyzzy')).toBeNull();
  });
});

/* ── The panel ─────────────────────────────────────────────────────────────── */

describe('ResponsivenessAnalyzer renders nothing it has not read', () => {
  it('with no manifest: zero ms values, zero grade badges, and a stated reason', () => {
    setBridge(null, false);
    const { container } = render(<ResponsivenessAnalyzer />);
    const text = container.textContent ?? '';

    expect(text).not.toMatch(MS);
    expect(container.querySelectorAll('[data-testid="responsiveness-grade"]').length).toBe(0);
    expect(container.querySelectorAll('[data-testid="responsiveness-row"]').length).toBe(0);
    for (const word of GRADE_WORDS) expect(text).not.toContain(word);

    expect(container.querySelector('[data-testid="responsiveness-source"]')?.getAttribute('data-measured'))
      .toBe('false');
    expect(text.toUpperCase()).toContain('NOT MEASURED');
  });

  it('connected but with no usable montage still shows no numbers', () => {
    setBridge(manifestWith([montage({ path: '/Game/A/AM_Whatever', duration: 2 })]), true);
    const { container } = render(<ResponsivenessAnalyzer />);

    expect(container.textContent ?? '').not.toMatch(MS);
    expect(container.querySelectorAll('[data-testid="responsiveness-row"]').length).toBe(0);
    expect(container.querySelector('[data-testid="responsiveness-source"]')?.getAttribute('data-measured'))
      .toBe('false');
  });

  it('with one manifest montage the table shows exactly that montage and nothing else', () => {
    setBridge(manifestWith([
      montage({
        path: '/Game/Anims/AM_Combo1', duration: 1.5,
        notifies: [{ name: 'ComboWindow', time: 0.9, notifyClass: 'AnimNotify' }],
      }),
    ]), true);
    const { container } = render(<ResponsivenessAnalyzer />);
    const rows = Array.from(container.querySelectorAll<HTMLElement>('[data-testid="responsiveness-row"]'));

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.textContent).toContain('AM_Combo1');

    // No fixture montage leaks in.
    const text = container.textContent ?? '';
    for (const ghost of ['AM_HeavyAttack', 'AM_ForcePush', 'AM_SaberThrow', 'AM_ForceLightning', 'AM_HitReact']) {
      expect(text).not.toContain(ghost);
    }

    // The derived numbers are the manifest's: 1.5s playout, 0.9s cancel entry.
    const avgs = rows.map((r) => r.getAttribute('data-avg-ms')).sort();
    expect(avgs).toEqual(['1200', '1500', '1500']);

    expect(container.querySelector('[data-testid="responsiveness-source"]')?.getAttribute('data-measured'))
      .toBe('true');
    expect(text.toLowerCase()).toContain('bridge manifest');
  });

  it('states the real source in the header, never UARPGAnimInstance transition booleans', () => {
    setBridge(null, false);
    const { container } = render(<ResponsivenessAnalyzer />);
    expect(container.textContent).not.toContain('UARPGAnimInstance');
  });
});
