import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { render, cleanup } from '@testing-library/react';
import { NarrativeBreadcrumb } from '@/components/modules/core-engine/sub_loot/NarrativeBreadcrumb';
import { blendOver, contrastRatio, WCAG_AA_TEXT } from '@/lib/contrast';

afterEach(() => cleanup());

const css = fs.readFileSync(path.join(process.cwd(), 'src', 'app', 'globals.css'), 'utf8');
const token = (name: string): string => {
  const m = css.match(new RegExp('--' + name + ': *(#[0-9a-fA-F]{6})'));
  if (!m) throw new Error(`token --${name} not found`);
  return m[1];
};

describe('loot workflow breadcrumb legibility', () => {
  it('upcoming steps reach WCAG AA on the page background (opacity applied)', () => {
    const { container } = render(<NarrativeBreadcrumb activeTab="features" onNavigate={() => {}} />);
    const buttons = Array.from(container.querySelectorAll('button')).filter((b) => !b.getAttribute('aria-current'));
    // Steps after the active one are the "future" tier.
    const future = buttons.slice(0);
    expect(future.length).toBeGreaterThan(1);
    const bg = token('background');
    for (const b of future) {
      const color = b.style.color; // var(--text-muted) | var(--text-subtle)
      const name = /--([a-z-]+)/.exec(color)?.[1];
      expect(name, `button "${b.textContent}" color ${color}`).toBeTruthy();
      const alpha = b.style.opacity === '' ? 1 : Number(b.style.opacity);
      const effective = blendOver(token(name as string), alpha, bg);
      expect(contrastRatio(effective, bg), `${b.textContent} effective ${effective}`).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    }
  });

  it('does not use the sub-floor 10px size literal', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'src', 'components', 'modules', 'core-engine', 'sub_loot', 'NarrativeBreadcrumb.tsx'),
      'utf8',
    );
    const subFloor = ['text', '[10px]'].join('-');
    expect(src.includes(subFloor)).toBe(false);
  });
});
