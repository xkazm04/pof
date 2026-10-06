import { describe, it, expect } from 'vitest';
import { routeOf, summarizeRoutes, type ReadinessRoute } from '@/lib/status/readinessRoute';

type In = Parameters<typeof routeOf>[0];
const cell = (engine: string, judge: In['judge'], level: In['level'], state: In['state']): In => ({
  engine,
  judge,
  level,
  state,
});

describe('routeOf', () => {
  const cases: [string, In, ReadinessRoute][] = [
    ['Claude llm-panel R2 blocked', cell('Claude', 'llm-panel', 'R2', 'blocked'), 'text'],
    ['Hand-authored llm-panel', cell('Hand-authored', 'llm-panel', 'R1', 'waiting'), 'text'],
    ['Leonardo vlm', cell('Leonardo (Lucid Origin)', 'vlm', 'R2', 'waiting'), 'model-blocked'],
    ['ElevenLabs none', cell('ElevenLabs', 'none', 'R1', 'waiting'), 'model-blocked'],
    ['Blender vlm', cell('Blender', 'vlm', 'R2', 'waiting'), 'model-blocked'],
    ['UE Python ue-test', cell('UE Python', 'ue-test', 'R2', 'waiting'), 'other-gate'],
    ['Packaging none', cell('Packaging engine', 'none', 'R1', 'waiting'), 'other-gate'],
    ['Claude R4 waiting is not at-r3', cell('Claude', 'llm-panel', 'R4', 'waiting'), 'text'],
    ['R5 reached', cell('UE Python', 'ue-test', 'R5', 'reached'), 'at-r3'],
    ['R3 reached', cell('Claude', 'llm-panel', 'R3', 'reached'), 'at-r3'],
    ['gen2d + llm-panel is model-blocked', cell('Leonardo', 'llm-panel', 'R2', 'waiting'), 'model-blocked'],
  ];
  it.each(cases)('%s', (_n, input, want) => {
    expect(routeOf(input)).toBe(want);
  });
});

describe('summarizeRoutes', () => {
  it('counts per route and total', () => {
    const rows = (['text', 'text', 'at-r3', 'model-blocked', 'other-gate', 'other-gate'] as ReadinessRoute[]).map(
      (route) => ({ route }),
    );
    expect(summarizeRoutes(rows)).toEqual({ 'at-r3': 1, text: 2, 'model-blocked': 1, 'other-gate': 2, total: 6 });
    expect(summarizeRoutes([]).total).toBe(0);
  });
});
