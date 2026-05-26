'use client';
/* eslint-disable no-restricted-syntax -- art/swatch placeholders use bespoke preview colors by design */

import { StepFrame } from './StepFrame';
import { CliProduce } from './shared/CliProduce';
import { useLabStep, useLabPipelineStore } from '../labPipelineStore';
import { ITEM_STEP_SPECS, slug } from './itemsSteps';
import type { LabTheme } from '../theme';
import type { StepProps } from './stepProps';

const CANDS = ['linear-gradient(135deg,#8a5a2b,#d8a657)', 'linear-gradient(135deg,#3a4a6b,#7e9bd4)', 'linear-gradient(135deg,#5a2b2b,#c66)', 'linear-gradient(135deg,#444,#999)'];
const RARITY = ['#9aa', '#5b9', '#59f', '#b5f'];

function tile(t: LabTheme, grad: string, selected: boolean, onClick: () => void, frame?: string) {
  return <button onClick={onClick} style={{ aspectRatio: '1', borderRadius: t.glass ? 10 : 2, cursor: 'pointer', background: grad, border: selected ? `3px solid ${frame ?? t.ink}` : `1px solid ${t.line}`, position: 'relative' }} />;
}

/** Items · Icon 2D Art. View: gallery + selection (persisted). Produce: Leonardo gen. */
export function ItemIcon2D({ t, entity, step }: StepProps) {
  const art = useLabStep(entity.id, step);
  const produce = useLabPipelineStore((s) => s.produce);
  const sel = art?.data?.selected as number | undefined;
  const pick = (i: number) => produce(entity.id, step, { data: { selected: i, prompt: 'weathered steel longsword, leather grip, guild sigil' }, ueAssets: [`/Game/Items/${slug(entity.name)}/T_${slug(entity.name)}_Icon`] });

  return (
    <StepFrame t={t} acceptance={ITEM_STEP_SPECS[step].accept(art)}
      panels={[
        { label: 'Gallery (256px · rarity frame)', node: (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {CANDS.map((g, i) => tile(t, g, sel === i, () => pick(sel === i ? -1 : i), RARITY[i]))}
          </div>
        ) },
        { label: 'Selected · silhouette', node: (
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ aspectRatio: '1', maxWidth: 180, borderRadius: t.glass ? 10 : 2, background: sel != null && sel >= 0 ? CANDS[sel] : t.panel, border: `1px solid ${t.line}` }} />
            <span style={{ fontSize: 14, color: t.muted }}>Click a candidate to select it; the choice + prompt persist and write the icon path to the item record.</span>
          </div>
        ) },
        { label: 'Produce', node: (
          <CliProduce t={t} label="Generate via Leonardo (CLI)" rows={3}
            defaultDirection="weathered steel longsword, leather grip, guild sigil, 3/4 view, game icon"
            note="Prompt saved as a style ref; selected icon writes T_<item>_Icon."
            buildPrompt={(dir) => `Generate 4 icon candidates for ${entity.name} (256px, rarity frame). Art direction: ${dir}`}
            onComplete={() => produce(entity.id, step, ITEM_STEP_SPECS[step].produce(entity))} />
        ) },
      ]}
    />
  );
}

/** Items · 3D Generation. View: mesh preview + LOD/tris (persisted). Produce: Blender/Meshy. */
export function Item3DGen({ t, entity, step }: StepProps) {
  const art = useLabStep(entity.id, step);
  const produce = useLabPipelineStore((s) => s.produce);
  const tris = Number((art?.data?.tris as number) ?? 0);
  const made = tris > 0;

  return (
    <StepFrame t={t} acceptance={ITEM_STEP_SPECS[step].accept(art)}
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
            {made && art?.ueAssets?.[0] && <span className={t.fontMono} style={{ fontSize: 14, color: t.ok, marginTop: 4 }}>✓ {art.ueAssets[0]}</span>}
          </div>
        ) },
        { label: 'Produce', node: (
          <CliProduce t={t} label="Generate mesh (CLI)" rows={3}
            note={`Writes SM_${slug(entity.name)} + auto-LODs to the UE project.`}
            buildPrompt={(dir) => `Generate a base mesh for ${entity.name} from its icon + brief via Blender/Meshy, then auto-LOD. ${dir}`}
            onComplete={() => produce(entity.id, step, ITEM_STEP_SPECS[step].produce(entity))} />
        ) },
      ]}
    />
  );
}

/** Items · Material / Texture. View: PBR map set (persisted) + preview. Produce: generate maps. */
export function ItemMaterial({ t, entity, step }: StepProps) {
  const art = useLabStep(entity.id, step);
  const produce = useLabPipelineStore((s) => s.produce);
  const maps = (art?.data?.maps ?? []) as string[];
  const done = maps.length > 0;
  const SWATCH: Record<string, string> = { Albedo: '#b08d57', Normal: '#8088ff', ORM: '#9a9a4a', Height: '#777' };

  return (
    <StepFrame t={t} acceptance={ITEM_STEP_SPECS[step].accept(art)}
      panels={[
        { label: 'Texture maps', node: (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
            {['Albedo', 'Normal', 'ORM', 'Height'].map((name) => (
              <div key={name} style={{ display: 'grid', gap: 6 }}>
                <div style={{ aspectRatio: '1', borderRadius: t.glass ? 8 : 2, background: maps.includes(name) ? SWATCH[name] : t.panel, border: `1px solid ${t.line}` }} />
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
            note={`Writes MI_${slug(entity.name)} (Albedo/Normal/ORM) from the master material.`}
            buildPrompt={(dir) => `Author a PBR set for ${entity.name} from the master material; expose params + wear variants. ${dir}`}
            onComplete={() => produce(entity.id, step, ITEM_STEP_SPECS[step].produce(entity))} />
        ) },
      ]}
    />
  );
}
