import { describe, it, expect } from 'vitest';
import {
  difficultyBand,
  bandSeverity,
  fightLengthBand,
  fightLengthSeverity,
  survivalTone,
  isFlaggedSeverity,
  SURVIVAL_TARGET,
  TTK_TARGET_SEC,
  SURVIVAL_BAND_CUTS,
  FIGHT_LENGTH_CUTS,
} from '@/lib/balance/encounter-bands';
import { STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR } from '@/lib/chart-colors';

describe('difficultyBand — the registry survival banding, written once', () => {
  it.each([
    [1, 'easy'],
    [0.9, 'easy'],
    [0.8999, 'fair'],
    [0.6, 'fair'],
    [0.5999, 'tough'],
    [0.35, 'tough'],
    [0.3499, 'brutal'],
    [0, 'brutal'],
  ] as const)('survival %s -> %s', (rate, band) => {
    expect(difficultyBand(rate)).toBe(band);
  });

  it('keeps the Combat Simulator cuts verbatim (0.9 / 0.6 / 0.35)', () => {
    expect(SURVIVAL_BAND_CUTS).toEqual({ easy: 0.9, fair: 0.6, tough: 0.35 });
  });

  it('the survival target sits inside the fair band', () => {
    expect(SURVIVAL_TARGET).toBe(0.65);
    expect(difficultyBand(SURVIVAL_TARGET)).toBe('fair');
  });
});

describe('bandSeverity — which bands a report flags', () => {
  it('fair is good, easy and tough warn, brutal is critical', () => {
    expect(bandSeverity('fair')).toBe('good');
    expect(bandSeverity('easy')).toBe('warning');
    expect(bandSeverity('tough')).toBe('warning');
    expect(bandSeverity('brutal')).toBe('critical');
  });

  it('isFlaggedSeverity is true exactly for warning and critical', () => {
    expect(isFlaggedSeverity('good')).toBe(false);
    expect(isFlaggedSeverity('warning')).toBe(true);
    expect(isFlaggedSeverity('critical')).toBe(true);
  });
});

describe('fightLengthBand — one fight-length law (instant / healthy / long / stall)', () => {
  it.each([
    [0.5, 'instant'],
    [0.9999, 'instant'],
    [1, 'healthy'],
    [4, 'healthy'],
    [20, 'healthy'],
    [20.01, 'long'],
    [45, 'long'],
    [45.01, 'stall'],
    [70, 'stall'],
  ] as const)('mean TTK %ss -> %s', (ttk, band) => {
    expect(fightLengthBand(ttk)).toBe(band);
  });

  it('keeps the report cuts (1s / 20s / 45s) and a 4s target inside healthy', () => {
    expect(FIGHT_LENGTH_CUTS).toEqual({ instant: 1, long: 20, stall: 45 });
    expect(TTK_TARGET_SEC).toBe(4);
    expect(fightLengthBand(TTK_TARGET_SEC)).toBe('healthy');
  });

  it('severity: healthy good, instant/long warning, stall critical', () => {
    expect(fightLengthSeverity('healthy')).toBe('good');
    expect(fightLengthSeverity('instant')).toBe('warning');
    expect(fightLengthSeverity('long')).toBe('warning');
    expect(fightLengthSeverity('stall')).toBe('critical');
  });
});

describe('survivalTone — the colour every survival badge renders', () => {
  it('0.55 is the tough band tone (warning), not green', () => {
    expect(survivalTone(0.55)).toBe(STATUS_WARNING);
  });

  it('fair is success, brutal is error, easy warns', () => {
    expect(survivalTone(0.7)).toBe(STATUS_SUCCESS);
    expect(survivalTone(0.2)).toBe(STATUS_ERROR);
    expect(survivalTone(0.96)).toBe(STATUS_WARNING);
  });
});
