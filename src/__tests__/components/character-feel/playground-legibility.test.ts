import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src/components/modules/core-engine/sub_character');
const FILES = [
  'movement/MovementStateMachine.tsx',
  'playground/CurveEditor.tsx',
  'playground/canvas-draw.ts',
  'playground/StickFigurePreview.tsx',
];

/** Smallest px size any text in the file declares (Tailwind literal, inline fontSize, canvas font). */
function sizes(src: string): number[] {
  const out: number[] = [];
  for (const m of src.matchAll(/text-\[(\d+)px\]/g)) out.push(Number(m[1]));
  for (const m of src.matchAll(/fontSize:\s*(\d+)/g)) out.push(Number(m[1]));
  for (const m of src.matchAll(/font\s*=\s*'[^']*?(\d+)px/g)) out.push(Number(m[1]));
  return out;
}

/* The movement SVG, curve axes and preview canvas set 8-9px text. The meta tier (10px,
 * TEXT_SCALE.meta) is the floor for dense diagram labels; canvas text is invisible to ESLint. */
describe('Movement / Playground text stays at or above the 10px meta tier', () => {
  for (const f of FILES) {
    it(`${f} declares no text under 10px`, () => {
      const small = sizes(readFileSync(join(ROOT, f), 'utf-8')).filter((n) => n < 10);
      expect(small).toEqual([]);
    });
  }
});
