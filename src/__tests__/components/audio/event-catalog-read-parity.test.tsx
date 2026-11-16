import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { AudioEventCatalog } from '@/components/modules/content/audio/AudioEventCatalog';
import { BudgetStressPanel } from '@/components/modules/content/audio/AudioView/BudgetStressPanel';
import { useAudioEventCatalogStore } from '@/components/modules/content/audio/audioEventCatalogStore';
import type { AudioEvent } from '@/components/modules/content/audio/AudioEventCatalog/types';

/** The stress panel must stress exactly the catalog the editor shows, for every store state. */

const SCENE = 'scene-parity';
const mk = (id: string, name: string): AudioEvent => ({
  id, name, category: 'combat', trigger: `On${name.replace(/\s/g, '')}`, priority: 'normal',
  spatial: '3d', concurrency: 1, cooldownMs: 0, tags: [],
});
const OWN = [mk('o1', 'Own One'), mk('o2', 'Own Two')];
const LEGACY = [mk('l1', 'Legacy One')];

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => ({ success: false, error: 'offline' }) })));
});
afterEach(() => { vi.unstubAllGlobals(); cleanup(); });

const flush = () => act(async () => { for (let i = 0; i < 4; i++) await Promise.resolve(); });

const editorNames = () => screen.queryAllByRole('button', { name: /^Delete event / })
  .map((b) => (b.getAttribute('aria-label') ?? '').replace('Delete event ', '')).sort();
const panelNames = () => Array.from(document.querySelectorAll('[data-testid^="budget-row-"]'))
  .map((r) => r.querySelector('td span')?.textContent ?? '').sort();

const STATES: [string, { byScene: Record<string, AudioEvent[]>; legacyEvents: AudioEvent[] | null }, string[] | null][] = [
  ['own slot', { byScene: { [SCENE]: OWN }, legacyEvents: LEGACY }, ['Own One', 'Own Two']],
  ['legacy only', { byScene: {}, legacyEvents: LEGACY }, ['Legacy One']],
  ['empty (defaults)', { byScene: {}, legacyEvents: null }, null],
];

describe('scene event catalog read rule', () => {
  for (const [label, state, expected] of STATES) {
    it(`editor rows equal stress-panel rows: ${label}`, async () => {
      useAudioEventCatalogStore.setState(state);
      render(<AudioEventCatalog sceneId={SCENE} onGenerate={vi.fn()} isGenerating={false} />);
      await flush();
      const fromEditor = editorNames();
      cleanup();
      // The editor writes its catalog through on mount; reset so the panel reads the same starting state.
      useAudioEventCatalogStore.setState(state);
      render(<BudgetStressPanel sceneId={SCENE} voiceLimit={16} />);
      await flush();
      const fromPanel = panelNames();
      expect(fromEditor.length).toBeGreaterThan(0);
      expect(fromPanel).toEqual(fromEditor);
      if (expected) expect(fromEditor).toEqual([...expected].sort());
    });
  }
});
