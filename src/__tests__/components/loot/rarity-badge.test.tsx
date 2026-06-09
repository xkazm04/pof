import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import {
  RarityBadge,
  RarityDot,
  rarityColor,
  isHighTierRarity,
} from '@/components/modules/core-engine/sub_loot/_shared/rarityBadge';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

/** JSDOM serializes inline `style` hex colors as `rgb(r, g, b)`; convert for matching. */
function hexToRgb(hex: string): string {
  const m = /^#?([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})$/i.exec(hex);
  if (!m) throw new Error(`Bad hex: ${hex}`);
  return `rgb(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)})`;
}

describe('rarityColor / isHighTierRarity', () => {
  it('maps tiers from RARITY_COLOR_MAP and is case-insensitive', () => {
    expect(rarityColor('Epic')).toBe(rarityColor('epic'));
    expect(rarityColor('Legendary')).not.toBe(rarityColor('Common'));
  });

  it('falls back to a stable muted colour for an unknown rarity', () => {
    expect(rarityColor('Mythical')).toBe(rarityColor('definitely-not-a-tier'));
  });

  it('treats only Epic and Legendary as high-tier', () => {
    expect(isHighTierRarity('Epic')).toBe(true);
    expect(isHighTierRarity('legendary')).toBe(true);
    expect(isHighTierRarity('Common')).toBe(false);
    expect(isHighTierRarity('Rare')).toBe(false);
  });
});

describe('RarityDot', () => {
  it('fills with the tier colour, is 8px by default, and has no glow', () => {
    const { container } = render(<RarityDot rarity="Rare" />);
    const dot = container.firstElementChild as HTMLElement;
    expect(dot.style.backgroundColor).toBe(hexToRgb(rarityColor('Rare')));
    expect(dot.style.width).toBe('8px');
    expect(dot.style.boxShadow).toBe('');
  });

  it('adds a halo and respects a custom size when asked', () => {
    const { container } = render(<RarityDot rarity="Legendary" glow size={6} />);
    const dot = container.firstElementChild as HTMLElement;
    expect(dot.style.width).toBe('6px');
    expect(dot.style.boxShadow).not.toBe('');
  });
});

describe('RarityBadge', () => {
  it('renders the rarity name in the tier colour as a rounded-full pill', () => {
    const { container } = render(<RarityBadge rarity="Rare" />);
    const badge = container.firstElementChild as HTMLElement;
    expect(badge.textContent).toBe('Rare');
    expect(badge.className).toContain('rounded-full');
    expect(badge.className).toContain('px-1.5');
    expect(badge.className).toContain('py-0.5');
    expect(badge.style.color).toBe(hexToRgb(rarityColor('Rare')));
  });

  it('gives Epic and Legendary a subtle glow halo, others none', () => {
    const { container: epic } = render(<RarityBadge rarity="Epic" />);
    expect((epic.firstElementChild as HTMLElement).style.boxShadow).not.toBe('');
    cleanup();
    const { container: common } = render(<RarityBadge rarity="Common" />);
    expect((common.firstElementChild as HTMLElement).style.boxShadow).toBe('');
  });

  it('uses children as the label while the rarity still drives the colour', () => {
    const { container } = render(<RarityBadge rarity="Legendary">Godslayer</RarityBadge>);
    const badge = container.firstElementChild as HTMLElement;
    expect(badge.textContent).toBe('Godslayer');
    expect(badge.style.color).toBe(hexToRgb(rarityColor('Legendary')));
  });
});
