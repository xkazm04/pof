import { describe, it, expect } from 'vitest';
import { PRIORITY_CONFIG } from '@/components/modules/content/audio/AudioEventCatalog/constants';
import { withOpacity, OPACITY_10 } from '@/lib/chart-colors';

/**
 * Priority colours are tinted with `withOpacity` (a hex-suffix concat) in the
 * EventEditor's priority buttons. `low` was `var(--text-muted)`, so its tint read
 * `var(--text-muted)1a` — invalid CSS a browser drops — and the ACTIVE Low
 * button lost its border, fill and glow. (jsdom keeps any `var(...)` string, so
 * a render test cannot see this; the colour contract is what is pinned.)
 */

const HEX6 = /^#[0-9a-f]{6}$/i;

describe('priority colours survive an opacity suffix', () => {
  it('every PRIORITY_CONFIG colour is a 6-digit hex, so withOpacity yields a valid colour', () => {
    for (const [level, cfg] of Object.entries(PRIORITY_CONFIG)) {
      expect({ level, ok: HEX6.test(cfg.color) }).toEqual({ level, ok: true });
      expect(withOpacity(cfg.color, OPACITY_10)).toMatch(/^#[0-9a-f]{8}$/i);
    }
  });
});
