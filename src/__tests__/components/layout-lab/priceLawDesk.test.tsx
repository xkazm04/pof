import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });
import '@/lib/catalog/pipelines/registry.generated';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { ArchetypeStep } from '@/components/layout-lab/steps/ArchetypeStep';
import { PriceLawPanel } from '@/components/layout-lab/steps/ux/PriceLawPanel';
import { checkPriceLaw } from '@/components/layout-lab/steps/ux/economyPriceLaw';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';
import { clearJudgeVerdictCache } from '@/components/layout-lab/hooks/useStepJudgeVerdicts';
import { LAB_THEMES } from '@/components/layout-lab/theme';
import type { StepSpec } from '@/lib/catalog/stepSpec';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

/**
 * `?ux=price-law` — the [UX] Economy prototype, on the REAL registered items pipeline (the label
 * the lab routes through ArchetypeStep). Without the flag the step renders as it always has; with
 * it, a Price law panel re-derives the cell from the ITEMS-PRICE-LAW block it stores.
 */

const t = LAB_THEMES[0];
const CATALOG = 'items';
const STEP = 'Economy';
const entity: LabEntity = { id: 'item-ux', name: 'Iron Longsword', lifecycle: 'planned', data: {} };
const specOf = (label: string) => getCatalogPipeline(CATALOG)!.steps.find((s) => s.label === label) as StepSpec;

// item-1's stored Economy cell, trimmed to what the law reads (~/.pof/pof.db, 2026-10-13).
const ECONOMY = {
  pricePowerRatio: 1,
  economy: {
    baseValue: 151, powerScore: 100, pricePowerRatio: 1,
    powerBreakdown: { dpsPower: 74, implicitAccuracyPower: 10, affixPower: 16 },
    itemsPriceLaw: {
      gearNormalRung: 'vendorBaseValue = 8g x itemLevel (the Normal rung for equippable gear)',
      rarityMultiplier: { Normal: 1, Magic: 1.35, Rare: 2.2 },
      buyback: 'sell = 30% of cost',
    },
    costModel: { itemLevel: 14, rarity: 'Magic', vendorBaseValue: 112 },
    priceCheck: { goldPerPower: 1.512 },
    vendor: { buy: 151, sell: 45 },
  },
};

const panelLabels = () => Array.from(document.querySelectorAll('section > div:first-child')).map((d) => d.textContent);
const direction = () => (screen.getByTestId('cli-produce-direction') as HTMLTextAreaElement).value;
// The stock bars grow in (motion), so two renders differ only in a mid-animation width.
const normalized = (html: string) => html.replace(/«r[0-9a-z]+»|:r[0-9a-z]+:|_r_[0-9a-z]+_/g, 'ID').replace(/width: [0-9.]+(?:%|px);/g, 'width: W;');
const settled = () => waitFor(() => expect(screen.getByTestId('acceptance-banner').getAttribute('data-status')).toBe('pass'));
const renderStep = (step = STEP) => render(<ArchetypeStep t={t} entity={entity} step={step} spec={specOf(step)} catalogId={CATALOG} />);

