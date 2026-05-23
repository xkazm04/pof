import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, utimesSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parseAutomationLog,
  pickNewestScreenshot,
  resolveGeminiPrompt,
  buildGeminiArgs,
} from './verification-core';

describe('parseAutomationLog', () => {
  it('extracts passed assertions and reports success', () => {
    const log = [
      'LogTemp: VSFunctionalTest: Assertion passed (#2 movement: player should have moved >50cm, moved 531.9cm)',
      'LogTemp: VSFunctionalTest: Assertion passed (#3 attack activation: melee ability should have activated)',
      'LogAutomationController: Test Completed. Result={Success} Name={VSFunctionalTest}',
    ].join('\n');
    const r = parseAutomationLog(log);
    expect(r.success).toBe(true);
    expect(r.criteria).toHaveLength(2);
    expect(r.criteria[0]).toEqual({ message: '#2 movement: player should have moved >50cm, moved 531.9cm', passed: true });
  });

  it('reports failure when an assertion failed even if a Success line is absent', () => {
    const log = [
      'VSFunctionalTest: Assertion passed (#2 movement: moved 531.9cm)',
      'VSFunctionalTest: Assertion failed (#4 damage: enemy Health should be < 100, is 100.0)',
      'LogAutomationController: Result={Failed}',
    ].join('\n');
    const r = parseAutomationLog(log);
    expect(r.success).toBe(false);
    expect(r.criteria.filter((c) => !c.passed)).toHaveLength(1);
  });

  it('does NOT report success on Result={Success} if any assertion failed (anti-gaming guard)', () => {
    const log = [
      'VSFunctionalTest: Assertion failed (#5 loot: expected >= 1, found 0)',
      'LogAutomationController: Result={Success}',
    ].join('\n');
    expect(parseAutomationLog(log).success).toBe(false);
  });

  it('reports failure when neither a Success line nor assertions are present', () => {
    expect(parseAutomationLog('LogTemp: nothing happened').success).toBe(false);
  });
});

describe('pickNewestScreenshot', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'shots-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('returns null for an empty / missing dir', () => {
    expect(pickNewestScreenshot(join(dir, 'nope'))).toBeNull();
    expect(pickNewestScreenshot(dir)).toBeNull();
  });

  it('returns the newest .png by mtime, ignoring non-png', () => {
    const old = join(dir, 'a.png');
    const recent = join(dir, 'b.png');
    writeFileSync(old, 'x'); writeFileSync(recent, 'y'); writeFileSync(join(dir, 'c.txt'), 'z');
    utimesSync(old, new Date(1000), new Date(1000));
    utimesSync(recent, new Date(2000), new Date(2000));
    expect(pickNewestScreenshot(dir)).toBe(recent);
  });
});

describe('resolveGeminiPrompt', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'prompts-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('reads a fixture file when the name matches', () => {
    writeFileSync(join(dir, 'hud-check.txt'), 'Is there a health bar?\n');
    expect(resolveGeminiPrompt('hud-check', dir)).toBe('Is there a health bar?');
  });

  it('treats a free-text prompt as literal', () => {
    expect(resolveGeminiPrompt('Describe the scene please', dir)).toBe('Describe the scene please');
  });

  it('falls back to literal when a name has no fixture file', () => {
    expect(resolveGeminiPrompt('no-such-fixture', dir)).toBe('no-such-fixture');
  });
});

describe('buildGeminiArgs', () => {
  it('builds the CLI argv', () => {
    expect(buildGeminiArgs('/tools/gemini.mjs', '/shot.png', 'is it red?')).toEqual([
      '/tools/gemini.mjs', '--input', '/shot.png', '--prompt', 'is it red?',
    ]);
  });
});
