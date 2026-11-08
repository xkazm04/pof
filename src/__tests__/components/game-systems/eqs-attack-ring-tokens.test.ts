/**
 * eqs-squad-combat-spatial — the attack-ring viz takes its neutrals from theme
 * tokens, not raw rgba() literals (the no-hex lint rule does not see rgba).
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(__dirname, '../../../components/modules/game-systems/AttackRingVisualizer');
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('AttackRingVisualizer colors', () => {
  const files = readdirSync(DIR).filter((f) => /\.tsx?$/.test(f));

  it('scans the context files', () => {
    expect(files).toContain('AttackRingSvg.tsx');
    expect(files).toContain('AttackRingControls.tsx');
  });

  it('has no raw rgba( literal', () => {
    const offenders = files.filter((f) => /rgba?\(/.test(strip(readFileSync(join(DIR, f), 'utf8'))));
    expect(offenders).toEqual([]);
  });
});
