import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { EconomySankeySection } from '@/components/modules/core-engine/sub_inventory/economy/EconomySankeySection';

// Flow volumes must be reachable without hover (scan-sweep 2026-11-08, accessibility-checker):
// every link carries an accessible name with its value, is focusable, and svg text is >= 12px.

afterEach(() => cleanup());

/** The diagram is the last svg; the section header renders an icon svg first. */
function diagram(container: HTMLElement): SVGSVGElement {
  return Array.from(container.querySelectorAll('svg')).pop()!;
}

describe('economy sankey accessibility', () => {
  it('every link has a <title> naming its flow and value and is keyboard focusable', () => {
    const { container } = render(<EconomySankeySection />);
    const links = Array.from(diagram(container).querySelectorAll('path'));
    expect(links).toHaveLength(8);
    const unreachable = links.filter((p) => {
      const t = p.querySelector('title')?.textContent ?? '';
      return !/\d+%/.test(t) || p.getAttribute('tabindex') !== '0';
    });
    expect(unreachable).toHaveLength(0);
  });

  it('the svg is a named image', () => {
    const { container } = render(<EconomySankeySection />);
    const svg = diagram(container);
    expect(svg.getAttribute('role')).toBe('img');
    expect((svg.getAttribute('aria-label') ?? '').trim().length).toBeGreaterThan(0);
  });

  it('no svg text is under the 12px floor', () => {
    const { container } = render(<EconomySankeySection />);
    const texts = Array.from(diagram(container).querySelectorAll('text'));
    expect(texts.length).toBe(18);
    const small = texts.filter((t) => parseFloat((t as SVGElement).style.fontSize || '0') < 12);
    expect(small).toHaveLength(0);
  });
});
