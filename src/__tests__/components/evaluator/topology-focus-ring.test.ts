/**
 * scan-sweep night 2026-11-08 (module-topology-graph): the Nexus layer toggles and the
 * Constellation Refresh button carried no focus-ring class, so keyboard focus was
 * invisible on them (WCAG 2.4.7) while sibling controls use the shared .focus-ring token.
 * Source guard: every `<button` opening tag in the four topology folders names
 * focus-ring / focus-ring-inset / focus-visible.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src', 'components', 'modules', 'evaluator');
const DIRS = ['DependencyGraph', 'NexusView', 'FeatureConstellation', 'CrossModuleOverlapPanel'];

/** Opening tags of every `<button`, found by walking to the closing `>` outside `{...}`. */
export function buttonTags(src: string): string[] {
  const tags: string[] = [];
  let from = 0;
  for (;;) {
    const start = src.indexOf('<button', from);
    if (start < 0) return tags;
    let depth = 0;
    let i = start;
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) break;
    }
    tags.push(src.slice(start, i + 1));
    from = i + 1;
  }
}

const FOCUS = /focus-ring|focus-visible/;
/** A bare `disabled` attribute is never focusable, so it needs no ring. */
const INERT = /\sdisabled(\s|>)/;

/**
 * Known gaps outside the round's write-set (two buttons in files this card did not
 * name). The guard pins them exactly: a NEW offender fails, and fixing one fails until
 * it is removed here, so the list can only shrink.
 */
const KNOWN_GAPS = [
  'CrossModuleOverlapPanel/index.tsx: <button onClick={reanalyze}',
  'NexusView/NodeDeepDivePanel.tsx: <button onClick={sessions.retry}',
];

describe('module-topology-graph — visible keyboard focus on every button', () => {
  it('the scanner finds a tag despite an arrow function in its props, and flags a bare button', () => {
    const tags = buttonTags('<button onClick={() => go()} className="p-1">x</button><button className="focus-ring">y</button>');
    expect(tags).toHaveLength(2);
    expect(tags.map((t) => FOCUS.test(t))).toEqual([false, true]);
    expect(INERT.test('<button disabled aria-label="x" className="a">')).toBe(true);
    expect(INERT.test('<button disabled={busy} className="a">')).toBe(false);
  });

  it('every <button in the four topology view folders carries a focus-ring class', () => {
    const offenders: string[] = [];
    for (const dir of DIRS) {
      for (const name of readdirSync(join(ROOT, dir))) {
        if (!/\.tsx$/.test(name)) continue;
        for (const tag of buttonTags(readFileSync(join(ROOT, dir, name), 'utf8'))) {
          if (!FOCUS.test(tag) && !INERT.test(tag)) offenders.push(`${dir}/${name}: ${tag.replace(/\s+/g, ' ').slice(0, 70)}`);
        }
      }
    }
    expect(offenders.map((o) => KNOWN_GAPS.find((g) => o.startsWith(g)) ?? o).sort()).toEqual([...KNOWN_GAPS].sort());
  });
});
