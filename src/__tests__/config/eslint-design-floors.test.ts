/**
 * Ship-loop Milestone 4 (UX adoption tail): the design system's floors (no hardcoded
 * hex; no sub-12px text) are enforced by ESLint `no-restricted-syntax` so drift is caught
 * at edit-time rather than sweeping hundreds of files after the fact. This guard makes the
 * enforcement itself non-removable — if someone drops a floor rule, this test fails.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const config = readFileSync(join(process.cwd(), 'eslint.config.mjs'), 'utf8');

describe('ESLint design-system floor enforcement', () => {
  it('enforces the no-hardcoded-hex floor (chart-colors / CSS vars)', () => {
    expect(config).toContain('#[0-9a-fA-F]{6,8}');
    expect(config).toMatch(/chart-colors|CSS variable/);
  });

  it('enforces the 12px legibility floor (no text-[<12px] arbitrary sizes)', () => {
    // Wave 19 widened the range from 8–11 to 6–11. The old range silently exempted
    // the smallest text in the codebase (6–7px SVG chart labels) — a floor with a
    // hole in the bottom.
    expect(config).toContain('text-\\\\[(?:6|7|8|9|10|11)px\\\\]');
    expect(config).toMatch(/12px legibility floor/);
    expect(config).toMatch(/MicroLabel|TEXT_SCALE|text-xs/);
  });

  it('sees the floor through a template className, not just a string literal', () => {
    // A `Literal` selector cannot match `className={`… text-[9px] …`}`, and template
    // classNames are the dominant form here — so the rule needs a TemplateElement arm.
    expect(config).toMatch(/TemplateElement\[value\.raw=/);
  });

  it('sees the floor through an inline style, not just a className', () => {
    // `style={{ fontSize: 9 }}` renders exactly as illegibly as `text-[9px]`.
    expect(config).toMatch(/Property\[key\.name='fontSize'\]/);
  });

  it('both floors live under no-restricted-syntax at warn severity', () => {
    expect(config).toMatch(/"no-restricted-syntax":\s*\[\s*"warn"/);
  });

  it('records that warn severity alone cannot enforce the floor', () => {
    // `npm run lint` is a bare `eslint` with no `--max-warnings`, so these rules
    // cannot fail a build — 480 legibility warnings had accumulated by wave 19.
    // The hard enforcement lives in src/__tests__/a11y/legibility-floor-guard.test.ts;
    // this assertion exists so the two are not mistaken for one mechanism.
    const pkg = JSON.parse(
      readFileSync(join(process.cwd(), 'package.json'), 'utf8'),
    ) as { scripts: Record<string, string> };
    expect(pkg.scripts.lint).not.toContain('--max-warnings');
  });
});
