import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { SAVE_TYPE } from '@/components/modules/core-engine/sub_save/_shared/design';
import { BudgetAlerting } from '@/components/modules/core-engine/sub_save/schema/BudgetAlerting';

afterEach(cleanup);

const SUB_FLOOR = ['text-[9px]', 'text-[10px]'];

describe('SAVE_TYPE scale', () => {
  it('defines the deliberate hierarchy roles', () => {
    expect(SAVE_TYPE.title).toContain('text-sm');
    expect(SAVE_TYPE.title).toContain('font-semibold');
    expect(SAVE_TYPE.hero).toContain('text-lg');
    expect(SAVE_TYPE.body).toBe('text-xs');
  });

  it('reserves mono + UPPERCASE strictly for codes and axis labels', () => {
    for (const [role, cls] of Object.entries(SAVE_TYPE)) {
      // Only `code` is allowed to force uppercase.
      if (role !== 'code') expect(cls).not.toContain('uppercase');
      // Mono is reserved for codes and axis (chart ticks) only.
      if (role !== 'code' && role !== 'axis') expect(cls).not.toContain('font-mono');
    }
    expect(SAVE_TYPE.code).toContain('font-mono');
    expect(SAVE_TYPE.code).toContain('uppercase');
  });

  it('keeps every role at or above the 11px legibility floor', () => {
    for (const cls of Object.values(SAVE_TYPE)) {
      for (const tiny of SUB_FLOOR) expect(cls).not.toContain(tiny);
    }
    // The smallest roles sit exactly at the 11px floor.
    expect(SAVE_TYPE.meta).toContain('text-[11px]');
    expect(SAVE_TYPE.axis).toContain('text-[11px]');
  });
});

describe('BudgetAlerting typography', () => {
  it('renders without any sub-11px font size', () => {
    const { container } = render(<BudgetAlerting />);
    for (const tiny of SUB_FLOOR) {
      expect(container.innerHTML).not.toContain(tiny);
    }
  });

  it('renders field labels as sentence-case body copy, not mono-uppercase', () => {
    render(<BudgetAlerting />);
    const label = screen.getAllByText('Growth trend')[0];
    expect(label.className).not.toContain('uppercase');
    expect(label.className).not.toContain('font-mono');
    expect(label.className).toContain('text-xs');
  });

  it('promotes the projected value to a hero-sized number', () => {
    const { container } = render(<BudgetAlerting />);
    expect(container.querySelector('.text-lg')).toBeTruthy();
  });

  it('still renders status badges as uppercase codes', () => {
    render(<BudgetAlerting />);
    // The OVER/WARN/OK ladder are enum codes — they stay uppercase.
    const badges = screen.getAllByText(/^(OVER|WARN|OK)$/);
    expect(badges.length).toBeGreaterThan(0);
    expect(badges.some(b => b.className.includes('uppercase'))).toBe(true);
  });
});
