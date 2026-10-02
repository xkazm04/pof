import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { createElement } from 'react';
import type { AnimAssetEntry, AnimNotify, AssetManifest } from '@/types/pof-bridge';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(() => {
  cleanup();
  cli.sendPrompt.mockClear();
});

// The tab reads the project ONLY through the refcounted manifest feed.
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

// Never spawn a real CLI: the fix button dispatches through this mock only.
const cli = vi.hoisted(() => ({ sendPrompt: vi.fn() }));
vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: () => ({ sendPrompt: cli.sendPrompt, execute: async () => {}, isRunning: false }),
}));

import {
  deriveComboChains, buildComboLinkFixPrompt, type ComboLink,
} from '@/lib/animation/combo-links';
import { CombosMontagesTabContent } from '@/components/modules/core-engine/sub_animation/AnimTabContent';
import { DEFAULT_COMBAT } from '@/lib/genome/defaults';

/* ── Fixtures ──────────────────────────────────────────────────────────────── */

const n = (name: string, time: number, notifyClass = `AnimNotify_${name}`): AnimNotify => ({ name, time, notifyClass });

function montage(path: string, over: Partial<AnimAssetEntry> = {}): AnimAssetEntry {
  return {
    path, assetType: 'AnimMontage', skeletonPath: '/Game/Chars/SK_Hero',
    crossReferences: [], contentHash: 'h', ...over,
  };
}

/** Case 1's manifest: a numbered three-hit series. */
const CASE1: AnimAssetEntry[] = [
  montage('/Game/Anim/AM_Combo1', { duration: 1.0, notifies: [n('ComboWindow', 0.6), n('HitDetection', 0.3)] }),
  montage('/Game/Anim/AM_Combo2', { duration: 1.2, notifies: [n('ComboWindow', 0.7), n('HitDetection', 0.4)] }),
  montage('/Game/Anim/AM_Combo3', { duration: 1.5, notifies: [n('HitDetection', 0.5)] }),
];

function manifestWith(animAssets: AnimAssetEntry[]): AssetManifest {
  return {
    version: 1, generatedAt: '2026-10-01T00:00:00Z', projectName: 'Did',
    engineVersion: '5.5', assetCount: animAssets.length, checksumSha256: 'c',
    blueprints: [], materials: [], animAssets, dataTables: [], otherAssets: [],
  } as AssetManifest;
}

const linkOf = (assets: AnimAssetEntry[], id: string): ComboLink => {
  const link = deriveComboChains(assets).chains.flatMap((c) => c.links).find((l) => l.id === id);
  if (!link) throw new Error(`no link ${id}`);
  return link;
};

/** A two-montage series whose first member carries the given notifies. */
const pair = (fromNotifies: AnimNotify[], duration = 1.0): AnimAssetEntry[] => [
  montage('/Game/Anim/AM_Swing1', { duration, notifies: fromNotifies }),
  montage('/Game/Anim/AM_Swing2', { duration: 1.0, notifies: [] }),
];

/* ── 1-7: the pure link check ─────────────────────────────────────────────── */

