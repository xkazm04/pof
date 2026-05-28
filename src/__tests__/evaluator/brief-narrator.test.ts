import { describe, it, expect } from 'vitest';
import { buildProducersBrief, toneForScore } from '@/lib/evaluator/brief-narrator';
import type { CorrelatedInsight } from '@/lib/evaluator/insight-generator';
import type { ProjectHealthSummary } from '@/lib/evaluator/combined-health';

// Words a non-technical reader should never see in a Producers Brief.
const UE5_JARGON = [
  'blueprint', 'actor', 'animbp', 'anim bp', 'state machine',
  'subsystem', 'gameplaytag', 'gameplay tag', 'delegate',
  'pawn', 'c++', 'unreal', 'ue5', 'ue 5', 'mesh', 'fname',
  'fstring', 'ftext', 'uobject', 'savegame',
  'blackboard', 'behavior tree', 'niagara', 'metahuman',
  'replicate', 'rep notify', 'rpc', 'usaveable',
];

function expectNoJargon(text: string) {
  const lower = text.toLowerCase();
  for (const term of UE5_JARGON) {
    expect(lower, `should not contain UE5 jargon "${term}" — got: ${text}`).not.toContain(term);
  }
}

function mkHealth(overall: number, modules: Array<{ id: string; label: string; score: number }> = []): ProjectHealthSummary {
  return {
    overallScore: overall,
    moduleScores: modules.map((m) => ({
      moduleId: m.id as ProjectHealthSummary['moduleScores'][number]['moduleId'],
      label: m.label,
      breakdown: { quality: m.score, dependencyHealth: m.score, coverage: m.score, activity: m.score, combined: m.score },
    })),
    topStrength: null,
    topWeakness: null,
    dimensionAverages: { quality: overall, dependencyHealth: overall, coverage: overall, activity: overall, combined: overall },
  };
}

function mkInsight(partial: Partial<CorrelatedInsight>): CorrelatedInsight {
  return {
    id: 'x',
    moduleId: 'arpg-combat',
    moduleLabel: 'Combat System',
    category: 'brittle-module',
    severity: 'warning',
    title: 'placeholder',
    description: 'placeholder',
    sources: ['quality'],
    drillDownTab: 'quality',
    priority: 3,
    ...partial,
  };
}

describe('brief-narrator: toneForScore', () => {
  it('maps scores to tones at the expected breakpoints', () => {
    expect(toneForScore(95)).toBe('green');
    expect(toneForScore(80)).toBe('green');
    expect(toneForScore(79)).toBe('steady');
    expect(toneForScore(65)).toBe('steady');
    expect(toneForScore(50)).toBe('watch');
    expect(toneForScore(30)).toBe('risk');
    expect(toneForScore(10)).toBe('critical');
  });
});

