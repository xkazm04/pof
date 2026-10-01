import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { ReactElement } from 'react';
import fs from 'node:fs';
import path from 'node:path';
import type { AnimAssetEntry, AssetManifest } from '@/types/pof-bridge';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

// Mock the refcounted, suspend-aware feed itself — the tiles read nothing else.
const feed = vi.hoisted(() => ({
  manifest: null as AssetManifest | null,
  isConnected: false,
}));
vi.mock('@/hooks/useManifest', () => ({
  useManifest: () => ({
    manifest: feed.manifest, isConnected: feed.isConnected,
    isLoading: false, error: null, refresh: async () => {},
  }),
}));

import { readAnimMetrics, ANIM_METRIC_IDS } from '@/lib/animation/anim-metric-readings';
import { renderAnimMetric } from '@/components/modules/core-engine/sub_animation/metrics';
import * as animData from '@/components/modules/core-engine/sub_animation/_shared/data';

function asset(over: Partial<AnimAssetEntry> & Pick<AnimAssetEntry, 'path' | 'assetType'>): AnimAssetEntry {
  return { skeletonPath: '/Game/Chars/SK_Hero', crossReferences: [], contentHash: 'h', ...over };
}

function manifest(animAssets: AnimAssetEntry[]): AssetManifest {
  return {
    version: 1, generatedAt: '2026-10-01T00:00:00Z', projectName: 'Did', engineVersion: '5.5',
    assetCount: animAssets.length, checksumSha256: 'x', blueprints: [], materials: [],
    animAssets, dataTables: [], otherAssets: [],
  };
}

const CASE2 = manifest([
  asset({ path: '/Game/Anim/AM_Combo1', assetType: 'AnimMontage', duration: 1 }),
  asset({ path: '/Game/Anim/AM_Combo2', assetType: 'AnimMontage', duration: 1.2 }),
  asset({ path: '/Game/Anim/AM_Dodge', assetType: 'AnimMontage', duration: 0.5 }),
  asset({ path: '/Game/Anim/AS_Idle', assetType: 'AnimSequence', duration: 2 }),
  asset({ path: '/Game/Anim/BS_Locomotion', assetType: 'BlendSpace' }),
]);

const FULL = manifest([
  asset({
    path: '/Game/Anim/AM_Melee', assetType: 'AnimMontage', duration: 1.5,
    sections: ['Attack1', 'Attack2', 'Attack3'],
    notifies: [
      { name: 'HitDetection', time: 0.3, notifyClass: 'AnimNotify_Hit' },
      { name: 'ComboWindow', time: 0.6, notifyClass: 'AnimNotify_Combo' },
    ],
  }),
  asset({
    path: '/Game/Anim/AM_Heavy', assetType: 'AnimMontage', duration: 1.2,
    notifies: [{ name: 'HitDetection', time: 0.4, notifyClass: 'AnimNotify_Hit' }],
  }),
  asset({
    path: '/Game/Anim/ABP_Hero', assetType: 'AnimBlueprint',
    stateMachines: [{
      name: 'Locomotion', states: ['Idle', 'Run', 'Attack'],
      transitions: [
        { from: 'Idle', to: 'Run', condition: 'Speed > 0' },
        { from: 'Run', to: 'Attack', condition: 'bAttacking' },
      ],
    }],
  }),
]);

describe('readAnimMetrics — the Feature Map tiles are a projection of the bridge manifest', () => {
  it('case 1: not connected -> 9 tiles unread "not connected", skeleton is the declared bone target', () => {
    const r = readAnimMetrics(null, false);
    for (const id of ANIM_METRIC_IDS) {
      if (id === 'skeleton') continue;
      expect(r[id].kind, id).toBe('unread');
      if (r[id].kind === 'unread') expect(r[id].reason, id).toMatch(/not connected/);
    }
    expect(r.skeleton).toMatchObject({ kind: 'target', value: '≤120' });
  });

  it('case 2: 3 AnimMontage + 1 AnimSequence + 1 BlendSpace -> 3 montages, 5 assets, size still unread', () => {
    const r = readAnimMetrics(CASE2, true);
    expect(r.montages).toMatchObject({ kind: 'measured', value: '3', source: 'bridge', projectName: 'Did' });
    expect(r.assets).toMatchObject({ kind: 'measured', value: '5' });
    if (r.assets.kind === 'measured') expect(r.assets.detail).toContain('size unread');
  });

  it('case 3: notifies are counted from the montages, classes are distinct notifyClass', () => {
    const r = readAnimMetrics(FULL, true);
    expect(r.scrubber).toMatchObject({ kind: 'measured', value: '3', detail: '2 classes' });
  });

  it('case 4: states / transitions sum the AnimBlueprint state machines; none -> unread "no state machine"', () => {
    const r = readAnimMetrics(FULL, true);
    expect(r.states).toMatchObject({ kind: 'measured', value: '3' });
    expect(r.transitions).toMatchObject({ kind: 'measured', value: '2' });
    const none = readAnimMetrics(CASE2, true);
    for (const id of ['states', 'transitions'] as const) {
      expect(none[id].kind, id).toBe('unread');
      if (none[id].kind === 'unread') expect(none[id].reason, id).toMatch(/no state machine/);
    }
  });

  it('case 5: chain = montages with >= 2 sections + max depth; none sectioned -> measured 0', () => {
    const r = readAnimMetrics(FULL, true);
    expect(r.chain).toMatchObject({ kind: 'measured', value: '1', detail: 'depth 3' });
    expect(readAnimMetrics(CASE2, true).chain).toMatchObject({ kind: 'measured', value: '0' });
  });

  it('case 6: heatmap / trajectories / playrate stay unread on a full manifest, naming what it lacks', () => {
    const r = readAnimMetrics(FULL, true);
    const lacks = { heatmap: /transition frequency/, trajectories: /root motion/, playrate: /play rate/ } as const;
    for (const [id, re] of Object.entries(lacks) as [keyof typeof lacks, RegExp][]) {
      expect(r[id].kind, id).toBe('unread');
      if (r[id].kind === 'unread') expect(r[id].reason, id).toMatch(re);
    }
  });

  it('case 7: the rendered tiles read the mocked feed; unknown id -> null; no tile file holds a fixture', () => {
    feed.manifest = CASE2;
    feed.isConnected = true;
    try {
      const montages = render(renderAnimMetric('montages') as ReactElement);
      expect(montages.container.textContent).toContain('3');
      cleanup();
      const states = render(renderAnimMetric('states') as ReactElement);
      expect(states.container.textContent).toContain('unread');
    } finally {
      feed.manifest = null;
      feed.isConnected = false;
    }
    expect(renderAnimMetric('not-a-section')).toBeNull();

    const dir = path.join(process.cwd(), 'src/components/modules/core-engine/sub_animation/metrics');
    const FIXTURES = ['STATE_NODES', 'STATE_GROUPS', 'SCRUBBER_LANES', 'COMBO_DEFS', 'ROOT_MOTION_PATHS', 'HEATMAP_CELLS', 'MONTAGE_TIMINGS'];
    const offenders: string[] = [];
    for (const f of fs.readdirSync(dir)) {
      const src = fs.readFileSync(path.join(dir, f), 'utf8');
      for (const name of FIXTURES) if (new RegExp(`\\b${name}\\b`).test(src)) offenders.push(`${f} → ${name}`);
    }
    expect(offenders).toEqual([]);
  });

  it('case 8: _shared/data exports no MONTAGE_TIMINGS fixture', () => {
    expect((animData as Record<string, unknown>).MONTAGE_TIMINGS).toBeUndefined();
  });
});
