'use client';

import { GenerativeStepFrame } from './GenerativeStepFrame';
import { GeneratedAssetCaption, AssetTarget } from './shared/assetHonesty';
import { iconCandidates, meshCandidates, materialCandidates } from './shared/itemGenCandidates';
import { entitySlug, itemAsset } from './itemsSteps';
import type { GenCandidate } from './shared/genHistory';
import type { LabTheme } from '../theme';
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
 * unified checker context + server/judge overlays, the SELECTION provenance chip, the
 * raw-artifact disclosure, and the step's OWN generated art (`withGeneratedImages`).
 * Each step below contributes only its bespoke preview panels.
 *
 * ── Preview honesty (2026-08-19) ───────────────────────────────────────────────
 * Every panel here used to paint a fabrication as output: a CSS gradient captioned
 * `◈ LOD0 preview`, an LOD ladder computed as `tris/(i+1)`, four literal hex constants
 * standing in for Albedo/Normal/ORM/Height, and a green `✓ <UE path>` for a file nothing
 * wrote. Each now shows the REAL asset when one exists and otherwise names itself a
 * placeholder, and an asset path is labelled as the TARGET the drain writes.
 */

/** A square preview tile: the real generated image when there is one, else the candidate's
 *  own deterministic swatch (which the caption beside it always names as such). */
function PreviewTile({ t, selected, size }: { t: LabTheme; selected: GenCandidate | null; size?: number }) {
  return (
    <div style={{
      aspectRatio: '1', maxWidth: size ?? 180, borderRadius: t.glass ? 10 : 2,
      background: selected?.swatch ?? t.panel, border: `1px solid ${t.line}`, overflow: 'hidden',
    }}>
      {selected?.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- served blob from /api/visual-gen/icon; next/image adds no value for a local API stream
        <img src={selected.imageUrl} alt={selected.caption ?? 'selected generated asset'} loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      )}
    </div>
  );
}

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
      panels={({ art, selected }) => [
        { label: 'Selected · silhouette', node: (
          <div style={{ display: 'grid', gap: 12 }}>
            <PreviewTile t={t} selected={selected} />
            <GeneratedAssetCaption t={t} selected={selected} />
            {art?.ueAssets?.[0] && <AssetTarget t={t} path={art.ueAssets[0]} />}
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
        const cap = Number((art?.data?.cap as number) ?? 0);
        const made = tris > 0;
        return [
          { label: 'Mesh preview', node: (
            <div style={{ display: 'grid', gap: 10 }}>
              <PreviewTile t={t} selected={selected} size={220} />
              <GeneratedAssetCaption t={t} selected={selected}
                placeholder="Deterministic seed preview — not the generated mesh. No .glb is wired to this step yet." />
            </div>
          ) },
          { label: 'LOD0 · budget', node: (
            <div style={{ display: 'grid', gap: 8 }}>
              <div className={t.fontMono} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: made ? t.text : t.muted }}>
                <span>LOD0</span><span>{made ? tris : '—'} tris</span>
              </div>
              <div className={t.fontMono} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: t.muted }}>
                <span>budget cap</span><span>{cap > 0 ? cap : '—'} tris</span>
              </div>
              {/* The ladder used to print LOD1–LOD3 as tris/(i+1) — a derivation nothing
                  produced and no checker reads. Only LOD0 is on the artifact. */}
              <span style={{ fontSize: 14, color: t.muted, lineHeight: 1.55 }}>
                LOD1–LOD3 are built by the auto-LOD drain; no reduced triangle counts are recorded on this artifact.
              </span>
              {made && art?.ueAssets?.[0] && <AssetTarget t={t} path={art.ueAssets[0]} />}
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
        return [
          // The tiles used to be four literal hex constants presented as the textures
          // themselves. The artifact declares map NAMES and nothing else, so that is all
          // this panel may state.
          { label: 'Texture maps declared', node: (
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
                {['Albedo', 'Normal', 'ORM', 'Height'].map((name) => {
                  const on = maps.includes(name);
                  return (
                    <div key={name} className={t.fontMono} style={{
                      display: 'flex', alignItems: 'center', gap: 8, fontSize: 14,
                      padding: '8px 10px', borderRadius: t.glass ? 8 : 2,
                      border: `1px solid ${t.line}`, color: on ? t.text : t.muted,
                    }}>
                      <span style={{ color: on ? t.ok : t.muted }}>{on ? '✓' : '·'}</span>{name}
                    </div>
                  );
                })}
              </div>
              <span style={{ fontSize: 14, color: t.muted, lineHeight: 1.55 }}>
                Map names declared by the selected look — no texture is sampled, generated or previewed here.
              </span>
              {art?.ueAssets?.[0] && <AssetTarget t={t} path={art.ueAssets[0]} />}
            </div>
          ) },
          { label: 'Material preview', node: (
            <div style={{ display: 'grid', gap: 10, justifyItems: 'center' }}>
              <div style={{ width: 120, height: 120, borderRadius: 999, background: selected?.swatch ?? t.panel, border: `1px solid ${t.line}` }} />
              <GeneratedAssetCaption t={t} selected={null}
                placeholder="Deterministic seed preview — not the produced material. A reference-sphere render needs the material compiled in UE." />
            </div>
          ) },
        ];
      }}
    />
  );
}
