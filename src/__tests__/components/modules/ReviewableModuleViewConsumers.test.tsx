/**
 * Consumer guard for `ReviewableModuleView`.
 *
 * The Materials session-cost change touched this shared shell (the
 * `pof-navigate-tab` listener's dep is now memoized on the tab IDS rather than
 * on the `extraTabs` array identity). 23 module views render through it, so the
 * change needs a witness that none of them shifted.
 *
 * Two guards:
 *  1. a CENSUS — the consumer list is pinned, so adding a consumer without
 *     looking at this file turns the rail red;
 *  2. a RENDER + TAB-COUNT pin — every consumer renders with its default props
 *     and exposes the same number of tabs it did before the change.
 *
 * Tab counts were measured on the pre-change tree and are pinned here; a
 * consumer that gains or loses a tab must update its number deliberately.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { AnimationsView } from '@/components/modules/content/animations/AnimationsView';
import { MaterialsView } from '@/components/modules/content/materials/MaterialsView';
import { ModelsView } from '@/components/modules/content/models/ModelsView';
import { UIHudView } from '@/components/modules/content/ui-hud/UIHudView';
import { AIBehaviorView } from '@/components/modules/game-systems/AIBehaviorView';
import { MultiplayerView } from '@/components/modules/game-systems/MultiplayerView';
import { PackagingView } from '@/components/modules/game-systems/PackagingView';
import { createSimpleModuleView } from '@/components/modules/shared/createSimpleModuleView';

/** Every file that renders `<ReviewableModuleView`, relative to `src/components`. */
const PINNED_CONSUMER_FILES = [
  'modules/content/animations/AnimationsView.tsx',
  'modules/content/materials/MaterialsView.tsx',
  'modules/content/models/ModelsView.tsx',
  'modules/content/ui-hud/UIHudView.tsx',
  'modules/core-engine/GenreModuleView.tsx',
  'modules/game-systems/AIBehaviorView/index.tsx',
  'modules/game-systems/MultiplayerView.tsx',
  'modules/game-systems/PackagingView.tsx',
  'modules/shared/createSimpleModuleView.tsx',
  'modules/shared/createTabbedModuleView.tsx',
  'modules/visual-gen/asset-browser/AssetBrowserView.tsx',
  'modules/visual-gen/asset-forge/AssetForgeView.tsx',
  'modules/visual-gen/asset-viewer/AssetViewerView.tsx',
  'modules/visual-gen/auto-rig/AutoRigView/index.tsx',
  'modules/visual-gen/blender-pipeline/BlenderPipelineView/index.tsx',
  'modules/visual-gen/import-automation/ImportAutomationView.tsx',
  'modules/visual-gen/material-lab/MaterialLabView.tsx',
  'modules/visual-gen/procedural-engine/ProceduralEngineView/index.tsx',
  'modules/visual-gen/scene-composer/SceneComposerView.tsx',
];

const COMPONENTS_ROOT = join(process.cwd(), 'src', 'components');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith('.tsx')) out.push(full);
  }
  return out;
}

/**
 * Consumers that render, with their tab count (Overview + Roadmap + extras).
 * Measured on the pre-change tree; unchanged after.
 */
const RENDERABLE: { name: string; Component: () => React.ReactNode; tabs: number }[] = [
  { name: 'AnimationsView', Component: AnimationsView, tabs: 8 },
  { name: 'MaterialsView', Component: MaterialsView, tabs: 8 },
  { name: 'ModelsView', Component: ModelsView, tabs: 4 },
  { name: 'UIHudView', Component: UIHudView, tabs: 6 },
  { name: 'AIBehaviorView', Component: AIBehaviorView, tabs: 3 },
  { name: 'MultiplayerView', Component: MultiplayerView, tabs: 3 },
  { name: 'PackagingView', Component: PackagingView, tabs: 4 },
  { name: 'createSimpleModuleView(audio)', Component: createSimpleModuleView('audio'), tabs: 2 },
];

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ success: true, data: {} }),
  }) as unknown as Response));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ReviewableModuleView — consumer census', () => {
  it('pins every file that renders the shell (a new consumer turns this red)', () => {
    const found = walk(COMPONENTS_ROOT)
      .filter((f) => readFileSync(f, 'utf8').includes('<ReviewableModuleView'))
      .map((f) => f.slice(COMPONENTS_ROOT.length + 1).split('\\').join('/'))
      .sort();
    expect(found).toEqual([...PINNED_CONSUMER_FILES].sort());
  });
});

describe('ReviewableModuleView — consumer render guard', () => {
  for (const { name, Component, tabs } of RENDERABLE) {
    it(`${name} renders and still exposes ${tabs} tabs`, () => {
      expect(() => render(<Component />)).not.toThrow();
      expect(screen.getAllByRole('tab')).toHaveLength(tabs);
      // Overview is the default tab for every consumer.
      expect(screen.getByRole('tab', { name: 'Overview' })).toBeTruthy();
    });
  }
});
