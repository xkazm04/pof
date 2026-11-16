import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { QualityScoreRow } from '@/components/modules/evaluator/SessionAnalyticsDashboard/QualityScoreRow';
import type { PromptQualityScore } from '@/types/session-analytics';

afterEach(cleanup);
beforeAll(() => {
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
});

const score = (trend: string) => ({ moduleId: 'arpg-combat', score: 85, trend, recentSuccessRate: 1, overallSuccessRate: 1, sessionsRecorded: 8 }) as unknown as PromptQualityScore;

describe('QualityScoreRow trend', () => {
  it.each(['improving', 'stable', 'declining'])('names the %s trend for assistive tech', (trend) => {
    render(<QualityScoreRow score={score(trend)} index={0} animate={false} />);
    expect(screen.getByRole('img', { name: `Trend: ${trend}` })).toBeTruthy();
  });
});
