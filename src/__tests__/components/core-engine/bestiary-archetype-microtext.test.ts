/**
 * The bestiary breadcrumb and BT rows were raised to the legibility floor earlier
 * (bestiary-microtext.test.tsx); the archetype card, its expanded details and the radar
 * overlay list still carried arbitrary sub-floor sizes (text-[9px] x2, text-[10px] x1)
 * and opacity-dimmed text (opacity-50/60 x3), which compounds below WCAG AA 1.4.3.
 * Comments are stripped before matching so a file that only talks about the rule
 * cannot satisfy it.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.join(process.cwd(), 'src/components/modules/core-engine/sub_bestiary/archetypes');
const read = (f: string) => fs.readFileSync(path.join(DIR, f), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '');

const ARBITRARY_PX = /text-\[\d+px\]/g;
const DIMMED_TEXT = /\bopacity-(?:40|50|60)\b/g;

describe('bestiary archetype micro-text', () => {
  for (const f of ['ArchetypeCard.tsx', 'ExpandedDetails.tsx', 'RadarComparison.tsx']) {
    it(`${f}: no arbitrary px font sizes`, () => {
      expect(read(f).match(ARBITRARY_PX) ?? []).toEqual([]);
    });
  }

  it('ExpandedDetails.tsx: no opacity-dimmed text', () => {
    expect(read('ExpandedDetails.tsx').match(DIMMED_TEXT) ?? []).toEqual([]);
  });
});
