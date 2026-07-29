import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });
import { ArchetypeStep } from '@/components/layout-lab/steps/ArchetypeStep';
import { ProvenanceStrip } from '@/components/layout-lab/steps/shared/ProvenanceStrip';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';
import { LAB_THEMES } from '@/components/layout-lab/theme';
import { selected } from '@/lib/catalog/acceptance/dataCheckers';
import type { StepSpec } from '@/lib/catalog/stepSpec';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

/**
 * "Auto-picked is not human-chosen": 45 of 47 gallery steps render hashed swatches and
 * `appendBatch` auto-selects, so the L1 `selected(...)` human-selection gate passes the
 * instant Produce is clicked. Acceptance is unchanged (requiring a click would break the
 * e2e walker) — the CLAIM is what gets honest.
 */
const t = LAB_THEMES[0];
const STEP = 'Icon 2D Art';
const entity: LabEntity = { id: 'sel1', name: 'Fireball', lifecycle: 'planned', data: {} };
const spec: StepSpec = {
  archetype: 'gallery', label: STEP,
  view: { kind: 'gallery', field: 'selected', candidates: 4 },
  produce: () => ({ data: { selected: 0 } }),
  accept: selected('selected', 'An icon candidate is selected'),
};

const status = () => screen.getByTestId('acceptance-banner').getAttribute('data-status');
const strip = () => screen.getByTestId('provenance-strip').textContent ?? '';
const settle = () => act(async () => {});

describe('selection provenance in the step UI', () => {
  beforeEach(() => { useLabPipelineStore.setState({ byEntity: {} }); localStorage.clear(); });
  afterEach(cleanup);

  it('renders SELECTION: AUTO after Produce, and SELECTION: HUMAN after a real click', async () => {
    render(<ArchetypeStep t={t} entity={entity} step={STEP} spec={spec} />);
    // Nothing selected yet → no selection claim at all.
    expect(screen.queryByTestId('provenance-strip')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: new RegExp(`Produce ${STEP}`) }));
    await settle();
    // Terminal (walker-safe) status is preserved — deferred, because these candidates are
    // swatches and the step now grades the selected candidate, not the index.
    expect(status()).toBe('deferred');
    // …but the claim is honest: the machine picked it.
    expect(strip()).toContain('SELECTION: AUTO');
    expect(strip()).not.toContain('SELECTION: HUMAN');

    fireEvent.click(screen.getByTestId('candidate-b0-c2'));
    await settle();
    expect(strip()).toContain('SELECTION: HUMAN');
    expect(status()).toBe('deferred');
  });

  it('a re-roll re-arms the auto claim (a new machine pick is not the old human choice)', async () => {
    render(<ArchetypeStep t={t} entity={entity} step={STEP} spec={spec} />);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`Produce ${STEP}`) }));
    await settle();
    fireEvent.click(screen.getByTestId('candidate-b0-c1'));
    await settle();
    expect(strip()).toContain('SELECTION: HUMAN');

    fireEvent.click(screen.getByRole('button', { name: new RegExp(`Produce ${STEP}`) }));
    await settle();
    expect(strip()).toContain('SELECTION: AUTO');
  });

  it('a non-gallery step shows no selection claim', () => {
    const staticSpec: StepSpec = {
      archetype: 'brief', label: 'Concept Brief',
      view: { kind: 'prose', field: 'brief', emptyText: 'No brief yet' },
      produce: () => ({ data: { brief: 'x'.repeat(400) } }),
      accept: selected('brief', 'brief set'),
    };
    render(<ArchetypeStep t={t} entity={entity} step="Concept Brief" spec={staticSpec} />);
    expect(screen.queryByTestId('provenance-strip')).toBeNull();
  });
});

describe('ProvenanceStrip — selection chips are colorblind-safe (glyph + word)', () => {
  afterEach(cleanup);

  it('renders the AUTO chip with a warn glyph and the word, not hue alone', () => {
    render(<ProvenanceStrip t={t} selection="auto" />);
    const text = screen.getByTestId('provenance-strip').textContent ?? '';
    expect(text).toContain('SELECTION: AUTO');
    expect(text.replace('SELECTION: AUTO', '').trim()).not.toBe(''); // a glyph accompanies the word
  });

  it('renders a legacy history honestly as unrecorded, never as human', () => {
    render(<ProvenanceStrip t={t} selection="unrecorded" />);
    expect(screen.getByTestId('provenance-selection').textContent).toContain('unrecorded');
  });

  it('renders without an audited StepFact (fact-less steps still get the claim)', () => {
    render(<ProvenanceStrip t={t} selection="human" />);
    expect(screen.queryByTestId('provenance-engine')).toBeNull();
    expect(screen.queryByTestId('provenance-note')).toBeNull();
    expect(screen.getByTestId('provenance-strip').textContent).toContain('SELECTION: HUMAN');
  });
});
