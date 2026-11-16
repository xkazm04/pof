import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { Activity } from 'lucide-react';
import { Section } from '@/components/modules/core-engine/sub_character/simulator/predictive/Section';

afterEach(cleanup);

describe('predictive Section — the disclosure button states whether it is open', () => {
  it('reports aria-expanded and flips it on toggle', () => {
    const { getByRole } = render(
      <Section title="Sensitivity Analysis" icon={Activity} color="var(--text)">
        <p>body</p>
      </Section>,
    );
    const btn = getByRole('button');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
  });

  it('starts expanded when defaultOpen', () => {
    const { getByRole } = render(
      <Section title="Survival Heatmap" icon={Activity} color="var(--text)" defaultOpen>
        <p>body</p>
      </Section>,
    );
    expect(getByRole('button').getAttribute('aria-expanded')).toBe('true');
  });
});
