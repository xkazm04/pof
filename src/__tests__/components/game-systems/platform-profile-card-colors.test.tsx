/**
 * Every platform's card colour must survive alpha-suffixing.
 *
 * PlatformProfileCard appends hex alpha (`${color}30`, `${color}15`, `${color}cc`).
 * IOS was `'var(--text-muted)'`, so it produced `var(--text-muted)cc` — invalid CSS
 * the browser drops: the IOS Package button lost its background (white text on
 * nothing), and the card border and icon tile vanished.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { BuildProfile, PlatformId } from '@/lib/packaging/build-profiles';
import { createDefaultProfile, SUPPORTED_PLATFORMS } from '@/lib/packaging/build-profiles';
import { PlatformProfileCard } from '@/components/modules/game-systems/PlatformProfileCard';

afterEach(cleanup);

function profile(platform: PlatformId): BuildProfile {
  return { ...createDefaultProfile(platform), id: `p-${platform}`, name: platform } as BuildProfile;
}

describe('PlatformProfileCard colours are valid CSS for every platform', () => {
  for (const { id } of SUPPORTED_PLATFORMS) {
    it(`${id}: Package button keeps a background`, () => {
      const { container } = render(
        <PlatformProfileCard profile={profile(id)} onEdit={() => {}} onDelete={() => {}} onSetDefault={() => {}} onPackage={() => {}} />,
      );
      const btn = container.querySelector(`[data-testid="pof-module-packaging-start-cook-p-${id}"]`) as HTMLElement;
      expect(btn).toBeTruthy();
      // jsdom does not drop an invalid var() concatenation, so assert the shape: a
      // resolved colour (hex/rgb[a]), never a CSS variable with alpha glued on.
      expect(btn.style.backgroundColor).not.toBe('');
      expect(btn.style.backgroundColor).not.toMatch(/var\(/);
      expect(container.innerHTML).not.toMatch(/var\([^)]*\)[0-9a-f]{2}/i);
    });
  }
});
