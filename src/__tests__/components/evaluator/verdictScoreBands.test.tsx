import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { JudgeVerdictsView } from '@/components/modules/evaluator/JudgeVerdictsView';
import { VerdictDetailModal } from '@/components/modules/evaluator/JudgeVerdictsView/VerdictDetailModal';
import { VerdictScoreTrend } from '@/components/modules/evaluator/JudgeVerdictsView/VerdictScoreTrend';
import type { ViewVerdict } from '@/components/modules/evaluator/JudgeVerdictsView/verdictRollup';
import { scoreBandToken } from '@/lib/chart-colors';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

/** Normalise a colour the way the DOM does, so token vs inline style compare equal. */
function norm(c: string): string {
  const el = document.createElement('div');
  el.style.color = c;
  return el.style.color;
}

const MUTED = norm('var(--text-muted)');
const BAND_95 = norm(scoreBandToken(95).color);
const BAND_30 = norm(scoreBandToken(30).color);

const verdict = (score: number): ViewVerdict => ({
  catalogId: 'items', entityId: 'sword', step: 'Icon 2D Art', judge: 'llm-panel',
  verdict: score >= 60 ? 'pass' : 'fail', score, findings: 'f', model: 'opus',
});

function allColors(root: ParentNode): string[] {
  const out: string[] = [];
  root.querySelectorAll<HTMLElement>('*').forEach((el) => {
    if (el.style.color) out.push(norm(el.style.color));
    if (el.style.backgroundColor) out.push(norm(el.style.backgroundColor));
  });
  return out;
}

describe('judge verdict score colours use the 0-100 band scale', () => {
  it('the band tokens differ from muted (test is meaningful)', () => {
    expect(BAND_95).not.toBe(MUTED);
    expect(BAND_30).not.toBe(MUTED);
  });

  it('JudgeVerdictsView: row score, avg and pass-rate are band-coloured', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => ({ success: true, data: [verdict(95)] }) })) as unknown as typeof fetch);
    render(<JudgeVerdictsView />);
    await waitFor(() => expect(screen.getByTestId('verdict-row')).toBeTruthy());
    const totals = screen.getByTestId('verdict-totals');
    const colors = allColors(screen.getByTestId('judge-verdicts-view'));
    // row score + group avg + headline avg + pass-rate = 4 painted spans
    expect(colors.filter((c) => c === BAND_95).length).toBeGreaterThanOrEqual(4);
    expect(totals.textContent).toContain('1 pass');
    expect(colors.includes(MUTED)).toBe(false);
  });

  it('VerdictDetailModal: score number and meter are band-coloured', () => {
    render(<VerdictDetailModal verdict={verdict(95)} onClose={() => {}} />);
    const colors = allColors(document.body);
    expect(colors.filter((c) => c === BAND_95).length).toBeGreaterThanOrEqual(1);
    expect(colors.includes(MUTED)).toBe(false);
  });

  it('VerdictScoreTrend: bars are band-coloured', async () => {
    const h = (s: number, at: string) => ({ ...verdict(s), judgedAt: at });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ success: true, data: [h(30, '2026-07-20 10:00'), h(95, '2026-07-22 10:00')] }) })) as unknown as typeof fetch);
    render(<VerdictScoreTrend verdict={verdict(95)} />);
    await waitFor(() => expect(document.querySelector('[role="figure"]')).toBeTruthy());
    const colors = allColors(document.body);
    // The low point is red only if its 0-100 score is banded (red is not used by any StatusTag here).
    expect(colors).toContain(BAND_30);
  });
});
