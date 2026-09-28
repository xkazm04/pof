import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { DamageCalcSection } from '@/components/modules/core-engine/sub_ability/abilities/DamageCalcSection';

/**
 * Acceptance (component half) for scan-sweep --challenge card ability-spellbook-core/B:
 * the Spellbook "Damage Formula Sandbox" renders the canon kernel, bound to the
 * seeded spellbook catalog (useSpellbookEntries), instead of the retired armour curve.
 */

afterEach(cleanup);

/** GlowStat renders its label and value as siblings inside one card. */
function statText(label: string): string {
  return screen.getByText(label).parentElement?.textContent ?? '';
}

// Renders against the real seeded spellbook catalog; the first render takes several
// seconds under a loaded suite, so the 5 s default would flake.
describe('DamageCalcSection — canon sandbox', { timeout: 30_000 }, () => {
  it('case 7: defaults read 98.4; picking Fireball loads base 35 and the Fire resist path', () => {
    render(<DamageCalcSection />);
    expect(statText('Expected Damage')).toContain('98.4');
    expect(statText('Expected Damage')).not.toContain('71.7');

    const picker = screen.getByLabelText('Ability') as HTMLSelectElement;
    const fireball = within(picker).getByRole('option', { name: /Fireball/ }) as HTMLOptionElement;
    fireEvent.change(picker, { target: { value: fireball.value } });

    expect((screen.getByLabelText('Base Damage') as HTMLInputElement).value).toBe('35');
    const steps = screen.getByTestId('formula-steps');
    expect(steps.textContent).toMatch(/Fire resist/i);
    expect(steps.textContent).not.toMatch(/armou?r soft-cap/i);
  });

  it('case 8: armour 200 + crit 100 reads 116.1 with a visible 95% cap marker', () => {
    render(<DamageCalcSection />);
    fireEvent.change(screen.getByLabelText('Target Armor'), { target: { value: '200' } });
    fireEvent.change(screen.getByLabelText('Crit Chance'), { target: { value: '100' } });
    expect(statText('Expected Damage')).toContain('116.1');
    expect(statText('Expected Damage')).not.toContain('50.0');
    expect(screen.getByTestId('crit-cap-marker').textContent).toMatch(/95% cap/);
  });
});
