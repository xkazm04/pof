/**
 * scan-sweep night 2026-11-08 (module-evaluator): review:module talks to the running app,
 * and the app's own absolute origin (`getAppOrigin`, constants.ts) is
 * `http://localhost:${process.env.PORT || '3000'}`. parseArgs receives the env but its
 * default origin was a fixed :3000, so with the app on PORT=3001 the runner probed
 * whatever else held :3000 and refused "the PoF app is not up". `--origin` still wins.
 */
import { describe, it, expect } from 'vitest';
import { parseArgs } from '@/lib/evaluator/review-runner';

const BASE = ['combat', '--project-path', 'C:\\Games\\PoF', '--ue-version', '5.7.3'];

function originOf(argv: string[], env: Record<string, string | undefined>): string | undefined {
  const parsed = parseArgs(argv, env);
  return parsed.ok ? parsed.options.origin : undefined;
}

describe('review-runner default origin follows the app port', () => {
  it('uses env.PORT when no --origin is given', () => {
    expect(originOf(BASE, { PORT: '3001' })).toBe('http://localhost:3001');
  });

  it('falls back to :3000 without PORT, and --origin overrides PORT', () => {
    expect(originOf(BASE, {})).toBe('http://localhost:3000');
    expect(originOf([...BASE, '--origin', 'http://127.0.0.1:4000/'], { PORT: '3001' })).toBe('http://127.0.0.1:4000');
  });

  it('a non-numeric PORT is ignored rather than spliced into the URL', () => {
    expect(originOf(BASE, { PORT: 'abc' })).toBe('http://localhost:3000');
  });
});
