/**
 * Timing values in the Scan tab hook come from UI_TIMEOUTS (repo convention,
 * CLAUDE.md "Timing Constants"). Source scan with comments stripped first, so a
 * comment that mentions "3s" cannot satisfy or trip the check.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(process.cwd(), 'src/components/modules/core-engine/ScanTab/useScanTab.ts');

function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** The delay argument (text after the last top-level comma) of every setTimeout/setInterval call. */
function timerDelays(code: string): string[] {
  const out: string[] = [];
  const opener = /set(?:Timeout|Interval)\(/g;
  let m: RegExpExecArray | null;
  while ((m = opener.exec(code)) !== null) {
    let depth = 1; let i = m.index + m[0].length; let lastComma = -1;
    for (; i < code.length && depth > 0; i++) {
      const c = code[i];
      if (c === '(' || c === '{' || c === '[') depth++;
      else if (c === ')' || c === '}' || c === ']') depth--;
      else if (c === ',' && depth === 1) lastComma = i;
    }
    if (lastComma >= 0) out.push(code.slice(lastComma + 1, i - 1).trim());
  }
  return out;
}
const isLiteral = (arg: string) => /^\d+$/.test(arg);

describe('useScanTab timing constants', () => {
  it('no timer is armed with a numeric literal delay', () => {
    const delays = timerDelays(stripComments(readFileSync(SRC, 'utf8')));
    expect(delays.length).toBeGreaterThan(0);
    expect(delays.filter(isLiteral)).toEqual([]);
  });

  it('control: the matcher bites on a literal delay', () => {
    expect(timerDelays('x = setInterval(() => { void f(); }, 3000);').filter(isLiteral)).toEqual(['3000']);
    expect(timerDelays('x = setInterval(() => { void f(); }, UI_TIMEOUTS.pollInterval);').filter(isLiteral)).toEqual([]);
  });
});
