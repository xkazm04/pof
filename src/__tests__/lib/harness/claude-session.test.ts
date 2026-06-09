import { describe, it, expect } from 'vitest';
import {
  buildClaudeArgs,
  wrapHarnessResult,
  HARNESS_RESULT_START,
  HARNESS_RESULT_END,
  HARNESS_RESULT_REGEX,
} from '@/lib/harness/claude-session';
import { parseAreaResult } from '@/lib/harness/executor';

describe('buildClaudeArgs', () => {
  it('emits the base stream-json invocation with no optional flags', () => {
    expect(buildClaudeArgs({})).toEqual(['-p', '-', '--output-format', 'stream-json']);
  });

  it('reproduces the executor invocation (verbose + skip-perms + allowed tools)', () => {
    // Mirrors the old hand-rolled executeArea args.
    expect(
      buildClaudeArgs({
        verbose: true,
        skipPermissions: true,
        bareMode: false,
        allowedTools: ['Bash', 'Read', 'Edit', 'Write', 'Glob', 'Grep'],
      }),
    ).toEqual([
      '-p', '-', '--output-format', 'stream-json', '--verbose',
      '--dangerously-skip-permissions',
      '--allowedTools', 'Bash,Read,Edit,Write,Glob,Grep',
    ]);
  });

  it('reproduces the self-heal invocation (no verbose, skip-perms + allowed tools)', () => {
    expect(
      buildClaudeArgs({
        skipPermissions: true,
        allowedTools: ['Bash', 'Read', 'Edit', 'Write', 'Glob', 'Grep'],
      }),
    ).toEqual([
      '-p', '-', '--output-format', 'stream-json',
      '--dangerously-skip-permissions',
      '--allowedTools', 'Bash,Read,Edit,Write,Glob,Grep',
    ]);
  });

  it('adds --bare when bareMode is set', () => {
    expect(buildClaudeArgs({ bareMode: true })).toContain('--bare');
  });

  it('omits --allowedTools when the list is empty', () => {
    expect(buildClaudeArgs({ allowedTools: [] })).not.toContain('--allowedTools');
  });
});

describe('@@HARNESS_RESULT marker contract', () => {
  it('wrapHarnessResult fences the body with the start/end sentinels', () => {
    const wrapped = wrapHarnessResult('{"ok":true}');
    expect(wrapped).toBe(`${HARNESS_RESULT_START}\n{"ok":true}\n${HARNESS_RESULT_END}`);
  });

  it('the regex round-trips a wrapped body', () => {
    const match = wrapHarnessResult('{"areaId":"x"}').match(HARNESS_RESULT_REGEX);
    expect(match?.[1].trim()).toBe('{"areaId":"x"}');
  });

  it('parseAreaResult reads a wrapped self-heal payload (the literal both files share)', () => {
    const selfHeal = wrapHarnessResult(
      '{"areaId":"self-heal","completed":true,"features":[],"filesCreated":[],"filesModified":[],"learnings":[],"summary":"Fixed errors"}',
    );
    const parsed = parseAreaResult(`some chatter\n${selfHeal}\ntrailing`);
    expect(parsed).not.toBeNull();
    expect(parsed?.areaId).toBe('self-heal');
    expect(parsed?.completed).toBe(true);
  });

  it('parseAreaResult returns null when the markers are absent', () => {
    expect(parseAreaResult('no markers here')).toBeNull();
  });
});
