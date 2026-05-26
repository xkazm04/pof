'use client';
/* eslint-disable no-restricted-syntax -- art/swatch placeholders use bespoke preview colors by design */

import { useState } from 'react';
import { StepFrame } from './StepFrame';
import { CliProduce } from './shared/CliProduce';
import type { LabTheme } from '../theme';
import type { LabEntity } from '../useLabCatalogData';

function tile(t: LabTheme, grad: string, selected: boolean, onClick: () => void, frame?: string) {
  return (
    <button onClick={onClick} style={{ aspectRatio: '1', borderRadius: t.glass ? 10 : 2, cursor: 'pointer', background: grad, border: selected ? `3px solid ${frame ?? t.ink}` : `1px solid ${t.line}`, position: 'relative' }} />
  );
}

/** Items · Icon 2D Art. View: gallery + prompt refs. Produce: Leonardo/Gemini gen. Acceptance: selected icon. */
export function ItemIcon2D({ t, entity }: { t: LabTheme; entity: LabEntity }) {
  const CANDS = ['linear-gradient(135deg,#8a5a2b,#d8a657)', 'linear-gradient(135deg,#3a4a6b,#7e9bd4)', 'linear-gradient(135deg,#5a2b2b,#c66)', 'linear-gradient(135deg,#444,#999)'];
  const RARITY = ['#9aa', '#5b9', '#59f', '#b5f'];
  const [sel, setSel] = useState<number | null>(0);
  return (
    <StepFrame t={t}
      acceptance={{ label: 'A main icon is selected', status: sel != null ? 'pass' : 'pending', detail: sel != null ? `candidate ${sel + 1} · 256px` : 'none selected' }}
      panels={[
        { label: 'Gallery (256px · rarity frame)', node: (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {CANDS.map((g, i) => tile(t, g, sel === i, () => setSel(sel === i ? null : i), RARITY[i]))}
          </div>
        ) },
        { label: 'Selected · silhouette', node: (
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ aspectRatio: '1', maxWidth: 180, borderRadius: t.glass ? 10 : 2, background: sel != null ? CANDS[sel] : t.panel, border: `1px solid ${t.line}` }} />
            <span style={{ fontSize: 14, color: t.muted }}>Silhouette + contact-sheet vs peers would render here. Selected icon writes to the item record.</span>
          </div>
        ) },
        { label: 'Produce', node: (
          <CliProduce t={t} label="Generate via Leonardo (CLI)"
            defaultDirection="weathered steel longsword, leather grip, guild sigil, 3/4 view, game icon"
            note="Prompt saved as a style ref for peer items; selected icon writes to the UE row."
            buildPrompt={(d) => `Generate 4 icon candidates for ${entity.name} (256px, rarity frame). Art direction: ${d}`}
            onComplete={() => setSel(0)} />
        ) },
      ]}
    />
  );
}

/** Items · 3D Generation. View: mesh preview + LOD/tris. Produce: Blender/Meshy. Acceptance: mesh + tri budget. */
export function Item3DGen({ t, entity }: { t: LabTheme; entity: LabEntity }) {
  const [made, setMade] = useState(false);
  const tris = made ? 4200 : 0;
  const CAP = 6000;
  return (
    <StepFrame t={t}
      acceptance={{ label: 'Mesh generated · tri count under LOD0 budget', status: made && tris <= CAP ? 'pass' : 'pending', detail: made ? `${tris} / ${CAP} tris` : 'no mesh' }}
      panels={[
        { label: 'Mesh preview', node: (
          <div style={{ aspectRatio: '4/3', borderRadius: t.glass ? 10 : 2, border: `1px solid ${t.line}`, background: t.panel, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className={t.fontMono} style={{ fontSize: 14, color: t.muted }}>{made ? '◈ LOD0 preview' : 'no mesh yet'}</span>
          </div>
        ) },
        { label: 'LODs · budget', node: (
          <div style={{ display: 'grid', gap: 8 }}>
            {['LOD0', 'LOD1', 'LOD2', 'LOD3'].map((l, i) => (
              <div key={l} className={t.fontMono} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: made ? t.text : t.muted }}>
                <span>{l}</span><span>{made ? Math.round(tris / (i + 1)) : '—'} tris</span>
              </div>
            ))}
          </div>
        ) },
        { label: 'Produce', node: (
          <CliProduce t={t} label="Generate mesh (CLI)" rows={3}
            note={`Writes SM_${entity.name.replace(/[^a-z0-9]+/gi, '')} + auto-LODs to the UE project.`}
            buildPrompt={(d) => `Generate a base mesh for ${entity.name} from its icon + brief via Blender/Meshy, then auto-LOD under ${CAP} tris. ${d}`.trim()}
            onComplete={() => setMade(true)} />
        ) },
      ]}
    />
  );
}

/** Items · Material / Texture. View: PBR map set + preview. Produce: generate maps. Acceptance: required maps. */
export function ItemMaterial({ t, entity }: { t: LabTheme; entity: LabEntity }) {
  const MAPS = [['Albedo', '#b08d57'], ['Normal', '#8088ff'], ['ORM', '#9a9a4a'], ['Height', '#777']];
  const [done, setDone] = useState(false);
  const need = ['Albedo', 'Normal', 'ORM'];
  return (
    <StepFrame t={t}
      acceptance={{ label: 'Required PBR maps present (Albedo · Normal · ORM)', status: done ? 'pass' : 'pending', detail: done ? `${need.length}/${need.length} maps` : '0 maps' }}
      panels={[
        { label: 'Texture maps', node: (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
            {MAPS.map(([name, col]) => (
              <div key={name} style={{ display: 'grid', gap: 6 }}>
                <div style={{ aspectRatio: '1', borderRadius: t.glass ? 8 : 2, background: done ? col : t.panel, border: `1px solid ${t.line}` }} />
                <span className={t.fontMono} style={{ fontSize: 14, color: t.muted, textAlign: 'center' }}>{name}</span>
              </div>
            ))}
          </div>
        ) },
        { label: 'Material preview', node: (
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ width: 120, height: 120, borderRadius: 999, margin: '4px auto', background: done ? 'radial-gradient(circle at 35% 30%, #e6c98a, #8a5a2b)' : t.panel, border: `1px solid ${t.line}` }} />
            <span style={{ fontSize: 14, color: t.muted, textAlign: 'center' }}>Reference-sphere preview · tiling + wear variants.</span>
          </div>
        ) },
        { label: 'Produce', node: (
          <CliProduce t={t} label="Generate PBR maps (CLI)" rows={3}
            note={`Writes MI_${entity.name.replace(/[^a-z0-9]+/gi, '')} (Albedo/Normal/ORM) from the master material.`}
            buildPrompt={(d) => `Author a PBR set for ${entity.name} from the master material; expose params + wear variants. ${d}`.trim()}
            onComplete={() => setDone(true)} />
        ) },
      ]}
    />
  );
}
