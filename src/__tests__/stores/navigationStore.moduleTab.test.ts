/**
 * Tab jumps get a target (scan-sweep --challenge app-navigation/A).
 *
 * The location INSIDE a module (which tab is open) used to be component-local
 * state moved from outside by an untargeted window CustomEvent: every mounted
 * Reviewable pane with a matching tab id flipped, and a jump fired before the
 * target pane mounted was dropped. It is now part of the navigation model:
 * `moduleTabs[moduleId]` in navigationStore, written through
 * `navigateToModule(id, { tab })` / `setModuleTab(id, tab)`.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { useNavigationStore } from '@/stores/navigationStore';
import { tabJumpTarget } from '@/components/cli/suggestionIntents';

beforeEach(() => {
  useNavigationStore.setState({ activeCategory: null, activeSubModule: null, moduleTabs: {} });
});

describe('navigateToModule(id, { tab }) — one door, one notification', () => {
  it('sets the module AND its tab in ONE store notification (no half-transition)', () => {
    const seen: { sub: string | null; tab: string | undefined }[] = [];
    const unsub = useNavigationStore.subscribe((s) => {
      seen.push({ sub: s.activeSubModule, tab: s.moduleTabs['arpg-combat'] });
    });
    useNavigationStore.getState().navigateToModule('arpg-combat', { tab: 'roadmap' });
    unsub();
    expect(seen).toEqual([{ sub: 'arpg-combat', tab: 'roadmap' }]);
  });

  it('setModuleTab writes only the named module entry', () => {
    useNavigationStore.getState().setModuleTab('arpg-loot', 'roadmap');
    useNavigationStore.getState().setModuleTab('material-lab', 'editor');
    expect(useNavigationStore.getState().moduleTabs).toEqual({ 'arpg-loot': 'roadmap', 'material-lab': 'editor' });
  });
});

describe('tabJumpTarget — a suggestion without moduleId targets its own session module', () => {
  it('falls back to the session module when the action names none', () => {
    expect(tabJumpTarget({ type: 'navigate', tab: 'roadmap' }, 'arpg-combat'))
      .toEqual({ moduleId: 'arpg-combat', tab: 'roadmap' });
  });

  it('an explicit action moduleId wins over the session module', () => {
    expect(tabJumpTarget({ type: 'navigate', tab: 'overview', moduleId: 'arpg-loot' }, 'arpg-combat'))
      .toEqual({ moduleId: 'arpg-loot', tab: 'overview' });
  });

  it('no module anywhere -> no target (never a broadcast)', () => {
    expect(tabJumpTarget({ type: 'navigate', tab: 'roadmap' }, undefined)).toBeNull();
  });
});

describe('ratchet — no untargeted tab broadcast remains in src/', () => {
  const SRC = join(process.cwd(), 'src');
  const EVENT = ['pof', 'navigate', 'tab'].join('-');

  function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry !== '__tests__') walk(full, out);
      } else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
    }
    return out;
  }

  it(`'${EVENT}' appears in 0 production files`, () => {
    const hits = walk(SRC)
      .filter((f) => readFileSync(f, 'utf8').includes(EVENT))
      .map((f) => f.slice(SRC.length + 1).split('\\').join('/'));
    expect(hits).toEqual([]);
  });
});
