import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DESCENT_CLASSES,
  simulateDescent,
  type DescentClassName,
  type DescentLevelResult,
} from '@/lib/catalog/reference/descentSim';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';
import {
  assembleDescentInput,
  loadDescentWrappers,
  type AssembleDescentInputOptions,
} from './descentInputs';

const DAMAGE_DEPTHS = [4, 8, 12, 16] as const;

export interface BalancePreset {
  name: string;
  flags: readonly string[];
  input: Partial<AssembleDescentInputOptions>;
}

export const BALANCE_PRESETS: readonly BalancePreset[] = [
  { name: 'default', flags: [], input: {} },
  {
    name: 'packs8',
    flags: ['--encounter', 'packs', '--slots', '8'],
    input: { encounter: 'packs', adjacentSlots: 8 },
  },
  {
    name: 'packs8-tp',
    flags: ['--encounter', 'packs', '--slots', '8', '--recovery', 'town-portal'],
    input: { encounter: 'packs', adjacentSlots: 8, recovery: 'town-portal' },
  },
  {
    name: 'packs8-tp-group',
    flags: [
      '--encounter', 'packs', '--slots', '8', '--recovery', 'town-portal',
      '--group-ai', 'expected',
    ],
    input: {
      encounter: 'packs',
      adjacentSlots: 8,
      recovery: 'town-portal',
      groupAi: 'expected',
    },
  },
  {
    name: 'packs2-tp',
    flags: ['--encounter', 'packs', '--slots', '2', '--recovery', 'town-portal'],
    input: { encounter: 'packs', adjacentSlots: 2, recovery: 'town-portal' },
  },
  {
    name: 'all-economy',
    flags: [
      '--income', 'gold-and-sales', '--identify', 'when-profitable',
      '--defense', 'expected', '--offense', 'expected', '--buy', 'defence',
      '--recovery', 'town-portal',
    ],
    input: {
      sustainIncome: 'gold-and-sales',
      saleIdentify: 'when-profitable',
      defensiveAffixes: 'expected',
      offensiveAffixes: 'expected',
      purchases: 'defence',
      recovery: 'town-portal',
    },
  },
] as const;

export interface DamageByDepth {
  4: number | null;
  8: number | null;
  12: number | null;
  16: number | null;
}

export interface BalanceMatrixRow {
  className: DescentClassName;
  walls: number[];
  firstWall: number | null;
  totalDamageFiniteDepths: number;
  damageByDepth: DamageByDepth;
  totalClearSecondsFiniteDepths: number;
  lifeDeficitDepths: number[];
  manaDeficitDepths: number[];
  townPortalLethalDepths: number[] | null;
}

export interface BalanceMatrixPresetResult {
  name: string;
  flags: string[];
  rows: BalanceMatrixRow[];
}

export interface BalanceMatrixReport {
  schemaVersion: 1;
  generatedAt: string;
  policy: 'balanced';
  gear: 'expected';
  runtimeMs: number;
  presets: BalanceMatrixPresetResult[];
}

type SummaryLevel = Pick<
  DescentLevelResult,
  'depth' | 'expectedDamageTaken' | 'expectedSecondsToClear' | 'sustain' | 'mana' | 'recovery'
>;

function round(value: number): number {
  return Number(value.toFixed(2));
}

/** Equal expectation sums can differ by a few ulps; those are not resource deficits. */
function hasMaterialDeficit(value: number | null | undefined): boolean {
  return value != null && value > 1e-9;
}

export function summarizeDescentLevels(
  className: DescentClassName,
  levels: readonly SummaryLevel[],
  townPortalEnabled: boolean,
): BalanceMatrixRow {
  const walls = levels
    .filter((level) => level.expectedDamageTaken === null)
    .map((level) => level.depth);
  const damageAt = (depth: typeof DAMAGE_DEPTHS[number]) =>
    levels.find((level) => level.depth === depth)?.expectedDamageTaken ?? null;
  const finiteDamage = levels.flatMap((level) =>
    level.expectedDamageTaken === null ? [] : [level.expectedDamageTaken]);
  const finiteSeconds = levels.flatMap((level) =>
    level.expectedSecondsToClear === null ? [] : [level.expectedSecondsToClear]);

  return {
    className,
    walls,
    firstWall: walls[0] ?? null,
    totalDamageFiniteDepths: round(finiteDamage.reduce((sum, value) => sum + value, 0)),
    damageByDepth: {
      4: damageAt(4) === null ? null : round(damageAt(4)!),
      8: damageAt(8) === null ? null : round(damageAt(8)!),
      12: damageAt(12) === null ? null : round(damageAt(12)!),
      16: damageAt(16) === null ? null : round(damageAt(16)!),
    },
    totalClearSecondsFiniteDepths: round(finiteSeconds.reduce((sum, value) => sum + value, 0)),
    lifeDeficitDepths: levels
      .filter((level) => hasMaterialDeficit(level.sustain?.deficit))
      .map((level) => level.depth),
    manaDeficitDepths: levels
      .filter((level) => hasMaterialDeficit(level.mana?.deficit))
      .map((level) => level.depth),
    townPortalLethalDepths: townPortalEnabled
      ? levels
          .filter((level) => level.recovery?.engagementSurvivable === false)
          .map((level) => level.depth)
      : null,
  };
}

