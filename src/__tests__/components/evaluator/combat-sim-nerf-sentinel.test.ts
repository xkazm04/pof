import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NO_NERF_NEEDED } from '@/lib/combat/simulation-engine';

// The engine's "no nerf needed" suggestion and the view's "hide the nerf hint" check
// are two sides of one rule. A string literal on each side lets a wording edit on one
// side silently put a nerf hint on every row; one exported constant makes them agree.

const ROOT = process.cwd();
const ENGINE = 'src/lib/combat/simulation-engine.ts';
const PANEL = 'src/components/modules/evaluator/CombatSimulatorView/ThreatBreakdownPanel.tsx';

function code(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function literalCount(src: string): number {
  return src.split('Within tolerance.').length - 1;
}

describe('nerf-suggestion sentinel is one shared constant', () => {
  it('the engine exports the sentinel', () => {
    expect(NO_NERF_NEEDED).toBe('Within tolerance.');
  });

  it('the literal is defined once in the engine and never repeated', () => {
    expect(literalCount(code(ENGINE))).toBe(1);
  });

  it('the panel compares against the shared constant, not its own literal', () => {
    const panel = code(PANEL);
    expect(literalCount(panel)).toBe(0);
    expect(panel).toMatch(/NO_NERF_NEEDED/);
  });
});
