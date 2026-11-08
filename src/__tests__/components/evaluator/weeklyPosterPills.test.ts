import { describe, it, expect } from 'vitest';
import { renderDigestToCanvas } from '@/components/modules/evaluator/WeeklyDigestView/helpers';
import type { WeeklyDigest } from '@/types/weekly-digest';

const PILL_TEXT = 130; // measured text width
const PILL_W = PILL_TEXT + 20;

function fakeCanvas() {
  const texts: { text: string; x: number }[] = [];
  const ctx = new Proxy({} as Record<string, unknown>, {
    get(_t, prop) {
      if (prop === 'createLinearGradient') return () => ({ addColorStop() {} });
      if (prop === 'measureText') return () => ({ width: PILL_TEXT });
      if (prop === 'fillText') return (text: string, x: number) => { texts.push({ text, x }); };
      return () => undefined;
    },
    set: () => true,
  });
  return { canvas: { getContext: () => ctx } as unknown as HTMLCanvasElement, texts };
}

const DIGEST: WeeklyDigest = {
  periodStart: '2026-09-28', periodEnd: '2026-10-05', zone: 'UTC',
  checklistCompleted: 0, checklistTotal: 100, checklistDelta: 0,
  totalSessions: 4, successRate: 0.75, totalTimeMs: 120_000,
  mostActiveModule: null, moduleActivity: [], longestStreak: 2, currentStreak: 1,
  achievements: Array.from({ length: 7 }, (_, i) => ({ id: `a${i}`, title: `Pill${i}`, description: '', icon: '*' })),
  dailySessions: [], prevWeekSessions: 2, prevWeekSuccessRate: 0.5,
};

describe('weekly poster achievement pills', () => {
  it('wraps before a pill would leave the 40px margin', () => {
    const { canvas, texts } = fakeCanvas();
    renderDigestToCanvas(canvas, DIGEST);
    const pills = texts.filter((t) => t.text.includes('Pill'));
    expect(pills).toHaveLength(7);
    for (const p of pills) expect(p.x - 10 + PILL_W).toBeLessThanOrEqual(760);
  });
});
