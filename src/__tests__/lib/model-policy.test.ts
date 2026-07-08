import { describe, it, expect } from 'vitest';
import { buildCliArgs } from '@/lib/claude-terminal/cli-service';
import { DEFAULT_POLICY, MODEL_IDS, TASK_CLASSES } from '@/lib/model-policy';

describe('buildCliArgs — model/effort wiring (WS0)', () => {
  it('off-state is byte-for-byte the long-standing base args', () => {
    expect(buildCliArgs()).toEqual(['-p', '-', '--output-format', 'stream-json', '--verbose', '--dangerously-skip-permissions']);
  });

  it('appends --model and --effort when the policy pins them', () => {
    const args = buildCliArgs({ model: 'opus', effort: 'high' });
    expect(args).toContain('--model');
    expect(args[args.indexOf('--model') + 1]).toBe('opus');
    expect(args).toContain('--effort');
    expect(args[args.indexOf('--effort') + 1]).toBe('high');
  });

  it('model/effort compose with resume + mcp without disturbing the base', () => {
    const args = buildCliArgs({ resumeSessionId: 'abc', model: 'sonnet', effort: 'low' });
    expect(args.slice(0, 6)).toEqual(['-p', '-', '--output-format', 'stream-json', '--verbose', '--dangerously-skip-permissions']);
    expect(args).toContain('--resume');
    expect(args).toContain('--model');
  });
});

describe('model policy registry (WS0)', () => {
  it('every task class has a seed default with a valid model + effort', () => {
    for (const tc of TASK_CLASSES) {
      const c = DEFAULT_POLICY[tc];
      expect(['haiku', 'sonnet', 'opus', 'fable']).toContain(c.model);
      expect(['low', 'medium', 'high', 'xhigh', 'max']).toContain(c.effort);
    }
  });

  it('judging defaults to the strongest instrument (opus/high)', () => {
    expect(DEFAULT_POLICY['judge-content']).toEqual({ model: 'opus', effort: 'high' });
    expect(DEFAULT_POLICY['judge-visual']).toEqual({ model: 'opus', effort: 'high' });
  });

  it('every model alias maps to a full CLI id', () => {
    for (const m of ['haiku', 'sonnet', 'opus', 'fable'] as const) {
      expect(MODEL_IDS[m]).toMatch(/^claude-/);
    }
  });
});
