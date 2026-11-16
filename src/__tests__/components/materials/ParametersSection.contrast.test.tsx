import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { Gem } from 'lucide-react';

import { ParametersSection } from '@/components/modules/content/materials/MaterialParameterConfigurator/ParametersSection';
import { BASE_PARAMS } from '@/components/modules/content/materials/MaterialParameterConfigurator/constants';
import type { SurfaceDef } from '@/components/modules/content/materials/MaterialParameterConfigurator/types';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { contrastRatio } from '@/lib/contrast';

afterEach(cleanup);

/**
 * The slider's min/max captions were `text-[#3a3e5a]` on the `bg-surface-deep`
 * card: 1.73:1, far under WCAG 1.4.3's 4.5:1 for 10px text. Every
 * literal text colour in the section must clear AA on that card.
 */

// The card background, read from the theme so the check follows the token.
const SURFACE_DEEP = /--surface-deep:\s*(#[0-9a-fA-F]{6})/.exec(readFileSync(resolve(process.cwd(), 'src/app/globals.css'), 'utf-8'))![1];
const SURFACE: SurfaceDef = {
  id: 'metal', label: 'Metal', icon: Gem, color: 'var(--text)', description: '', defaultFeatures: [], plain: '',
};

describe('ParametersSection text contrast', () => {
  it('every literal text colour clears 4.5:1 on the surface-deep card', () => {
    const { container } = render(
      <ParametersSection applicableParams={BASE_PARAMS.slice(0, 2)} paramValues={{}} explainMode={false} surfaceDef={SURFACE} setParam={() => {}} />,
    );
    const failing: string[] = [];
    for (const el of Array.from(container.querySelectorAll('[class]'))) {
      for (const m of el.className.toString().matchAll(/text-\[(#[0-9a-fA-F]{6})\]/g)) {
        const ratio = contrastRatio(m[1], SURFACE_DEEP);
        if (ratio < 4.5) failing.push(`${m[1]} ${ratio.toFixed(2)}:1 "${el.textContent}"`);
      }
    }
    expect(failing).toEqual([]);
  });
});