describe('[UX] price-law desk — items Economy, opt-in via ?ux=price-law', () => {
  beforeEach(() => {
    useLabPipelineStore.setState({ byEntity: {} });
    localStorage.clear();
    clearJudgeVerdictCache();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ success: true, data: [] }) })));
    useLabPipelineStore.getState().produce(entity.id, STEP, { data: ECONOMY });
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState({}, '', '/'); });

  it('WITHOUT the opt-in the step renders as before; an unrelated ux flag renders the identical markup', async () => {
    window.history.replaceState({}, '', '/layout?c=items&e=item-ux&s=Economy');
    const stock = renderStep();
    await settled();
    expect(screen.queryByTestId('price-law-desk')).toBeNull();
    expect(panelLabels()).toEqual(['View', 'Produce', 'Raw artifact']);
    const stockHtml = normalized(stock.container.innerHTML);
    cleanup();

    window.history.replaceState({}, '', '/layout?c=items&e=item-ux&s=Economy&ux=sibling-check');
    const other = renderStep();
    await settled();
    expect(screen.queryByTestId('price-law-desk')).toBeNull();
    expect(normalized(other.container.innerHTML)).toBe(stockHtml);
  });

  it('WITH the opt-in the cell is re-derived from its own law, ahead of the View', async () => {
    window.history.replaceState({}, '', '/layout?ux=price-law');
    renderStep();
    await waitFor(() => expect(screen.getByTestId('price-law-desk')).toBeTruthy());
    await settled();
    expect(panelLabels()).toEqual(['Price law', 'View', 'Produce', 'Raw artifact']);
    expect(screen.getByTestId('price-law-headline').textContent).toBe('The shown price is 8g × item level 14 × Magic 1.35 = 151g, sold back at 30%.');
    expect(screen.getByTestId('price-law-agreement').textContent).toBe('✓ All 7 stored figures the law can check agree with it.');
    expect(screen.getByTestId('price-law-bite').textContent).toContain('It can fail only if powerScore leaves 83.33–125.');
    expect(screen.getByTestId('price-law-terms').textContent).toContain('economy.costModel.vendorBaseValue');
    expect(screen.queryByTestId('price-law-seed-direction')).toBeNull();
  });

  it('stays on items Economy: the same flag on another step adds nothing', async () => {
    window.history.replaceState({}, '', '/layout?ux=price-law');
    renderStep('Concept Brief');
    await waitFor(() => expect(screen.getByTestId('acceptance-banner')).toBeTruthy());
    expect(screen.queryByTestId('price-law-desk')).toBeNull();
  });
});

describe('PriceLawPanel — contradictions and the seed action', () => {
  afterEach(cleanup);

  it('lists each contradiction and seeds only on click', () => {
    const r = checkPriceLaw({ ...ECONOMY, economy: { ...ECONOMY.economy, baseValue: 160 } });
    const onSeed = vi.fn();
    const { rerender } = render(<PriceLawPanel t={t} r={r} seeded={false} onSeed={onSeed} />);
    expect(screen.getByTestId('price-law-agreement').textContent).toMatch(/^✕ 3 of 7 stored figures contradict the law: cost, pricePowerRatio, sell\.$/);
    expect(screen.queryByTestId('price-law-seeded')).toBeNull();
    fireEvent.click(screen.getByTestId('price-law-seed-direction'));
    expect(onSeed).toHaveBeenCalledTimes(1);
    rerender(<PriceLawPanel t={t} r={r} seeded onSeed={onSeed} />);
    expect(screen.getByTestId('price-law-seeded')).toBeTruthy();
  });

  it('warns when the cell stores no law block', () => {
    const { itemsPriceLaw: _omit, ...rest } = ECONOMY.economy;
    void _omit;
    render(<PriceLawPanel t={t} r={checkPriceLaw({ ...ECONOMY, economy: rest })} seeded={false} onSeed={() => {}} />);
    expect(screen.getByTestId('price-law-missing')).toBeTruthy();
  });
});

describe('seeding through ArchetypeStep', () => {
  beforeEach(() => {
    useLabPipelineStore.setState({ byEntity: {} });
    localStorage.clear();
    clearJudgeVerdictCache();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ success: true, data: [] }) })));
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState({}, '', '/'); });

  it('puts the law’s own figures into the Produce direction', async () => {
    useLabPipelineStore.getState().produce(entity.id, STEP, { data: { ...ECONOMY, economy: { ...ECONOMY.economy, baseValue: 160 } } });
    window.history.replaceState({}, '', '/layout?ux=price-law');
    renderStep();
    fireEvent.click(await screen.findByTestId('price-law-seed-direction'));
    expect(direction()).toMatch(/^Reconcile the Economy cell for "Iron Longsword" with ITEMS-PRICE-LAW/);
    expect(direction()).toContain('cost stores 160 at economy.baseValue; the law gives 151');
    expect(screen.getByTestId('price-law-seeded')).toBeTruthy();
  });
});