function formatNumber(value: number | null): string {
  return value === null
    ? '—'
    : new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

function formatDepths(depths: readonly number[]): string {
  return depths.length === 0 ? '—' : depths.join(', ');
}

export function formatMatrixMarkdown(report: BalanceMatrixReport): string {
  const sections = report.presets.map((preset) => {
    const townPortal = preset.rows.some((row) => row.townPortalLethalDepths !== null);
    const headings = [
      'class', 'walls', 'first wall', 'damage d1–16', 'd4', 'd8', 'd12', 'd16',
      'clear seconds', 'life deficit', 'mana deficit',
      ...(townPortal ? ['TP-lethal'] : []),
    ];
    const divider = headings.map(() => '---');
    const rows = preset.rows.map((row) => [
      row.className,
      formatDepths(row.walls),
      formatNumber(row.firstWall),
      formatNumber(row.totalDamageFiniteDepths),
      ...DAMAGE_DEPTHS.map((depth) => formatNumber(row.damageByDepth[depth])),
      formatNumber(row.totalClearSecondsFiniteDepths),
      formatDepths(row.lifeDeficitDepths),
      formatDepths(row.manaDeficitDepths),
      ...(townPortal ? [formatDepths(row.townPortalLethalDepths ?? [])] : []),
    ]);
    return [
      `## ${preset.name}`,
      '',
      `Flags: ${preset.flags.length === 0 ? '(none)' : `\`${preset.flags.join(' ')}\``}`,
      '',
      `| ${headings.join(' | ')} |`,
      `| ${divider.join(' | ')} |`,
      ...rows.map((row) => `| ${row.join(' | ')} |`),
    ].join('\n');
  });
  return [
    '# Diablo I balance matrix',
    '',
    'Policy: balanced · gear: expected · difficulty: normal',
    '',
    ...sections.flatMap((section, index) => index === 0 ? [section] : ['', section]),
    '',
    `Runtime: ${(report.runtimeMs / 1000).toFixed(2)} seconds`,
    '',
  ].join('\n');
}

export interface BalanceMatrixDiffRow {
  preset: string;
  className: DescentClassName;
  wallsGained: number[];
  wallsLost: number[];
  totalDamageDeltaPercent: number | null;
  damageDeltaPercentByDepth: DamageByDepth;
}

export interface BalanceMatrixDiff {
  schemaVersion: 1;
  beforeGeneratedAt: string;
  afterGeneratedAt: string;
  rows: BalanceMatrixDiffRow[];
}

function percentageDelta(before: number | null, after: number | null): number | null {
  if (before === null || after === null) return null;
  if (before === 0) return after === 0 ? 0 : null;
  return round(((after - before) / Math.abs(before)) * 100);
}

export function compareMatrixReports(
  before: BalanceMatrixReport,
  after: BalanceMatrixReport,
): BalanceMatrixDiff {
  const rows = before.presets.flatMap((beforePreset) => {
    const afterPreset = after.presets.find((preset) => preset.name === beforePreset.name);
    if (!afterPreset) throw new Error(`after matrix has no preset ${beforePreset.name}`);
    return beforePreset.rows.map((beforeRow) => {
      const afterRow = afterPreset.rows.find((row) => row.className === beforeRow.className);
      if (!afterRow) {
        throw new Error(`after matrix has no ${beforePreset.name}/${beforeRow.className} row`);
      }
      return {
        preset: beforePreset.name,
        className: beforeRow.className,
        wallsGained: afterRow.walls.filter((depth) => !beforeRow.walls.includes(depth)),
        wallsLost: beforeRow.walls.filter((depth) => !afterRow.walls.includes(depth)),
        totalDamageDeltaPercent: percentageDelta(
          beforeRow.totalDamageFiniteDepths,
          afterRow.totalDamageFiniteDepths,
        ),
        damageDeltaPercentByDepth: {
          4: percentageDelta(beforeRow.damageByDepth[4], afterRow.damageByDepth[4]),
          8: percentageDelta(beforeRow.damageByDepth[8], afterRow.damageByDepth[8]),
          12: percentageDelta(beforeRow.damageByDepth[12], afterRow.damageByDepth[12]),
          16: percentageDelta(beforeRow.damageByDepth[16], afterRow.damageByDepth[16]),
        },
      };
    });
  });
  return {
    schemaVersion: 1,
    beforeGeneratedAt: before.generatedAt,
    afterGeneratedAt: after.generatedAt,
    rows,
  };
}

function formatPercent(value: number | null): string {
  return value === null ? 'n/a' : `${value >= 0 ? '+' : ''}${formatNumber(value)}%`;
}

export function formatDiffMarkdown(diff: BalanceMatrixDiff): string {
  const headings = [
    'preset', 'class', 'walls gained', 'walls lost', 'total damage Δ',
    'd4 Δ', 'd8 Δ', 'd12 Δ', 'd16 Δ',
  ];
  return [
    '# Diablo I balance matrix comparison',
    '',
    `Before: ${diff.beforeGeneratedAt} · after: ${diff.afterGeneratedAt}`,
    '',
    `| ${headings.join(' | ')} |`,
    `| ${headings.map(() => '---').join(' | ')} |`,
    ...diff.rows.map((row) => `| ${[
      row.preset,
      row.className,
      formatDepths(row.wallsGained),
      formatDepths(row.wallsLost),
      formatPercent(row.totalDamageDeltaPercent),
      ...DAMAGE_DEPTHS.map((depth) => formatPercent(row.damageDeltaPercentByDepth[depth])),
    ].join(' | ')} |`),
    '',
  ].join('\n');
}

function arg(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1] : undefined;
}

function writeReport(outputDirectory: string, report: BalanceMatrixReport): void {
  mkdirSync(outputDirectory, { recursive: true });
  writeFileSync(join(outputDirectory, 'balance-matrix.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(outputDirectory, 'balance-matrix.md'), formatMatrixMarkdown(report));
}

export async function runBalanceMatrix(
  outputDirectory: string,
  concurrency = 1,
  wrappers: readonly ReferenceWrapper[] = loadDescentWrappers(),
): Promise<BalanceMatrixReport> {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error('--concurrency must be a positive integer');
  }
  const startedAt = Date.now();
  const report: BalanceMatrixReport = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    policy: 'balanced',
    gear: 'expected',
    runtimeMs: 0,
    presets: BALANCE_PRESETS.map((preset) => ({
      name: preset.name,
      flags: [...preset.flags],
      rows: [],
    })),
  };
  writeReport(outputDirectory, report);

  const tasks = BALANCE_PRESETS.flatMap((preset, presetIndex) =>
    DESCENT_CLASSES.map((className) => ({ preset, presetIndex, className })));
  let nextTask = 0;
  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
    while (nextTask < tasks.length) {
      const task = tasks[nextTask++];
      await Promise.resolve();
      const simulationInput = assembleDescentInput({
        className: task.className,
        policy: 'balanced',
        gear: 'expected',
        sorcererCombatPolicy: 'mixed',
        ...task.preset.input,
      }, ['node', 'scripts/diablo/balanceMatrix.ts'], wrappers);
      const result = simulateDescent({ ...simulationInput, difficulty: 'normal' });
      report.presets[task.presetIndex].rows.push(summarizeDescentLevels(
        task.className,
        result.levels,
        task.preset.input.recovery === 'town-portal',
      ));
      report.presets[task.presetIndex].rows.sort((left, right) =>
        DESCENT_CLASSES.indexOf(left.className) - DESCENT_CLASSES.indexOf(right.className));
      report.runtimeMs = Date.now() - startedAt;
      writeReport(outputDirectory, report);
      console.error(
        `[${nextTask}/${tasks.length}] ${task.preset.name}/${task.className} `
        + `(${(report.runtimeMs / 1000).toFixed(1)}s)`,
      );
    }
  });
  await Promise.all(workers);
  report.runtimeMs = Date.now() - startedAt;
  writeReport(outputDirectory, report);
  return report;
}

function resolvedOutputDirectory(argv: readonly string[]): string {
  const requested = arg(argv, 'out');
  if (!requested) return mkdtempSync(join(tmpdir(), 'pof-balance-matrix-'));
  return isAbsolute(requested) ? requested : resolve(requested);
}

async function main(argv: readonly string[]): Promise<void> {
  const compareIndex = argv.indexOf('--compare');
  if (compareIndex >= 0) {
    const beforePath = argv[compareIndex + 1];
    const afterPath = argv[compareIndex + 2];
    if (!beforePath || !afterPath || beforePath.startsWith('--') || afterPath.startsWith('--')) {
      throw new Error('--compare requires <before.json> <after.json>');
    }
    const before = JSON.parse(readFileSync(beforePath, 'utf8')) as BalanceMatrixReport;
    const after = JSON.parse(readFileSync(afterPath, 'utf8')) as BalanceMatrixReport;
    const diff = compareMatrixReports(before, after);
    const markdown = formatDiffMarkdown(diff);
    const requestedOutput = arg(argv, 'out');
    if (requestedOutput) {
      const outputDirectory = resolvedOutputDirectory(argv);
      mkdirSync(outputDirectory, { recursive: true });
      writeFileSync(join(outputDirectory, 'balance-matrix-compare.json'), `${JSON.stringify(diff, null, 2)}\n`);
      writeFileSync(join(outputDirectory, 'balance-matrix-compare.md'), markdown);
    }
    process.stdout.write(markdown);
    return;
  }

  const concurrency = Number(arg(argv, 'concurrency') ?? 1);
  const outputDirectory = resolvedOutputDirectory(argv);
  const report = await runBalanceMatrix(outputDirectory, concurrency);
  process.stdout.write(formatMatrixMarkdown(report));
  console.error(`JSON → ${join(outputDirectory, 'balance-matrix.json')}`);
  console.error(`Markdown → ${join(outputDirectory, 'balance-matrix.md')}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
