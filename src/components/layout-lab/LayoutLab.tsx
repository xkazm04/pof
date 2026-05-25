'use client';
/* eslint-disable no-restricted-syntax -- identity-lab chrome: neutral monochrome bar, bespoke by design */

import { useState, type ReactNode } from 'react';
import { useLabCatalogData, type LabGroup } from './useLabCatalogData';
import { Atelier } from './variants/Atelier';
import { Forge } from './variants/Forge';
import { Blueprint } from './variants/Blueprint';
import { Soft } from './variants/Soft';
import { Studio } from './variants/Studio';

const VARIANTS: { id: string; label: string; render: (g: LabGroup[]) => ReactNode }[] = [
  { id: 'atelier', label: 'Atelier', render: (g) => <Atelier groups={g} /> },
  { id: 'forge', label: 'Forge', render: (g) => <Forge groups={g} /> },
  { id: 'blueprint', label: 'Blueprint', render: (g) => <Blueprint groups={g} /> },
  { id: 'soft', label: 'Soft', render: (g) => <Soft groups={g} /> },
  { id: 'studio', label: 'Studio', render: (g) => <Studio groups={g} /> },
];

/**
 * UI identity lab (/layout). A neutral, monochrome tab bar switches between five
 * fully self-styled identity prototypes of the catalog-row-selection screen.
 * The bar is intentionally chrome (no identity) so it doesn't bias the variants.
 */
export function LayoutLab() {
  const groups = useLabCatalogData();
  const [active, setActive] = useState('atelier');
  const current = VARIANTS.find((v) => v.id === active) ?? VARIANTS[0];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#000' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: '#0c0c0c', borderBottom: '1px solid #262626' }}>
        <span style={{ color: '#777', fontSize: 12, marginRight: 12, fontFamily: 'ui-monospace, monospace' }}>/layout · identity lab</span>
        {VARIANTS.map((v) => (
          <button
            key={v.id}
            onClick={() => setActive(v.id)}
            style={{
              padding: '6px 14px', borderRadius: 6, fontSize: 13, cursor: 'pointer', border: '1px solid #333',
              background: active === v.id ? '#fff' : 'transparent', color: active === v.id ? '#000' : '#aaa',
              fontWeight: active === v.id ? 600 : 400,
            }}
          >
            {v.label}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>{current.render(groups)}</div>
    </div>
  );
}
