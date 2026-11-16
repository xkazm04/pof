import { describe, it, expect } from 'vitest';
import { parseUE5Config } from '@/components/modules/content/ui-hud/HudThemeEditor/helpers';
import { DEFAULT_THEME } from '@/components/modules/content/ui-hud/HudThemeEditor/constants';

describe('parseUE5Config unknown names', () => {
  it('reports a repeated unknown name once, in first-seen order', () => {
    const r = parseUE5Config('float Foo = 1.0f;\nfloat Foo = 2.0f;\nfloat Bar = 1.0f;', DEFAULT_THEME);
    expect(r.unknown).toEqual(['Foo', 'Bar']);
  });
});
