import { describe, it, expect } from 'vitest';
import { buildCliArgs } from '@/lib/claude-terminal/cli-service';
import {
  DEFAULT_POLICY, MODEL_IDS, TASK_CLASSES,
  isModel, isEffort, isTaskClass, taskClassForDispatchType, resolveDispatchModelChoice,
} from '@/lib/model-policy';

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

describe('live-dispatch model wiring (WS0)', () => {
  it('validators only accept known values', () => {
    expect(isModel('opus')).toBe(true);
    expect(isModel('gpt-4')).toBe(false);
    expect(isEffort('high')).toBe(true);
    expect(isEffort('turbo')).toBe(false);
    expect(isTaskClass('judge-content')).toBe(true);
    expect(isTaskClass('nonsense')).toBe(false);
  });

  it('maps content-aligned dispatch task types to a policy class', () => {
    expect(taskClassForDispatchType('feature-fix')).toBe('fix-content');
    expect(taskClassForDispatchType('module-scan')).toBe('judge-content');
    expect(taskClassForDispatchType('feature-review')).toBe('judge-content');
    expect(taskClassForDispatchType('generate')).toBe('produce-text');
    expect(taskClassForDispatchType('generate-gas-effects')).toBe('author-ue-test');
    expect(taskClassForDispatchType('run-ai-tests')).toBe('author-ue-test');
  });

  it('leaves interactive / unknown / unmapped task types unpinned (default behaviour)', () => {
    expect(taskClassForDispatchType('interactive')).toBeNull();
    expect(taskClassForDispatchType('ask-claude')).toBeNull();
    expect(taskClassForDispatchType('checklist')).toBeNull();
    expect(taskClassForDispatchType(undefined)).toBeNull();
    expect(taskClassForDispatchType('totally-made-up')).toBeNull();
  });

  it('resolves an explicit valid model/effort override (scripts / autonomous)', () => {
    expect(resolveDispatchModelChoice({ model: 'opus', effort: 'high' })).toEqual({ model: 'opus', effort: 'high' });
  });

  it('drops unknown explicit values and pins nothing when no task type resolves', () => {
    expect(resolveDispatchModelChoice({ model: 'bogus', effort: 'turbo' })).toEqual({});
    expect(resolveDispatchModelChoice({})).toEqual({});
    expect(resolveDispatchModelChoice({ taskType: 'ask-claude' })).toEqual({});
  });

  it('forwards a resolved policy choice into the CLI args', () => {
    // Chain: dispatch type → policy class → default choice → CLI args.
    const cls = taskClassForDispatchType('feature-fix');
    expect(cls).toBe('fix-content');
    const choice = DEFAULT_POLICY[cls!];
    const args = buildCliArgs(choice);
    expect(args[args.indexOf('--model') + 1]).toBe(choice.model);
    expect(args[args.indexOf('--effort') + 1]).toBe(choice.effort);
  });

  it('governs the lab live-produce dispatch, which used to run unpinned', () => {
    // `one-shot-step` is the ONE real CLI produce in the catalog pipeline. Before this
    // mapping it fell through to `default → null`, so it was the only dispatch in the app
    // the Quality Program's model policy did not reach.
    expect(taskClassForDispatchType('one-shot-step')).toBe('produce-text');
    const choice = resolveDispatchModelChoice({ taskType: 'one-shot-step' });
    expect(choice.model).toBeDefined();
    expect(choice.effort).toBeDefined();
    const args = buildCliArgs(choice);
    expect(args).toContain('--model');
    expect(args).toContain('--effort');
  });

  it('unpinned resolution appends no model/effort args', () => {
    const choice = resolveDispatchModelChoice({ taskType: 'checklist' });
    const args = buildCliArgs(choice);
    expect(args).not.toContain('--model');
    expect(args).not.toContain('--effort');
  });
});
