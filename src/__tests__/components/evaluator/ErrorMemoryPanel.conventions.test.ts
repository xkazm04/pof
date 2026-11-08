/**
 * scan-sweep (cross-module-features/B): ErrorMemoryPanel followed neither the
 * motion nor the colour convention - a literal `duration: 0.4` (not a MOTION
 * token, not reduced-motion aware) and a raw `text-amber-400` palette class.
 * Source scan with comments stripped.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FILE = join(process.cwd(), 'src/components/modules/evaluator/ErrorMemoryPanel.tsx');
const src = readFileSync(FILE, 'utf-8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('ErrorMemoryPanel conventions', () => {
  it('has no numeric duration literal and no raw status palette class', () => {
    const durations = src.match(/duration:\s*[0-9.]+/g) ?? [];
    const palette = src.match(/text-(red|amber|green)-\d+/g) ?? [];
    expect({ durations, palette }).toEqual({ durations: [], palette: [] });
  });

  it('routes the bar transition through motionSafe + a DURATION token', () => {
    expect(src).toMatch(/motionSafe\(/);
    expect(src).toMatch(/MOTION\.slow/);
  });
});
