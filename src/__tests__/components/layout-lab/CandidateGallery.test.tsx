import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });

import { CandidateGallery } from '@/components/layout-lab/steps/shared/CandidateGallery';
import { appendBatch, emptyHistory, makeBatch, selectCandidate } from '@/components/layout-lab/steps/shared/genHistory';
import { LIGHT } from '@/components/layout-lab/theme';

const mkBatch = (seq: number, direction: string, n: number) =>
  makeBatch({
    seq, at: '2026-05-27T09:30:15.000Z', direction, prompt: `full prompt: ${direction}`,
    candidates: Array.from({ length: n }, (_, i) => ({ swatch: `grad-${seq}-${i}`, payload: { selected: i }, caption: `${seq}-${i}` })),
  });

function twoBatches() {
  let h = appendBatch(emptyHistory(), mkBatch(0, 'weathered steel longsword', 4));
  h = appendBatch(h, mkBatch(1, 'ornate gold filigree', 4));
  return h; // selectedId = b1-c0 (latest batch first candidate)
}

describe('CandidateGallery', () => {
  afterEach(cleanup);

  it('renders an empty hint when there are no candidates', () => {
    render(<CandidateGallery t={LIGHT} history={emptyHistory()} onSelect={() => {}} emptyHint="nothing here" />);
    expect(screen.getByTestId('candidate-gallery-empty').textContent).toContain('nothing here');
  });

  it('shows every persisted re-roll batch with its direction (history is not discarded)', () => {
    render(<CandidateGallery t={LIGHT} history={twoBatches()} onSelect={() => {}} />);
    // both re-rolls' directions are recoverable
    expect(screen.getByText('weathered steel longsword')).toBeTruthy();
    expect(screen.getByText('ornate gold filigree')).toBeTruthy();
    // 8 candidates across 2 batches
    expect(screen.getByTestId('candidate-gallery').textContent).toContain('8 candidates · 2 re-rolls kept');
  });

  it('marks the selected candidate with aria-pressed and lets you re-select an older one', () => {
    const onSelect = vi.fn();
    const h = twoBatches();
    render(<CandidateGallery t={LIGHT} history={h} onSelect={onSelect} />);

    // latest batch's first candidate is selected by default
    expect((screen.getByTestId('candidate-b1-c0') as HTMLButtonElement).getAttribute('aria-pressed')).toBe('true');
    expect((screen.getByTestId('candidate-b0-c2') as HTMLButtonElement).getAttribute('aria-pressed')).toBe('false');

    // re-select a candidate from the FIRST (older) batch
    fireEvent.click(screen.getByTestId('candidate-b0-c2'));
    expect(onSelect).toHaveBeenCalledWith('b0-c2');
  });

  it('reflects a re-selection passed back in via history props', () => {
    const h = selectCandidate(twoBatches(), 'b0-c1');
    render(<CandidateGallery t={LIGHT} history={h} onSelect={() => {}} />);
    expect((screen.getByTestId('candidate-b0-c1') as HTMLButtonElement).getAttribute('aria-pressed')).toBe('true');
    expect((screen.getByTestId('candidate-b1-c0') as HTMLButtonElement).getAttribute('aria-pressed')).toBe('false');
  });

  it('recovers the full prompt for a batch behind a toggle (stamp is recoverable)', () => {
    render(<CandidateGallery t={LIGHT} history={twoBatches()} onSelect={() => {}} />);
    expect(screen.queryByTestId('batch-prompt-b1')).toBeNull();
    fireEvent.click(screen.getAllByText('view prompt')[0]); // newest batch is first
    expect(screen.getByTestId('batch-prompt-b1').textContent).toContain('full prompt: ornate gold filigree');
  });
});
