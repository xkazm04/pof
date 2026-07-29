'use client';
/* eslint-disable no-restricted-syntax -- art/swatch placeholders use bespoke preview colors by design */

import { GenerativeStepFrame } from './GenerativeStepFrame';
import { iconCandidates, meshCandidates, materialCandidates } from './shared/itemGenCandidates';
import { entitySlug, itemAsset } from './itemsSteps';
import type { StepProps } from './stepProps';

/**
 * The three generative Items steps ride the shared {@link GenerativeStepFrame}, which wraps
 * the shared `useGenerativeStep` engine (steps/shared/useGenerativeStep.ts) — one
 * browse→compare→select loop for both the bespoke Items generators and the generic
 * ArchetypeStep gallery. Each Produce run / re-roll appends a *kept* batch stamped with the
 * typed direction + prompt; selecting a candidate projects its payload onto the step's
 * top-level data so the derived Acceptance keeps reading `selected`/`tris`/`maps`.
 *
 * The frame also supplies the fleet honesty affordances these steps used to lack: the
 * unified checker context + server/judge overlays, the SELECTION provenance chip, and the
 * raw-artifact disclosure. Each step below contributes only its bespoke preview panels.
 */

/** Items · Icon 2D Art. View: persistent candidate gallery + selection. Produce: Leonardo gen. */
export function ItemIcon2D({ t, entity, step }: StepProps) {
  const asset = itemAsset(entity, 'T_', '_Icon');
  const DEFAULT_DIR = 'weathered steel longsword, leather grip, guild sigil, 3/4 view, game icon';
  return (
    <GenerativeStepFrame
      t={t} entity={entity} step={step}
      candidates={iconCandidates} base={{ ueAssets: [asset] }}
      defaultDirection={DEFAULT_DIR}
      buildPrompt={(dir) => `Generate 4 icon candidates for ${entity.name} (256px, rarity frame). Art direction: ${dir}`}
      produceLabel="Produce via Leonardo"
      produceNote="Every batch is kept; selecting a candidate writes T_<item>_Icon + stamps its prompt."
      galleryEmptyHint="No icon candidates yet — run Produce to generate the first batch."
      galleryFirst
      panels={({ selected }) => [
        { label: 'Selected · silhouette', node: (
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ aspectRatio: '1', maxWidth: 180, borderRadius: t.glass ? 10 : 2, background: selected?.swatch ?? t.panel, border: `1px solid ${t.line}` }} />
            <span style={{ fontSize: 14, color: t.muted }}>Pick any candidate from any batch; the choice + its prompt persist and write the icon path to the item record.</span>
          </div>
        ) },
      ]}
    />
  );
}

/** Items · 3D Generation. View: mesh preview + LOD budget (from the selected candidate) + gallery. */
export function Item3DGen({ t, entity, step }: StepProps) {
  const asset = itemAsset(entity, 'SM_');
  const DEFAULT_DIR = 'game-ready retopo, clean silhouette, hard-surface bevels';
  return (
    <GenerativeStepFrame
      t={t} entity={entity} step={step}
      candidates={meshCandidates} base={{ ueAssets: [asset] }}
      defaultDirection={DEFAULT_DIR}
      buildPrompt={(dir) => `Generate a base mesh for ${entity.name} from its icon + brief via Blender/Meshy, then auto-LOD. ${dir}`}
      produceLabel="Produce mesh"
      produceNote={`Each batch is kept; the selected variant writes SM_${entitySlug(entity)} + auto-LODs.`}
      galleryEmptyHint="No mesh candidates yet — run Produce to generate a batch of LOD0 variants."
      galleryColumns={3}
      panels={({ art, selected }) => {
        const tris = Number((art?.data?.tris as number) ?? 0);
        const made = tris > 0;
        return [
          { label: 'Mesh preview', node: (
            <div style={{ aspectRatio: '4/3', borderRadius: t.glass ? 10 : 2, border: `1px solid ${t.line}`, background: selected?.swatch ?? t.panel, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
        ];
      }}
    />
  );
}

/** Items · Material / Texture. View: PBR map set (from the selected candidate) + preview + gallery. */
export function ItemMaterial({ t, entity, step }: StepProps) {
  const asset = itemAsset(entity, 'MI_');
  const DEFAULT_DIR = 'PBR set from the master material; expose wear + tint params';
  const SWATCH: Record<string, string> = { Albedo: '#b08d57', Normal: '#8088ff', ORM: '#9a9a4a', Height: '#777' };
  return (
    <GenerativeStepFrame
      t={t} entity={entity} step={step}
      candidates={materialCandidates} base={{ ueAssets: [asset] }}
      defaultDirection={DEFAULT_DIR}
      buildPrompt={(dir) => `Author a PBR set for ${entity.name} from the master material; expose params + wear variants. ${dir}`}
      produceLabel="Produce PBR maps"
      produceNote={`Each look is kept; the selected one writes MI_${entitySlug(entity)} (Albedo/Normal/ORM).`}
      galleryEmptyHint="No material looks yet — run Produce to generate a batch of surface treatments."
      galleryColumns={3}
      panels={({ art, selected }) => {
        const maps = (art?.data?.maps ?? []) as string[];
        const done = maps.length > 0;
        return [
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
              <div style={{ width: 120, height: 120, borderRadius: 999, margin: '4px auto', background: done ? (selected?.swatch ?? 'radial-gradient(circle at 35% 30%, #e6c98a, #8a5a2b)') : t.panel, border: `1px solid ${t.line}` }} />
              <span style={{ fontSize: 14, color: t.muted, textAlign: 'center' }}>Reference-sphere preview · tiling + wear variants.</span>
            </div>
          ) },
        ];
      }}
    />
  );
}
