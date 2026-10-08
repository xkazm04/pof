import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });
import '@/lib/catalog/pipelines/registry.generated';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { ArchetypeStep } from '@/components/layout-lab/steps/ArchetypeStep';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';
import { clearJudgeVerdictCache } from '@/components/layout-lab/hooks/useStepJudgeVerdicts';
import { LAB_THEMES } from '@/components/layout-lab/theme';
import { SIBLING_CAP } from '@/components/layout-lab/steps/ux/siblingReconcile';
import type { StepSpec } from '@/lib/catalog/stepSpec';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

/**
 * `?ux=sibling-check` — the [UX] Localization prototype, on the REAL codex pipeline. Without the
 * flag (or with an unrelated one, `ux=judge-verdict`) the step renders as it always has: View ·
 * Produce · Raw artifact. With it, a Sibling agreement panel sets the string table against the
 * entity's other steps and can seed a reconcile direction.
 */

const t = LAB_THEMES[0];
const CATALOG = 'codex';
const STEP = 'Localization';
const entity: LabEntity = { id: 'codex-ux', name: 'The Sundering', lifecycle: 'planned', data: {} };
const specOf = (label: string) => getCatalogPipeline(CATALOG)!.steps.find((s) => s.label === label) as StepSpec;

// The table names Lore Body only; Accessibility is over the prompt's sibling cap on its own.
const SIBLINGS: Record<string, Record<string, unknown>> = {
  'Concept Brief': { brief: 'The world broke in a single night.' },
  'Lore Body': { loreBody: 'Survivors call it the Sundering. CODEX_THESUNDERING_BODY' },
  Accessibility: { a11yChecks: ['Alt text on the codex illustration', `Padding ${'x'.repeat(SIBLING_CAP)}`] },
  'UE Packaging': { assets: ['ST_Codex :: CODEX_THESUNDERING_TITLE'] },
};
const TABLE = {
  locKeys: ['CODEX_THESUNDERING_TITLE', 'CODEX_THESUNDERING_BODY'],
  locNotes: 'Body strings follow the Lore Body step.',
};

const panelLabels = () => Array.from(document.querySelectorAll('section > div:first-child')).map((d) => d.textContent);
const direction = () => (screen.getByTestId('cli-produce-direction') as HTMLTextAreaElement).value;
const tableRow = (label: string) => Array.from(screen.getByTestId('sibling-table').children)
  .find((r) => r.firstElementChild?.textContent === label)?.textContent ?? '';
/** React ids differ between two renders of the same tree; nothing else may. */
const normalized = (html: string) => html.replace(/«r[0-9a-z]+»|:r[0-9a-z]+:|_r_[0-9a-z]+_/g, 'ID');

function renderStep(step = STEP) {
  return render(<ArchetypeStep t={t} entity={entity} step={step} spec={specOf(step)} catalogId={CATALOG} />);
}
const settled = () => waitFor(() => expect(screen.getByTestId('acceptance-banner').getAttribute('data-status')).toBe('pass'));

describe('[UX] sibling agreement desk — Localization, opt-in via ?ux=sibling-check', () => {
  beforeEach(() => {
    useLabPipelineStore.setState({ byEntity: {} });
    localStorage.clear();
    clearJudgeVerdictCache();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ success: true, data: [] }) })));
    const store = useLabPipelineStore.getState();
    for (const [label, data] of Object.entries(SIBLINGS)) store.produce(entity.id, label, { data });
    store.produce(entity.id, STEP, { data: TABLE });
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState({}, '', '/'); });

  it('WITHOUT the opt-in the step renders as before; an unrelated ux flag renders the identical markup', async () => {
    window.history.replaceState({}, '', '/layout?legacy=0&c=codex&e=codex-ux&s=Localization');
    const stock = renderStep();
    await settled();
    expect(screen.queryByTestId('sibling-check-desk')).toBeNull();
    expect(panelLabels()).toEqual(['View', 'Produce', 'Raw artifact']);
    expect(direction()).toBe(specOf(STEP).defaultDirection ?? '');
    const stockHtml = normalized(stock.container.innerHTML);
    cleanup();

    window.history.replaceState({}, '', '/layout?legacy=0&c=codex&e=codex-ux&s=Localization&ux=judge-verdict');
    const other = renderStep();
    await settled();
    expect(screen.queryByTestId('sibling-check-desk')).toBeNull();
    expect(panelLabels()).toEqual(['View', 'Produce', 'Raw artifact']);
    expect(normalized(other.container.innerHTML)).toBe(stockHtml);
  });

  it('WITH the opt-in the table is set against its siblings: named, shared keys, what the prompt carries', async () => {
    window.history.replaceState({}, '', '/layout?legacy=0&c=codex&e=codex-ux&s=Localization&ux=sibling-check');
    renderStep();
    await waitFor(() => expect(screen.getByTestId('sibling-check-desk')).toBeTruthy());
    expect(panelLabels()).toEqual(['Sibling agreement', 'View', 'Produce', 'Raw artifact']);
    expect(screen.getByTestId('sibling-named').textContent).toBe('This Localization table names 1 of its 4 produced sibling steps.');
    expect(screen.getByTestId('sibling-reach').textContent).toBe(
      'The produce prompt carries 2 of them in full. 2 more are cut by its 12,000-character sibling section and reach the model by name only.');
    expect(tableRow('Lore Body')).toMatch(/✓ named.*1.*✓ in full/);
    expect(tableRow('Accessibility')).toMatch(/✕ not named.*—.*✕ name only \(cap\)/);
    expect(tableRow('UE Packaging')).toMatch(/✕ not named.*1.*✕ name only \(cap\)/);
    expect(tableRow('Test Gate')).toMatch(/no output.*— no output/);
  });

  it('opens a sibling’s own View in place, rendered only once opened', async () => {
    window.history.replaceState({}, '', '/layout?ux=sibling-check');
    renderStep();
    const details = await screen.findByTestId('sibling-compare-Accessibility') as HTMLDetailsElement;
    expect(details.textContent).not.toContain('Alt text on the codex illustration');
    details.open = true;
    fireEvent(details, new Event('toggle'));
    await waitFor(() => expect(details.textContent).toContain('Alt text on the codex illustration'));
    // A gallery sibling has no comparable View; an unproduced one has nothing to show.
    expect(screen.queryByTestId('sibling-compare-Illustration')).toBeNull();
    expect(screen.queryByTestId('sibling-compare-Test Gate')).toBeNull();
  });

  it('seeds a reconcile direction naming the unnamed siblings, and warns which the prompt cannot see', async () => {
    window.history.replaceState({}, '', '/layout?ux=sibling-check');
    renderStep();
    fireEvent.click(await screen.findByTestId('sibling-seed-direction'));
    expect(direction()).toMatch(/^Reconcile this Localization table with the sibling steps it does not account for: Concept Brief, Accessibility, UE Packaging\./);
    expect(direction()).toContain('"The Sundering"');
    expect(screen.getByTestId('sibling-seeded')).toBeTruthy();
    expect(screen.getByTestId('sibling-unseen').textContent).toMatch(/^⚠ Accessibility, UE Packaging are cut from the prompt/);
  });

  it('stays on Localization: the same flag on a sibling step adds nothing', async () => {
    window.history.replaceState({}, '', '/layout?ux=sibling-check');
    renderStep('Accessibility');
    await settled();
    expect(screen.queryByTestId('sibling-check-desk')).toBeNull();
  });
});
