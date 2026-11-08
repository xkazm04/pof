import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { THREAT_CUTS } from '@/lib/combat/simulation-engine';

// ThreatRow's "top threat" highlight and suggestAbilityNerf's 'Headline killer' /
// 'Spammed source' are one rule. Independent literals in two files let one drift;
// both sides must read the engine's exported THREAT_CUTS.

const ROOT = process.cwd();
const ENGINE = 'src/lib/combat/simulation-engine.ts';
const PANEL = 'src/components/modules/evaluator/CombatSimulatorView/ThreatBreakdownPanel.tsx';

function code(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const RESTATED = /killShare\s*>=\s*0\.4\b|damageShare\s*>=\s*0\.3\b/g;

function restated(src: string): number {
  return (src.match(RESTATED) ?? []).length;
}

describe('threat cuts are one shared definition', () => {
  it('the engine exports the cuts', () => {
    expect(THREAT_CUTS).toEqual({ headlineKill: 0.4, spammedDamage: 0.3 });
  });

  it('neither file restates the cut as an inline comparison', () => {
    expect(restated(code(ENGINE)) + restated(code(PANEL))).toBe(0);
  });

  it('both sides read THREAT_CUTS', () => {
    expect(code(ENGINE)).toMatch(/killShare\s*>=\s*THREAT_CUTS\.headlineKill/);
    expect(code(ENGINE)).toMatch(/damageShare\s*>=\s*THREAT_CUTS\.spammedDamage/);
    expect(code(PANEL)).toMatch(/THREAT_CUTS\.headlineKill/);
    expect(code(PANEL)).toMatch(/THREAT_CUTS\.spammedDamage/);
  });
});
