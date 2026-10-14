/**
 * Disqualifier caps (technique: capped-disqualifiers). Two things are pinned here:
 *  1. the cap table matches what each lens file says (count and cap level), and
 *  2. the admission door refuses a gauge that reports a fired disqualifier yet awards a level
 *     above its cap, while leaving every untagged or at/below-cap gauge exactly as before.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { admitCraftGauge } from '@/lib/craft/admission';
import { LENS_IDS, type LensId } from '@/lib/craft/lens-map';
import { LENS_DISQUALIFIER_CAPS, disqualifierCap } from '@/lib/craft/lens-disqualifiers';

const LENS_DIR = join(process.cwd(), 'src/lib/craft/lenses');

/** The disqualifier entries of a lens file, in order, with the cap level each states. */
function parseDisqualifiers(lens: LensId): string[] {
  const text = readFileSync(join(LENS_DIR, `${lens}.md`), 'utf8').replace(/\r\n/g, '\n');
  const start = text.search(/^\**DISQUALIFIERS\b|^\**Disqualifiers\b/m);
  expect(start, `${lens}: no DISQUALIFIERS section`).toBeGreaterThan(-1);
  const rest = text.slice(start);
  const end = rest.search(/\n## /);
  const body = end === -1 ? rest : rest.slice(0, end);
  // Numbered list ("1. ...") or the inline "(1) ...; (2) ..." form.
  const listed = [...body.matchAll(/^(\d+)\.\s+([\s\S]*?)(?=^\d+\.\s|$(?![\s\S]))/gm)].map((m) => m[2]);
  if (listed.length) return listed;
  return body.split(/\(\d+\)\s+/).slice(1);
}

describe('LENS_DISQUALIFIER_CAPS matches the lens files', () => {
  for (const lens of LENS_IDS) {
    it(`${lens}: count and cap level per entry`, () => {
      const entries = parseDisqualifiers(lens);
      expect(LENS_DISQUALIFIER_CAPS[lens].length).toBe(entries.length);
      entries.forEach((e, i) => {
        const m = e.match(/caps? (?:the score |the asset |the artifact )?at (A\d)/i);
        expect(LENS_DISQUALIFIER_CAPS[lens][i], `${lens} #${i + 1}`).toBe(m ? m[1] : 'A1');
      });
    });
  }
});

describe('disqualifierCap', () => {
  it('lowest cap wins and caps do not stack', () => {
    expect(disqualifierCap('vfx', [2, 3, 4])).toEqual({ cap: 'A2', unknown: [] });
    expect(disqualifierCap('vfx', [2, 1])).toEqual({ cap: 'A1', unknown: [] });
    expect(disqualifierCap('vfx', [1, 5, 1])).toEqual({ cap: 'A1', unknown: [] });
  });
  it('reports numbers the lens does not have', () => {
    expect(disqualifierCap('audio', [6, 0, 1.5])).toEqual({ cap: null, unknown: [6, 0, 1.5] });
  });
  it('names no cap when nothing is cited', () => {
    expect(disqualifierCap('audio', [])).toEqual({ cap: null, unknown: [] });
  });
});

const base = { catalogId: 'items', entityId: 'e1', step: 'Stats', lens: 'game-systems-code' as const, lensVersion: 1 };

describe('admitCraftGauge — the cap is enforced at the door', () => {
  it('refuses A3 when a finding reports a fired A1 disqualifier', () => {
    const r = admitCraftGauge({ ...base, aLevel: 'A3', findings: [{ disqualifier: 3 }] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.join(' ')).toContain('A1 cap');
  });
  it('admits the gauge at the cap, and below it', () => {
    expect(admitCraftGauge({ ...base, aLevel: 'A1', findings: [{ disqualifier: 3 }] }).ok).toBe(true);
    const vfx = { ...base, lens: 'vfx' as const };
    expect(admitCraftGauge({ ...vfx, aLevel: 'A2', findings: [{ disqualifier: 3 }] }).ok).toBe(true);
    expect(admitCraftGauge({ ...vfx, aLevel: 'A3', findings: [{ disqualifier: 3 }] }).ok).toBe(false);
  });
  it('one A1 disqualifier among A2 ones caps at A1 (lowest wins, reported once)', () => {
    const vfx = { ...base, lens: 'vfx' as const, aLevel: 'A2' as const };
    expect(admitCraftGauge({ ...vfx, findings: [{ disqualifier: 3 }, { disqualifier: 5 }] }).ok).toBe(false);
  });
  it('refuses a disqualifier number the lens does not have', () => {
    const r = admitCraftGauge({ ...base, aLevel: 'A1', findings: [{ disqualifier: 9 }] });
    expect(r.ok).toBe(false);
  });
  it('[floor] untagged findings and absent findings are admitted exactly as before', () => {
    expect(admitCraftGauge({ ...base, aLevel: 'A3', findings: [{}, {}] }).ok).toBe(true);
    expect(admitCraftGauge({ ...base, aLevel: 'A3' }).ok).toBe(true);
  });
});

describe('A/B over every lens x disqualifier x level (the replay behind the applied row)', () => {
  it('tagged gauges above their cap: old door admitted all, new door admits none; the rest are unchanged', () => {
    let aboveCap = 0, newAdmitsAboveCap = 0, atOrBelow = 0, newAdmitsAtOrBelow = 0;
    const rank = { A1: 1, A2: 2, A3: 3, A4: 4 } as const;
    for (const lens of LENS_IDS) {
      LENS_DISQUALIFIER_CAPS[lens].forEach((cap, i) => {
        for (const aLevel of ['A1', 'A2', 'A3', 'A4'] as const) {
          // Ceilings do not apply to a step with no audited fact; the lens is the writer's.
          const ok = admitCraftGauge({ catalogId: 'x', entityId: 'e', step: 'no-such-step', lens, aLevel, findings: [{ disqualifier: i + 1 }] }, { isProcess: lens === 'production-process' }).ok;
          if (rank[aLevel] > rank[cap]) { aboveCap++; if (ok) newAdmitsAboveCap++; }
          else { atOrBelow++; if (ok) newAdmitsAtOrBelow++; }
        }
      });
    }
    expect(aboveCap).toBeGreaterThan(0);
    expect(newAdmitsAboveCap).toBe(0);
    expect(newAdmitsAtOrBelow).toBe(atOrBelow);
  });
});
