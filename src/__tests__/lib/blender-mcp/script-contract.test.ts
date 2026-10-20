import { describe, it, expect } from 'vitest';
import { py, pyNum, pyJson } from '@/lib/blender-mcp/escape';
import { readReceipt } from '@/lib/blender-mcp/receipt';
import { levelMetadataScript } from '@/lib/blender-mcp/scripts/level-metadata';
import { levelBlockoutScript } from '@/lib/blender-mcp/scripts/level-blockout';
import { nlaStateMachineScript } from '@/lib/blender-mcp/scripts/nla-state-machine';
import { scatterVegetationScript } from '@/lib/blender-mcp/scripts/scatter-vegetation';
import { compositorStackScript } from '@/lib/blender-mcp/scripts/compositor-stack';
import { SCRIPT_CATALOG } from '@/lib/blender-mcp/scripts/catalog';
import { printedReceipt } from './printedReceipt';

/** Decode the first Python double-quoted string literal in `src` (handles \ \" \n \r). */
function firstPyString(src: string, from = 0): { value: string; end: number } {
  const start = src.indexOf('"', from);
  let out = '';
  let i = start + 1;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '\n') throw new Error('bare newline inside a Python string literal');
    if (c === '"') return { value: out, end: i + 1 };
    if (c === '\\') {
      const n = src[++i];
      out += n === 'n' ? '\n' : n === 'r' ? '\r' : n;
    } else out += c;
  }
  throw new Error('unterminated Python string literal');
}

const HOSTILE = 'a"b\\c\'d\ne';

describe('pyNum', () => {
  it('rejects non-finite numbers and passes finite ones', () => {
    expect(() => pyNum(NaN)).toThrow(RangeError);
    expect(() => pyNum(Infinity)).toThrow(RangeError);
    expect(pyNum(0.25)).toBe('0.25');
  });
});

describe('pyJson', () => {
  it('round-trips a hostile string through a Python literal', () => {
    const expr = pyJson({ s: HOSTILE });
    const { value } = firstPyString(expr, expr.indexOf('loads('));
    expect(JSON.parse(value)).toEqual({ s: HOSTILE });
  });
});

describe('emitters escape user text', () => {
  it('level metadata keeps a spawn type on one line', () => {
    const code = levelMetadataScript({ spawnPoints: [{ x: 1, y: 2, type: 'a"\nimport os' }] });
    expect(code.split(/\r?\n/).some((l) => l.startsWith('import os'))).toBe(false);
    expect(code).toContain(`Spawn_${py('a"\nimport os')}_0`);
  });

  it('level blockout and NLA names never inject a statement', () => {
    const name = 'x\nimport os';
    const room = levelBlockoutScript({
      rooms: [{ id: 'r', name, type: name, x: 0, y: 0, width: 2, height: 2, color: [1, 1, 1] }],
      wallHeight: 3,
    });
    const nla = nlaStateMachineScript({
      armatureName: 'A',
      states: [{ name, type: name, frameStart: 1, frameEnd: 5 }],
    });
    for (const code of [room, nla]) {
      expect(code.split(/\r?\n/).some((l) => l.trimStart().startsWith('import os'))).toBe(false);
    }
  });

  it('scatter vegetation JSON round-trips with quotes and backslashes', () => {
    const names = { s1: 'Oak "big" \\ tree' };
    const code = scatterVegetationScript({
      points: [{ x: 0, y: 0, speciesId: 's1', rotation: 0, scale: 1 }],
      speciesNames: names,
    });
    const at = code.indexOf('loads(', code.indexOf('species = '));
    const { value } = firstPyString(code, at);
    expect(JSON.parse(value)).toEqual(names);
  });

  it('compositor bloom uses all three fields and ends in a receipt', () => {
    const code = compositorStackScript({ bloom: { intensity: 2, threshold: 0.8, radius: 6 } });
    expect(code).toContain('glare.threshold = 0.8');
    expect(code).toMatch(/glare\.size = 6\b/);
    expect(code).toMatch(/glare\.mix = /);
    expect(code.trimEnd().split('\n').pop()).toContain('"kind": "compositor"');
    expect(code).toContain('"stages"');
  });
});

describe('SCRIPT_CATALOG', () => {
  it('has the receipted emitters', () => {
    expect(SCRIPT_CATALOG.length).toBeGreaterThanOrEqual(10);
  });

  for (const entry of SCRIPT_CATALOG) {
    it(`${entry.id}: last statement is a ${entry.receiptKind} receipt that confirms`, () => {
      const code = entry.build();
      const last = code.trimEnd().split(/\r?\n/).pop() ?? '';
      expect(last).toContain('POF_RESULT=');
      const out = printedReceipt(code, entry.values);
      expect(readReceipt(out, entry.receiptKind).state).toBe('confirmed');
    });
  }

  it('prose-only output is unconfirmed', () => {
    for (const entry of SCRIPT_CATALOG) {
      expect(readReceipt('Created something: 3 objects', entry.receiptKind).state).toBe('unconfirmed');
    }
  });
});
