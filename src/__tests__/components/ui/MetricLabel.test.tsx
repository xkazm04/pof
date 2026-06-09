import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MetricLabel } from '@/components/ui/MetricLabel';
import { lookupMetric } from '@/lib/combat/metric-glossary';

// setup.ts has no global afterEach(cleanup) — register our own.
afterEach(() => cleanup());

describe('MetricLabel', () => {
  it('renders the glossary term plus a 12px info dot at 60% opacity', () => {
    const { container } = render(<MetricLabel metricId="avgDPS" />);
    const button = screen.getByRole('button');
    // Visible text is the term; the icon is decorative.
    expect(button.textContent).toContain('Player DPS');

    const icon = container.querySelector('svg');
    expect(icon).not.toBeNull();
    expect(icon!.getAttribute('aria-hidden')).toBe('true');
    expect(icon!.style.opacity).toBe('0.6');
    // 12px sizing via tailwind w-3/h-3 (0.75rem).
    expect(icon!.getAttribute('class')).toContain('w-3');
    expect(icon!.getAttribute('class')).toContain('h-3');
  });

  it('lets the caller override the display label while keeping the term tooltip', () => {
    render(<MetricLabel metricId="armorEffectivenessWeight" label="Armor Weight" />);
    expect(screen.getByRole('button').textContent).toContain('Armor Weight');
  });

  it('exposes the full plain-language definition + example to assistive tech', () => {
    const entry = lookupMetric('oneShotRate')!;
    render(<MetricLabel metricId="oneShotRate" />);
    const name = screen.getByRole('button').getAttribute('aria-label') ?? '';
    expect(name).toContain(entry.term);
    expect(name).toContain(entry.plain);
    expect(name).toContain(entry.example);
  });

  it('reveals a popover with the definition and a worked example on focus, hides on blur', () => {
    const entry = lookupMetric('avgDPS')!;
    render(<MetricLabel metricId="avgDPS" />);
    const button = screen.getByRole('button');

    // No popover until the trigger is focused/hovered.
    expect(screen.queryByRole('tooltip')).toBeNull();

    fireEvent.focus(button);
    const tip = screen.getByRole('tooltip');
    expect(tip.textContent).toContain(entry.plain);
    expect(tip.textContent).toContain('Example:');
    expect(tip.textContent).toContain(entry.example);

    fireEvent.blur(button);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('opens on hover too (mouse users)', () => {
    const { container } = render(<MetricLabel metricId="killShare" />);
    const wrapper = container.firstElementChild as HTMLElement;
    fireEvent.mouseEnter(wrapper);
    expect(screen.getByRole('tooltip').textContent).toContain(lookupMetric('killShare')!.plain);
    fireEvent.mouseLeave(wrapper);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('fails soft for an unknown metric id — plain text, no affordance', () => {
    const { container } = render(<MetricLabel metricId="nope" label="Mystery Stat" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(container.querySelector('svg')).toBeNull();
    expect(container.textContent).toBe('Mystery Stat');
  });

  it('can hide the info dot in tight rows while keeping the tooltip', () => {
    const { container } = render(<MetricLabel metricId="avgDPS" showIcon={false} />);
    expect(container.querySelector('svg')).toBeNull();
    fireEvent.focus(screen.getByRole('button'));
    expect(screen.getByRole('tooltip')).toBeTruthy();
  });
});
