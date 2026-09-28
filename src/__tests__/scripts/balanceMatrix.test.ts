import { describe, expect, it } from 'vitest';
import type { DescentLevelResult } from '@/lib/catalog/reference/descentSim';
import {
  BALANCE_PRESETS,
  compareMatrixReports,
  formatDiffMarkdown,
  formatMatrixMarkdown,
  summarizeDescentLevels,
  type BalanceMatrixReport,
} from '@/../scripts/diablo/balanceMatrix';

function level(
  depth: number,
  damage: number | null,
  seconds: number | null,
  options: { lifeDeficit?: boolean; manaDeficit?: boolean; portalLethal?: boolean } = {},
): DescentLevelResult {
  return {
    depth,
    expectedDamageTaken: damage,
    expectedSecondsToClear: seconds,
    sustain: options.lifeDeficit ? { sustainable: false, deficit: 1 } : undefined,
    mana: options.manaDeficit ? { sustainable: false, deficit: 1 } : undefined,
    recovery: options.portalLethal ? { engagementSurvivable: false } : undefined,
  } as unknown as DescentLevelResult;
}

function report(row: ReturnType<typeof summarizeDescentLevels>): BalanceMatrixReport {
  return {
    schemaVersion: 1,
    generatedAt: '2026-01-01T00:00:00.000Z',
    policy: 'balanced',
    gear: 'expected',
    runtimeMs: 1250,
    presets: [{ name: 'packs8-tp', flags: ['--encounter', 'packs'], rows: [row] }],
  };
}

describe('balance matrix presets', () => {
  it('maps every named preset to its CLI-equivalent flags', () => {
    expect(Object.fromEntries(BALANCE_PRESETS.map((preset) => [preset.name, preset.flags]))).toEqual({
      default: [],
      packs8: ['--encounter', 'packs', '--slots', '8'],
      'packs8-tp': ['--encounter', 'packs', '--slots', '8', '--recovery', 'town-portal'],
      'packs8-tp-group': [
        '--encounter', 'packs', '--slots', '8', '--recovery', 'town-portal',
        '--group-ai', 'expected',
      ],
      'packs2-tp': ['--encounter', 'packs', '--slots', '2', '--recovery', 'town-portal'],
      'all-economy': [
        '--income', 'gold-and-sales', '--identify', 'when-profitable',
        '--defense', 'expected', '--offense', 'expected', '--buy', 'defence',
        '--recovery', 'town-portal',
      ],
    });
  });
});

describe('balance matrix formatting', () => {
  it('summarizes synthetic descent levels and renders a compact table', () => {
    const row = summarizeDescentLevels('warrior', [
      level(4, 10.125, 20),
      level(8, null, null, { lifeDeficit: true, manaDeficit: true, portalLethal: true }),
      level(12, 30, 40, { manaDeficit: true }),
      level(16, 50, 60),
    ], true);

    expect(row).toEqual({
      className: 'warrior',
      walls: [8],
      firstWall: 8,
      totalDamageFiniteDepths: 90.13,
      damageByDepth: { 4: 10.13, 8: null, 12: 30, 16: 50 },
      totalClearSecondsFiniteDepths: 120,
      lifeDeficitDepths: [8],
      manaDeficitDepths: [8, 12],
      townPortalLethalDepths: [8],
    });
    const markdown = formatMatrixMarkdown(report(row));
    expect(markdown).toContain('| class | walls | first wall | damage d1–16 |');
    expect(markdown).toContain('| clear seconds | life deficit | mana deficit | TP-lethal |');
    expect(markdown).toContain('| warrior | 8 | 8 | 90.13 | 10.13 | — | 30 | 50 | 120 | 8 | 8, 12 | 8 |');
  });

  it('diffs walls and damage percentages and renders them', () => {
    const beforeRow = summarizeDescentLevels('warrior', [
      level(4, 10, 20),
      level(8, null, null),
      level(12, 30, 40),
      level(16, 60, 80),
    ], true);
    const afterRow = summarizeDescentLevels('warrior', [
      level(4, 15, 20),
      level(8, 25, 30),
      level(12, null, null),
      level(16, 30, 80),
    ], true);
    const after = report(afterRow);
    after.generatedAt = '2026-01-02T00:00:00.000Z';

    const diff = compareMatrixReports(report(beforeRow), after);
    expect(diff.rows[0]).toEqual({
      preset: 'packs8-tp',
      className: 'warrior',
      wallsGained: [12],
      wallsLost: [8],
      totalDamageDeltaPercent: -30,
      damageDeltaPercentByDepth: { 4: 50, 8: null, 12: null, 16: -50 },
    });
    expect(formatDiffMarkdown(diff)).toContain(
      '| packs8-tp | warrior | 12 | 8 | -30% | +50% | n/a | n/a | -50% |',
    );
  });
});
