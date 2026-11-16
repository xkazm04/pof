import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });
import { ArchetypeStep } from '@/components/layout-lab/steps/ArchetypeStep';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';
import { LAB_THEMES } from '@/components/layout-lab/theme';
import { selected } from '@/lib/catalog/acceptance/dataCheckers';
import { appendBatch, emptyHistory, historyData, makeBatch } from '@/components/layout-lab/steps/shared/genHistory';
import type { StepSpec } from '@/lib/catalog/stepSpec';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';
import { AssetTarget } from '@/components/layout-lab/steps/shared/assetHonesty';

/**
 * The gallery "Selected" panel's `✓ asset target` line must name the target the STORED artifact
 * records, not the one the spec's template produce would write. A gallery row written by the MCP
 * submit path or a headless drain can hold a selection and no `ueAssets`; the panel used to read
 * `spec.produce(entity).ueAssets[0]` and tick a target the artifact never recorded.
 */

const t = LAB_THEMES[0];
const STEP = 'Icon 2D Art';
const entity: LabEntity = { id: 'g-target', name: 'Fireball', lifecycle: 'planned', data: {} };
const spec: StepSpec = {
  archetype: 'gallery', label: STEP,
  view: { kind: 'gallery', field: 'selected', candidates: 2 },
  produce: (e) => ({ data: { selected: 0 }, ueAssets: [`/Game/UI/Icons/T_${e.name}_Icon`] }),
  accept: selected('selected', 'An icon candidate is selected'),
};

function seed(ueAssets: string[]) {
  const batch = makeBatch({ seq: 0, at: '2026-01-01T00:00:00.000Z', direction: 'd', prompt: 'p',
    candidates: [{ swatch: 'x', payload: { selected: 0 } }, { swatch: 'y', payload: { selected: 1 } }] });
  useLabPipelineStore.setState({
    byEntity: { [entity.id]: { [STEP]: { done: true, data: historyData(appendBatch(emptyHistory(), batch)), ueAssets, at: '2026-01-01T00:00:00.000Z' } } },
  });
}

beforeEach(() => { vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: true, data: [] })))); localStorage.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); useLabPipelineStore.setState({ byEntity: {} }); });

describe('ArchetypeStep gallery — asset target comes from the stored artifact', () => {
  it('a selection with no recorded ueAssets claims no target', () => {
    seed([]);
    render(<ArchetypeStep t={t} entity={entity} step={STEP} spec={spec} />);
    const panel = screen.getByTestId('gallery-asset-target');
    expect(panel.textContent).not.toContain('✓');
    expect(panel.textContent).not.toContain('T_Fireball_Icon');
    expect(panel.textContent).toContain('records no asset target');
  });

  it('a recorded target is shown as the stored one', () => {
    seed(['/Game/UI/Icons/T_Stored_Icon']);
    render(<ArchetypeStep t={t} entity={entity} step={STEP} spec={spec} />);
    const panel = screen.getByTestId('gallery-asset-target');
    expect(panel.textContent).toContain('asset target: /Game/UI/Icons/T_Stored_Icon');
    expect(panel.textContent).not.toContain('✓');
    expect((panel.querySelector('span span') as HTMLElement).style.color).not.toBe(t.ok);
  });
});

/** A target is not a delivered file: no check glyph and no `ok` colour on the line, in either path. */
describe('AssetTarget — a target never reads as a delivered asset', () => {
  it('draws no check glyph and no ok colour', () => {
    const { container } = render(<AssetTarget t={t} path="/Game/UI/Icons/T_X" />);
    const el = screen.getByTestId('asset-target');
    expect(container.textContent).toContain('asset target: /Game/UI/Icons/T_X');
    expect(el.textContent).not.toContain('✓');
    expect(el.style.color).not.toBe(t.ok);
    expect(el.style.color).toBe(t.muted);
  });
});

