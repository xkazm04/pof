'use client';
/* eslint-disable no-restricted-syntax -- identity-lab chrome: neutral monochrome bar, bespoke by design */

import { useState, type ReactNode } from 'react';
import { useLabCatalogData, useLabDetail, type LabGroup, type LabDetail } from './useLabCatalogData';
import { Forge } from './variants/Forge';
import { Blueprint } from './variants/Blueprint';
import { Studio } from './variants/Studio';

interface VariantProps { groups: LabGroup[]; detail: LabDetail | null; onSelect: (id: string) => void; onBack: () => void }

const VARIANTS: { id: string; label: string; render: (p: VariantProps) => ReactNode }[] = [
  { id: 'forge', label: 'Forge', render: (p) => <Forge {...p} /> },
  { id: 'blueprint', label: 'Blueprint', render: (p) => <Blueprint {...p} /> },
  { id: 'studio', label: 'Studio', render: (p) => <Studio {...p} /> },
];

/**
 * UI identity lab (/layout). Neutral monochrome tab bar switches between the
 * remaining identity prototypes (Forge · Blueprint · Studio). Selecting a catalog
 * row opens that variant's distinct detail screen (entity selection + pipeline +
 * metadata); the selection persists across variant switches for side-by-side compare.
 */
export function LayoutLab() {
  const groups = useLabCatalogData();
  const [active, setActive] = useState('studio');
  const [selected, setSelected] = useState<string | null>(null);
  const detail = useLabDetail(selected);
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
        {selected && (
          <span style={{ marginLeft: 'auto', color: '#777', fontSize: 12, fontFamily: 'ui-monospace, monospace' }}>
            detail · {selected}
          </span>
        )}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        {current.render({ groups, detail, onSelect: setSelected, onBack: () => setSelected(null) })}
      </div>
    </div>
  );
}
