import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });

/**
 * The bespoke gallery steps (`GenerativeStepFrame`) project `data.genHistory` exactly as the
 * generic gallery does — a payload other sessions, the MCP submit path and headless drains also
 * write. `ArchetypeStep` contains a crash in that panel (`PanelCrashBoundary`); the bespoke frame
 * did not, so one malformed history took the acceptance banner, Produce and the Raw artifact
 * window down with it. Same input, same containment.
 */
vi.mock('@/components/layout-lab/steps/shared/CandidateGallery', () => ({
  CandidateGallery: () => { throw new TypeError('genHistory.batches is not iterable'); },
}));

import '@/lib/catalog/pipelines/registry.generated';
import { getStepComponent } from '@/components/layout-lab/steps';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';
import { clearJudgeVerdictCache } from '@/components/layout-lab/hooks/useStepJudgeVerdicts';
import { LAB_THEMES } from '@/components/layout-lab/theme';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

const t = LAB_THEMES[0];
const entity: LabEntity = { id: 'gen-crash-1', name: 'Iron Longsword', lifecycle: 'planned', data: {} };
const STEP = '3D Generation';

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: true, data: [] }), { status: 200 })));
  localStorage.clear();
  clearJudgeVerdictCache();
  useLabPipelineStore.setState({
    byEntity: { [entity.id]: { [STEP]: { done: true, data: { genHistory: { batches: 'corrupt' } }, ueAssets: [], at: '2026-01-01T00:00:00.000Z' } } },
  });
});
afterEach(() => { cleanup(); consoleError.mockRestore(); vi.unstubAllGlobals(); useLabPipelineStore.setState({ byEntity: {} }); });

describe('GenerativeStepFrame — a crashing gallery panel is contained inside the step', () => {
  it('replaces only the gallery panel; the banner, Produce and Raw artifact stay', () => {
    const Step = getStepComponent('items', STEP);
    if (!Step) throw new Error(`${STEP} must route to its bespoke gallery component`);
    render(<Step t={t} entity={entity} step={STEP} />);
    const note = screen.getByTestId('panel-crash-note');
    expect(note.getAttribute('data-crash-panel')).toBe('candidate gallery');
    expect(screen.getByTestId('acceptance-banner')).toBeTruthy();
    expect(screen.getByTestId('cli-produce-run')).toBeTruthy();
    expect(screen.getByTestId('raw-artifact')).toBeTruthy();
  });
});
