import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { Badge } from '@/components/ui/Badge';
import { STATUS_TOKENS } from '@/lib/status-token';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

/** JSDOM serializes inline `style` color values as `rgb(r, g, b)`; convert for matching. */
function rgbOf(hex: string): string {
  const m = /^#?([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})$/i.exec(hex);
  if (!m) throw new Error(`Bad hex: ${hex}`);
  return `rgb(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)})`;
}

describe('Badge — semantic variants are never hue-only', () => {
  it('renders a glyph and an accessible name for variant="error"', () => {
    const { container } = render(<Badge variant="error">3</Badge>);
    // (a) a shape cue is present, not just a red hue
    expect(container.querySelector('svg')).not.toBeNull();
    // (b) the status is nameable to a screen reader
    expect(screen.getByLabelText(/over|error/i)).not.toBeNull();
  });

  it('gives success and warning their own distinct glyphs', () => {
    const { container: ok } = render(<Badge variant="success">12</Badge>);
    const { container: warn } = render(<Badge variant="warning">3</Badge>);
    const { container: bad } = render(<Badge variant="error">1</Badge>);
    const cls = (c: HTMLElement) => c.querySelector('svg')!.getAttribute('class') ?? '';
    // Distinct lucide glyph per level — the whole point of shape cue #1.
    expect(new Set([cls(ok), cls(warn), cls(bad)]).size).toBe(3);
  });

  it('the three Holistic-Health counts are distinguishable without color', () => {
    // Reproduces evaluator/HolisticHealthView/index.tsx:191-193 — three bare
    // integers in one flex row whose only differentiator used to be the hue.
    const { container } = render(
      <div>
        <Badge variant="success">12</Badge>
        <Badge variant="warning">3</Badge>
        <Badge variant="error">1</Badge>
      </div>,
    );
    const badges = Array.from(container.querySelectorAll('[data-status]')) as HTMLElement[];
    expect(badges.map((b) => b.getAttribute('data-status'))).toEqual(['ok', 'warn', 'bad']);
    // Each count carries its own accessible name alongside the number.
    for (const b of badges) {
      expect(within(b).getByRole('img').getAttribute('aria-label')).toBeTruthy();
    }
  });

  it('sources colour from the shared STATUS_TOKENS ramp, not a local hue table', () => {
    const { container } = render(<Badge variant="error">crash</Badge>);
    const span = container.querySelector('[data-status="bad"]') as HTMLElement;
    expect(span.style.color).toBe(rgbOf(STATUS_TOKENS.bad.color));
  });

  it('caps the glyph at w-3 h-3 so dense strips do not grow a row', () => {
    const { container } = render(<Badge variant="warning">5x</Badge>);
    const cls = container.querySelector('svg')!.getAttribute('class') ?? '';
    expect(cls).toContain('w-3');
    expect(cls).toContain('h-3');
  });

  it('supports showIcon={false} where the text alone already disambiguates', () => {
    const { container } = render(<Badge variant="success" showIcon={false}>Adapter Ready</Badge>);
    expect(container.querySelector('svg')).toBeNull();
    expect(container.textContent).toBe('Adapter Ready');
  });

  it('leaves variant="default" untouched (no glyph, existing utility classes)', () => {
    const { container } = render(<Badge>neutral</Badge>);
    const span = container.firstElementChild as HTMLElement;
    expect(container.querySelector('svg')).toBeNull();
    expect(span.className).toContain('text-text-muted');
    expect(span.className).toContain('bg-surface-hover');
    expect(span.hasAttribute('data-status')).toBe(false);
  });

  it('still forwards className', () => {
    const { container } = render(<Badge variant="success" className="ml-1">Baseline</Badge>);
    expect((container.firstElementChild as HTMLElement).className).toContain('ml-1');
  });
});

// ---------------------------------------------------------------------------
// Source scan: no semantic Badge may opt out of the glyph while showing only a
// bare interpolated value — that is exactly the "12 3 1" lie this direction
// closed, and showIcon={false} is the one way to reintroduce it.
// ---------------------------------------------------------------------------

function walkTsx(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkTsx(p, out);
    else if (name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

describe('Badge call sites', () => {
  it('never pairs showIcon={false} with a bare interpolated value', () => {
    const files = walkTsx(join(process.cwd(), 'src', 'components'));
    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      if (!src.includes('<Badge')) continue;
      // Each <Badge …>children</Badge> occurrence, tolerant of newlines.
      const re = /<Badge\b([^>]*)>([\s\S]*?)<\/Badge>/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src)) !== null) {
        const [, attrs, children] = m;
        const semantic = /variant=\{|variant="(success|warning|error)"/.test(attrs);
        const optedOut = /showIcon=\{false\}/.test(attrs);
        // "Bare value": children are a single {expression} with no literal text.
        const bare = /^\s*\{[^}]*\}\s*$/.test(children);
        if (semantic && optedOut && bare) {
          offenders.push(`${file}: ${children.trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