describe('brief-narrator: buildProducersBrief', () => {
  it('produces a green headline when no risks are flagged', () => {
    const brief = buildProducersBrief([], mkHealth(82, [
      { id: 'arpg-combat', label: 'Combat System', score: 85 },
    ]));
    expect(brief.headline).toMatch(/excellent|solid|healthy/i);
    expect(brief.risks).toHaveLength(0);
    expectNoJargon(brief.headline);
    expectNoJargon(brief.paragraph);
  });

  it('surfaces critical risks in the headline', () => {
    const brief = buildProducersBrief(
      [mkInsight({ id: 'crit-1', severity: 'critical', category: 'dependency-bottleneck', priority: 0, moduleLabel: 'Save & Load' })],
      mkHealth(42, [{ id: 'arpg-save', label: 'Save & Load', score: 35 }]),
    );
    expect(brief.headline).toMatch(/urgent|attention/i);
    expect(brief.risks).toHaveLength(1);
    expect(brief.risks[0].tone).toBe('critical');
  });

  it('translates dependency-bottleneck into player-facing language', () => {
    const brief = buildProducersBrief(
      [mkInsight({ id: 'b1', severity: 'critical', category: 'dependency-bottleneck', priority: 0, moduleLabel: 'Save & Load' })],
      mkHealth(50, [{ id: 'arpg-save', label: 'Save & Load', score: 50 }]),
    );
    const risk = brief.risks[0];
    expect(risk.title).toContain('Save & Load');
    expect(risk.consequence).toMatch(/holding|waiting|leverage/i);
    expectNoJargon(risk.title);
    expectNoJargon(risk.consequence);
  });

  it('attaches a rough time-to-fix estimate to every non-positive risk', () => {
    const brief = buildProducersBrief(
      [
        mkInsight({ id: 'a', severity: 'critical', priority: 0 }),
        mkInsight({ id: 'b', severity: 'warning',  priority: 3 }),
        mkInsight({ id: 'c', severity: 'info',     priority: 5 }),
      ],
      mkHealth(50),
    );
    expect(brief.risks).toHaveLength(3);
    expect(brief.risks[0].timeToFix).toMatch(/day/i);
    expect(brief.risks[1].timeToFix).toMatch(/hour/i);
    expect(brief.risks[2].timeToFix).toMatch(/under an hour|small fix/i);
  });

  it('emits one module brief per scored module, each with a plain-English headline', () => {
    const brief = buildProducersBrief(
      [],
      mkHealth(70, [
        { id: 'arpg-combat',     label: 'Combat System',   score: 85 },
        { id: 'arpg-save',       label: 'Save & Load',     score: 30 },
        { id: 'arpg-character',  label: 'Character & Movement', score: 60 },
      ]),
    );
    expect(brief.moduleBriefs).toHaveLength(3);
    expect(brief.moduleBriefs[0].headline).toMatch(/Combat System is/);
    expect(brief.moduleBriefs[1].headline).toMatch(/Save & Load is/);
    for (const m of brief.moduleBriefs) {
      expectNoJargon(m.headline);
      if (m.detail) expectNoJargon(m.detail);
    }
  });

  it('moves positive insights into highlights rather than risks', () => {
    const brief = buildProducersBrief(
      [mkInsight({ id: 'pos', severity: 'positive', category: 'strong-module', priority: 10, moduleLabel: 'Combat System' })],
      mkHealth(80, [{ id: 'arpg-combat', label: 'Combat System', score: 90 }]),
    );
    expect(brief.risks).toHaveLength(0);
    expect(brief.highlights).toHaveLength(1);
    expect(brief.highlights[0].label).toBe('Combat System');
  });

  it('returns an empty-state paragraph when there is no data at all', () => {
    const brief = buildProducersBrief([], mkHealth(0));
    expect(brief.moduleBriefs).toHaveLength(0);
    expect(brief.paragraph).toMatch(/not enough data|isn['’]t enough/i);
  });

  it('never leaks UE5 jargon across the full brief', () => {
    const brief = buildProducersBrief(
      [
        mkInsight({ id: 'a', severity: 'critical', category: 'dependency-bottleneck', priority: 0 }),
        mkInsight({ id: 'b', severity: 'warning',  category: 'brittle-module',        priority: 1 }),
        mkInsight({ id: 'c', severity: 'warning',  category: 'blocked-progress',      priority: 3 }),
        mkInsight({ id: 'd', severity: 'info',     category: 'quality-disconnect',    priority: 4 }),
        mkInsight({ id: 'e', severity: 'warning',  category: 'overworked-low-roi',    priority: 3 }),
        mkInsight({ id: 'f', severity: 'positive', category: 'strong-module',         priority: 10 }),
        mkInsight({ id: 'g', severity: 'info',     category: 'coverage-gap',          priority: 5 }),
        mkInsight({ id: 'h', severity: 'warning',  category: 'neglected-module',      priority: 2 }),
      ],
      mkHealth(55, [
        { id: 'arpg-combat',    label: 'Combat System',   score: 70 },
        { id: 'arpg-save',      label: 'Save & Load',     score: 40 },
        { id: 'arpg-character', label: 'Character & Movement', score: 55 },
      ]),
    );
    expectNoJargon(brief.headline);
    expectNoJargon(brief.paragraph);
    for (const r of brief.risks) {
      expectNoJargon(r.title);
      expectNoJargon(r.consequence);
      expectNoJargon(r.timeToFix);
    }
    for (const m of brief.moduleBriefs) {
      expectNoJargon(m.headline);
      if (m.detail) expectNoJargon(m.detail);
    }
  });
});
