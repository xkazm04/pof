import { describe, it, expect } from 'vitest';
import {
  resolveHarnessMode, resolveUECmd, isUEAvailable, shouldRunUEChecks,
  requiresDevServer, runsGeminiChecks, ciVerificationPlan, fullVerificationPlan,
} from './ci-harness';

describe('resolveHarnessMode', () => {
  it('prefers live, then ci (explicit or CI env), else stub', () => {
    expect(resolveHarnessMode({ HARNESS_MODE: 'live' })).toBe('live');
    expect(resolveHarnessMode({ HARNESS_MODE: 'ci' })).toBe('ci');
    expect(resolveHarnessMode({ CI: 'true' })).toBe('ci');
    expect(resolveHarnessMode({ CI: '1' })).toBe('ci');
    expect(resolveHarnessMode({})).toBe('stub');
  });

  it('live wins even when CI is also set', () => {
    expect(resolveHarnessMode({ HARNESS_MODE: 'live', CI: 'true' })).toBe('live');
  });
});

describe('resolveUECmd / isUEAvailable', () => {
  it('uses POF_UE_CMD override when set', () => {
    expect(resolveUECmd({ POF_UE_CMD: 'X:\\ue.exe' })).toBe('X:\\ue.exe');
  });

  it('isUEAvailable reflects the injected existence check', () => {
    expect(isUEAvailable({ POF_UE_CMD: 'X:\\ue.exe' }, () => true)).toBe(true);
    expect(isUEAvailable({ POF_UE_CMD: 'X:\\ue.exe' }, () => false)).toBe(false);
  });
});

describe('mode gating', () => {
  it('shouldRunUEChecks requires (ci|live) AND a UE install', () => {
    expect(shouldRunUEChecks('ci', true)).toBe(true);
    expect(shouldRunUEChecks('live', true)).toBe(true);
    expect(shouldRunUEChecks('ci', false)).toBe(false);
    expect(shouldRunUEChecks('stub', true)).toBe(false);
  });

  it('CI mode needs no dev server; stub/live do', () => {
    expect(requiresDevServer('ci')).toBe(false);
    expect(requiresDevServer('stub')).toBe(true);
    expect(requiresDevServer('live')).toBe(true);
  });

  it('only live runs Gemini checks', () => {
    expect(runsGeminiChecks('live')).toBe(true);
    expect(runsGeminiChecks('ci')).toBe(false);
    expect(runsGeminiChecks('stub')).toBe(false);
  });
});

describe('verification plans', () => {
  it('CI plan runs HealthCheck first, then the slice test, and no Gemini', () => {
    const plan = ciVerificationPlan();
    expect(plan.functionalTests[0]).toContain('PoF.HealthCheck');
    expect(plan.functionalTests).toHaveLength(2);
    expect(plan.geminiChecks).toEqual([]);
  });

  it('full plan adds a Gemini check per visible system', () => {
    const plan = fullVerificationPlan();
    expect(plan.geminiChecks.map((c) => c.system)).toEqual(
      expect.arrayContaining(['arena', 'characters', 'enemy', 'hud', 'textures']),
    );
    expect(plan.geminiChecks.every((c) => c.fixture.length > 0)).toBe(true);
  });
});
