import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  EQS_ATTACK_POSITIONS,
  EQS_PATROL_POINTS,
  EQS_COVER_POSITIONS,
  EQS_LINE_OF_SIGHT,
  EQS_ELEVATION_ADVANTAGE,
  eqsFloat,
  eqsClampMeta,
} from '@/lib/ai-director/eqs-defaults';

// These guard the single-source EQS UPROPERTY defaults: every view + data table
// reads from here, so a typo would silently desync the engine docs.

describe('EQS default values mirror the C++ UPROPERTY defaults', () => {
  it('UEnvQueryGenerator_AttackPositions', () => {
    expect(EQS_ATTACK_POSITIONS.attackDistance).toBe(200);
    expect(EQS_ATTACK_POSITIONS.numberOfPoints).toBe(12);
    expect(EQS_ATTACK_POSITIONS.generateInnerRing).toBe(false);
    expect(EQS_ATTACK_POSITIONS.projection).toEqual({ down: 500, up: 100 });
    expect(EQS_ATTACK_POSITIONS.clamps.numberOfPoints).toEqual({ min: 4, max: 36 });
    expect(EQS_ATTACK_POSITIONS.clamps.attackDistance).toEqual({ min: 50 });
  });

  it('UEnvQueryGenerator_PatrolPoints', () => {
    expect(EQS_PATROL_POINTS.numberOfPoints).toBe(15);
    expect(EQS_PATROL_POINTS.minRadius).toBe(500);
    expect(EQS_PATROL_POINTS.maxRadius).toBe(1500);
  });

  it('UEnvQueryGenerator_CoverPositions', () => {
    expect(EQS_COVER_POSITIONS.sampleCount).toBe(36);
    expect(EQS_COVER_POSITIONS.minRadius).toBe(300);
    expect(EQS_COVER_POSITIONS.maxRadius).toBe(1200);
    expect(EQS_COVER_POSITIONS.numberOfRings).toBe(3);
    expect(EQS_COVER_POSITIONS.coverCheckDistance).toBe(150);
  });

  it('UEnvQueryTest_LineOfSight', () => {
    expect(EQS_LINE_OF_SIGHT.numberOfTraceHeights).toBe(3);
    expect(EQS_LINE_OF_SIGHT.minTraceHeight).toBe(40);
    expect(EQS_LINE_OF_SIGHT.maxTraceHeight).toBe(170);
  });

  it('UEnvQueryTest_ElevationAdvantage', () => {
    expect(EQS_ELEVATION_ADVANTAGE.maxElevationBonus).toBe(300);
    expect(EQS_ELEVATION_ADVANTAGE.penalizeLowGround).toBe(false);
  });
});

describe('eqsFloat', () => {
  it('renders integers with a trailing .0 like C++ source', () => {
    expect(eqsFloat(200)).toBe('200.0');
    expect(eqsFloat(1500)).toBe('1500.0');
    expect(eqsFloat(0)).toBe('0.0');
  });

  it('leaves non-integer values as-is', () => {
    expect(eqsFloat(1.5)).toBe('1.5');
  });
});

describe('eqsClampMeta', () => {
  it('renders both bounds', () => {
    expect(eqsClampMeta({ min: 4, max: 36 })).toBe('ClampMin = 4, ClampMax = 36');
  });

  it('renders a single bound', () => {
    expect(eqsClampMeta({ min: 50 })).toBe('ClampMin = 50');
    expect(eqsClampMeta({ max: 72 })).toBe('ClampMax = 72');
  });

  it('renders an empty string when neither bound is set', () => {
    expect(eqsClampMeta({})).toBe('');
  });

  it('matches the inventory meta strings derived from the defaults', () => {
    expect(eqsClampMeta(EQS_COVER_POSITIONS.clamps.sampleCount)).toBe('ClampMin = 8, ClampMax = 72');
    expect(eqsClampMeta(EQS_PATROL_POINTS.clamps.minRadius)).toBe('ClampMin = 0');
  });
});

describe('views read EQS defaults instead of hand literals', () => {
  const root = join(__dirname, '../../../components/modules/game-systems');
  const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const read = (rel: string) => strip(readFileSync(join(root, rel), 'utf8'));

  it('no literal PenalizeLowGround default in the pipeline diagram or inventory', () => {
    expect(read('EQSPipelineDiagram/constants.ts')).not.toMatch(/PenalizeLowGround'[^}]*value:\s*'(true|false)'/);
    expect(read('EQSComponentInventory/eqsComponents.ts')).not.toMatch(/bPenalizeLowGround'[\s\S]{0,80}defaultValue:\s*'(true|false)'/);
  });

  it('no literal nav projection numbers in the attack ring constants', () => {
    expect(read('AttackRingVisualizer/constants.ts')).not.toMatch(/PROJECT_(DOWN|UP)\s*=\s*\d/);
  });
});

