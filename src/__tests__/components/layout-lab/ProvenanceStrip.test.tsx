import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });
import { ProvenanceStrip } from '@/components/layout-lab/steps/shared/ProvenanceStrip';
import { StepFrame } from '@/components/layout-lab/steps/StepFrame';
import { LAB_THEMES } from '@/components/layout-lab/theme';
import type { StepFact } from '@/lib/status/statusModel';

const t = LAB_THEMES[0];

const shapeOnly: StepFact = {
  catalogId: 'demo', step: 'Concept Brief', trueEngine: 'Claude', deliverable: 'text-config',
  generatorWired: true, judge: 'llm-panel', checkerMeaningful: false,
  note: 'Hand-authored prose brief; minLength(300) only checks character count, not content correctness.',
};
const meaningful: StepFact = { ...shapeOnly, step: 'Economy', trueEngine: 'Code', checkerMeaningful: true, note: 'Deterministic budget math is validated.' };
const noJudge: StepFact = { ...shapeOnly, judge: 'none', generatorWired: false, note: 'No grader; media claim unwired.' };

describe('ProvenanceStrip', () => {
  afterEach(cleanup);

  it('surfaces engine, judge and a SHAPE-ONLY caveat for a shape-only checker', () => {
    render(<ProvenanceStrip t={t} fact={shapeOnly} />);
    expect(screen.getByTestId('provenance-strip')).toBeTruthy();
    expect(screen.getByTestId('provenance-engine').textContent).toContain('Claude');
    expect(screen.getByTestId('provenance-judge').textContent).toContain('llm-panel');
    expect(screen.getByText('CHECKER: SHAPE-ONLY')).toBeTruthy();
    // A shape-only checker must never read as meaningful/verified.
    expect(screen.queryByText('CHECKER: MEANINGFUL')).toBeNull();
  });

  it('marks a meaningful checker distinctly', () => {
    render(<ProvenanceStrip t={t} fact={meaningful} />);
    expect(screen.getByText('CHECKER: MEANINGFUL')).toBeTruthy();
    expect(screen.queryByText('CHECKER: SHAPE-ONLY')).toBeNull();
  });

  it('shows BROWSER MIRROR: LIVE for a mirrorable step in a hydratable catalog', () => {
    render(<ProvenanceStrip t={t} fact={{ ...shapeOnly, catalogId: 'spellbook' }} />);
    expect(screen.getByText('BROWSER MIRROR: LIVE')).toBeTruthy();
  });

  it('shows the mirror class as a chip when the catalog has no preview scene yet', () => {
    render(<ProvenanceStrip t={t} fact={shapeOnly} />); // catalogId 'demo' not hydratable
    expect(screen.queryByText('BROWSER MIRROR: LIVE')).toBeNull();
    expect(screen.getByTestId('provenance-browser').textContent).toContain('direct');
  });

  it('never claims a browser path for the ue-runtime moat', () => {
    render(<ProvenanceStrip t={t} fact={{ ...shapeOnly, deliverable: 'ue-runtime' }} />);
    expect(screen.queryByText('BROWSER MIRROR: LIVE')).toBeNull();
    expect(screen.queryByTestId('provenance-browser')).toBeNull();
  });

  it('loudly flags a missing judge and an unwired generator', () => {
    render(<ProvenanceStrip t={t} fact={noJudge} />);
    expect(screen.getByText('JUDGE: NONE')).toBeTruthy();
    expect(screen.getByText('GENERATOR: NOT WIRED')).toBeTruthy();
    expect(screen.queryByTestId('provenance-judge')).toBeNull();
  });

  it('makes the honesty note reachable in an expandable disclosure', () => {
    const { container } = render(<ProvenanceStrip t={t} fact={shapeOnly} />);
    const details = container.querySelector('details[data-testid="provenance-note"]');
    expect(details).toBeTruthy();
    expect(details!.textContent).toContain('character count');
  });
});

describe('StepFrame provenance integration', () => {
  afterEach(cleanup);
  const pass = { label: 'Brief', status: 'pass' as const, detail: '312 chars' };

  it('shows the SHAPE-ONLY caveat on a passing step whose real checker is shape-only', () => {
    // 'items' / 'Concept Brief' is a real audited fact: pass, but checkerMeaningful=false.
    render(<StepFrame t={t} acceptance={pass} panels={[]} catalogId="items" step="Concept Brief" />);
    expect(screen.getByTestId('acceptance-banner').getAttribute('data-status')).toBe('pass');
    expect(screen.getByTestId('provenance-strip')).toBeTruthy();
    expect(screen.getByText('CHECKER: SHAPE-ONLY')).toBeTruthy();
  });

  it('renders exactly as today (no strip) when no fact resolves', () => {
    const { rerender } = render(<StepFrame t={t} acceptance={pass} panels={[]} />);
    expect(screen.queryByTestId('provenance-strip')).toBeNull();
    rerender(<StepFrame t={t} acceptance={pass} panels={[]} catalogId="items" step="No Such Step" />);
    expect(screen.queryByTestId('provenance-strip')).toBeNull();
  });
});