describe('deriveComboChains — the project\'s combo links with a verdict each', () => {
  it('1. a numbered series becomes one chain, ordered numerically, every link with its derived window', () => {
    const read = deriveComboChains(CASE1);
    expect(read.montages).toBe(3);
    expect(read.chains).toHaveLength(1);
    const [chain] = read.chains;
    expect(chain.name).toBe('AM_Combo');
    expect(chain.links.map((l) => `${l.from}->${l.to}`)).toEqual(['AM_Combo1->AM_Combo2', 'AM_Combo2->AM_Combo3']);
    expect(chain.links.map((l) => l.verdict)).toEqual(['chains', 'chains']);
    expect(chain.links.map((l) => l.windowOpenSec)).toEqual([0.6, 0.7]);
    expect(chain.links.map((l) => l.windowCloseSec)).toEqual([1.0, 1.2]);

    const withTen = deriveComboChains([
      montage('/Game/Anim/AM_Combo10', { duration: 1.0 }), ...CASE1,
    ]).chains[0];
    expect(withTen.nodes.map((x) => x.name)).toEqual(['AM_Combo1', 'AM_Combo2', 'AM_Combo3', 'AM_Combo10']);
  });

  it('2. a from-montage with no combo/cancel notify is "no-window", named, never "chains"', () => {
    const link = linkOf(pair([n('HitDetection', 0.3)]), 'AM_Swing1->AM_Swing2');
    expect(link.verdict).toBe('no-window');
    expect(link.reason).toContain('AM_Swing1');
    expect(link.windowOpenSec).toBeUndefined();
  });

  it('3. a window that opens before the hit lands is "opens-before-hit", with both seconds', () => {
    const link = linkOf(pair([n('ComboWindow', 0.2), n('HitDetection', 0.35)]), 'AM_Swing1->AM_Swing2');
    expect(link.verdict).toBe('opens-before-hit');
    expect(link.windowOpenSec).toBe(0.2);
    expect(link.hitSec).toBe(0.35);
  });

  it('4. a window shorter than the declared target is "too-short"; a long-enough one chains', () => {
    expect(DEFAULT_COMBAT.comboWindowMs / 1000).toBe(0.4);
    const short = linkOf(pair([n('ComboWindow', 0.8)]), 'AM_Swing1->AM_Swing2');
    expect(short.verdict).toBe('too-short');
    expect(short.windowSec).toBeCloseTo(0.2, 6);
    expect(short.targetSec).toBe(0.4);
    expect(linkOf(pair([n('ComboWindow', 0.5)]), 'AM_Swing1->AM_Swing2').verdict).toBe('chains');
  });

  it('5. one sectioned montage chains its sections, the k-th combo notify attributed by order', () => {
    const melee = (notifies: AnimNotify[]) => [montage('/Game/Anim/AM_Melee', {
      duration: 1.5, sections: ['Attack1', 'Attack2', 'Attack3'], notifies,
    })];
    const read = deriveComboChains(melee([n('ComboWindow', 0.3), n('ComboWindow', 0.9)]));
    expect(read.chains).toHaveLength(1);
    const links = read.chains[0].links;
    expect(links.map((l) => `${l.from}->${l.to}`)).toEqual(['Attack1->Attack2', 'Attack2->Attack3']);
    expect(links.map((l) => l.windowOpenSec)).toEqual([0.3, 0.9]);
    expect(links.every((l) => l.attribution === 'by-order')).toBe(true);

    const one = deriveComboChains(melee([n('ComboWindow', 0.3)])).chains[0].links;
    expect(one[0].verdict).not.toBe('no-window');
    expect(one[1].verdict).toBe('no-window');
  });

  it('6. a member with no usable duration gets an "unread" outgoing link and is listed as skipped — no invented seconds', () => {
    const read = deriveComboChains([
      montage('/Game/Anim/AM_Combo1', { duration: 1.0, notifies: [n('ComboWindow', 0.6)] }),
      montage('/Game/Anim/AM_Combo2', { notifies: [n('ComboWindow', 0.7)] }),
      montage('/Game/Anim/AM_Combo3', { duration: 1.5 }),
    ]);
    const link = read.chains[0].links.find((l) => l.from === 'AM_Combo2')!;
    expect(link.verdict).toBe('unread');
    expect(link.windowOpenSec).toBeUndefined();
    expect(link.windowCloseSec).toBeUndefined();
    expect(link.windowSec).toBeUndefined();
    expect(read.skipped).toEqual([{ name: 'AM_Combo2', path: '/Game/Anim/AM_Combo2', reason: 'no duration' }]);
  });

  it('7. the fix prompt names exactly the defective montage, the notify and the target; a chaining link has nothing to fix', () => {
    const assets = [
      montage('/Game/Anim/AM_Combo1', { duration: 1.0, notifies: [n('ComboWindow', 0.6)] }),
      montage('/Game/Anim/AM_Combo2', { duration: 1.2, notifies: [n('HitDetection', 0.4)] }),
      montage('/Game/Anim/AM_Combo3', { duration: 1.5 }),
    ];
    const bad = linkOf(assets, 'AM_Combo2->AM_Combo3');
    expect(bad.verdict).toBe('no-window');
    const prompt = buildComboLinkFixPrompt(bad);
    expect(prompt).not.toBeNull();
    expect(prompt).toContain('/Game/Anim/AM_Combo2');
    expect(prompt).toContain('ComboWindow');
    expect(prompt).toContain('0.40s');
    expect(prompt).not.toContain('/Game/Anim/AM_Combo1');
    expect(prompt).not.toContain('/Game/Anim/AM_Combo3');

    expect(buildComboLinkFixPrompt(linkOf(assets, 'AM_Combo1->AM_Combo2'))).toBeNull();
  });

  it('[guard] no manifest reads as no chains, and nothing is invented', () => {
    const empty = { chains: [], montages: 0, skipped: [] };
    expect(deriveComboChains(null)).toEqual(empty);
    expect(deriveComboChains([])).toEqual(empty);
  });
});

/* ── 8: the tab renders the derivation, and fixes only on an explicit click ── */

const renderTab = () => render(createElement(CombosMontagesTabContent, {
  selectedComboNode: null, setSelectedComboNode: () => {},
}));

describe('8. Combos & Montages tab — the chain graph is the project\'s, with a fix per bad link', () => {
  it('bridge mode: the AM_Combo1 → AM_Combo2 edge shows its derived window and verdict, and no TEMPLATE label', () => {
    feed.manifest = manifestWith(CASE1);
    feed.isConnected = true;
    renderTab();
    const edge = screen.getByRole('button', { name: /AM_Combo1 → AM_Combo2/ });
    expect(edge.textContent).toContain('0.60–1.00s');
    expect(within(edge).getByTestId('combo-link-verdict').textContent).toBe('chains');
    expect(document.body.textContent).not.toContain('TEMPLATE');
    expect(cli.sendPrompt).not.toHaveBeenCalled();
  });

  it('no manifest: the fixture chain is labelled TEMPLATE and carries no verdict chips', () => {
    feed.manifest = null;
    feed.isConnected = false;
    renderTab();
    expect(document.body.textContent).toContain('TEMPLATE — example chain, not your project');
    expect(screen.queryAllByTestId('combo-link-verdict')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /Fix in UE/ })).toBeNull();
  });

  it('clicking a no-window edge then "Fix in UE" dispatches one prompt naming that montage', () => {
    feed.manifest = manifestWith([
      montage('/Game/Anim/AM_Combo1', { duration: 1.0, notifies: [n('ComboWindow', 0.6)] }),
      montage('/Game/Anim/AM_Combo2', { duration: 1.2, notifies: [n('HitDetection', 0.4)] }),
      montage('/Game/Anim/AM_Combo3', { duration: 1.5 }),
    ]);
    feed.isConnected = true;
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: /AM_Combo2 → AM_Combo3/ }));
    expect(cli.sendPrompt).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Fix in UE/ }));
    expect(cli.sendPrompt).toHaveBeenCalledTimes(1);
    expect(cli.sendPrompt.mock.calls[0][0]).toContain('/Game/Anim/AM_Combo2');
  });
});
