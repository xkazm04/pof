'use client';
/* eslint-disable no-restricted-syntax -- art/swatch placeholders use bespoke preview colors by design */

import { StepFrame } from './StepFrame';
import { CliProduce } from './shared/CliProduce';
import { CandidateGallery } from './shared/CandidateGallery';
import { readHistory, makeBatch, appendBatch, selectCandidate, selectedCandidate, historyData } from './shared/genHistory';
import { iconCandidates, meshCandidates, materialCandidates } from './shared/itemGenCandidates';
import { useLabStep, useLabPipelineStore } from '../labPipelineStore';
import { ITEM_STEP_SPECS, slug, itemAsset } from './itemsSteps';
import type { StepProps } from './stepProps';
import type { GenCandidate } from './shared/genHistory';

type RawCandidate = Omit<GenCandidate, 'id'>;

/**
 * Shared plumbing for the three generative Items steps. Each Produce run / re-roll
 * appends a *kept* batch (never discarding prior candidates) stamped with the typed
 * direction + prompt; selecting a candidate projects its payload onto the step's
 * top-level data so the existing derived Acceptance keeps reading `selected`/`tris`/`maps`.
 */
function useGenerativeStep(entityId: string, step: string, gen: (direction: string, seq: number) => RawCandidate[], ueAssets: string[]) {
  const art = useLabStep(entityId, step);
  const produceFrom = useLabPipelineStore((s) => s.produceFrom);
  const history = readHistory(art?.data);

  const generate = (direction: string, prompt: string) => {
    // Build the batch from LIVE persisted state inside the store updater, not from this
    // render's `history` closure: a double-click would otherwise have both handlers read
    // batches.length === N, both mint batch bN, and the second overwrite the first (batch lost).
    produceFrom(entityId, step, (prevData) => {
      const live = readHistory(prevData);
      const seq = live.batches.length;
      const batch = makeBatch({ seq, at: new Date().toISOString(), direction, prompt, candidates: gen(direction, seq) });
      return { data: historyData(appendBatch(live, batch)), ueAssets };
    });
  };
  const reselect = (candidateId: string) => {
    produceFrom(entityId, step, (prevData) => ({
      data: historyData(selectCandidate(readHistory(prevData), candidateId)),
      ueAssets,
    }));
  };
  return { art, history, generate, reselect };
}

/** Items · Icon 2D Art. View: persistent candidate gallery + selection. Produce: Leonardo gen. */
export function ItemIcon2D({ t, entity, step }: StepProps) {
  const asset = itemAsset(entity, 'T_', '_Icon');
  const { art, history, generate, reselect } = useGenerativeStep(entity.id, step, iconCandidates, [asset]);
  const DEFAULT_DIR = 'weathered steel longsword, leather grip, guild sigil, 3/4 view, game icon';
  const buildPrompt = (dir: string) => `Generate 4 icon candidates for ${entity.name} (256px, rarity frame). Art direction: ${dir}`;
  const sel = selectedCandidate(history);

  return (
    <StepFrame t={t} acceptance={ITEM_STEP_SPECS[step].accept(art?.data ?? {})}
      onFix={(fixDir) => generate(fixDir ?? DEFAULT_DIR, buildPrompt(fixDir ?? DEFAULT_DIR))}
      panels={[
        { label: 'Candidate gallery (kept across re-rolls)', node: (
          <CandidateGallery t={t} history={history} onSelect={reselect}
            emptyHint="No icon candidates yet — run Produce to generate the first batch." />
        ) },
        { label: 'Selected · silhouette', node: (
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ aspectRatio: '1', maxWidth: 180, borderRadius: t.glass ? 10 : 2, background: sel?.swatch ?? t.panel, border: `1px solid ${t.line}` }} />
            <span style={{ fontSize: 14, color: t.muted }}>Pick any candidate from any batch; the choice + its prompt persist and write the icon path to the item record.</span>
          </div>
        ) },
        { label: 'Produce', node: (
          <CliProduce t={t} label="Generate via Leonardo (CLI)" rows={3}
            defaultDirection={DEFAULT_DIR}
            note="Every batch is kept; selecting a candidate writes T_<item>_Icon + stamps its prompt."
            buildPrompt={buildPrompt}
            onComplete={(ctx) => generate(ctx?.direction ?? DEFAULT_DIR, ctx?.prompt ?? buildPrompt(DEFAULT_DIR))} />
        ) },
      ]}
    />
  );
}

/** Items · 3D Generation. View: mesh preview + LOD budget (from the selected candidate) + gallery. */
export function Item3DGen({ t, entity, step }: StepProps) {
  const asset = itemAsset(entity, 'SM_');
  const { art, history, generate, reselect } = useGenerativeStep(entity.id, step, meshCandidates, [asset]);
  const DEFAULT_DIR = 'game-ready retopo, clean silhouette, hard-surface bevels';
  const buildPrompt = (dir: string) => `Generate a base mesh for ${entity.name} from its icon + brief via Blender/Meshy, then auto-LOD. ${dir}`;
  const tris = Number((art?.data?.tris as number) ?? 0);
  const made = tris > 0;

  return (
    <StepFrame t={t} acceptance={ITEM_STEP_SPECS[step].accept(art?.data ?? {})}
      onFix={(fixDir) => generate(fixDir ?? DEFAULT_DIR, buildPrompt(fixDir ?? DEFAULT_DIR))}
      panels={[
        { label: 'Mesh preview', node: (
          <div style={{ aspectRatio: '4/3', borderRadius: t.glass ? 10 : 2, border: `1px solid ${t.line}`, background: selectedCandidate(history)?.swatch ?? t.panel, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
        { label: 'Candidate gallery (kept across re-rolls)', node: (
          <CandidateGallery t={t} history={history} onSelect={reselect} columns={3}
            emptyHint="No mesh candidates yet — run Produce to generate a batch of LOD0 variants." />
        ) },
        { label: 'Produce', node: (
          <CliProduce t={t} label="Generate mesh (CLI)" rows={3}
            defaultDirection={DEFAULT_DIR}
            note={`Each batch is kept; the selected variant writes SM_${slug(entity.name)} + auto-LODs.`}
            buildPrompt={buildPrompt}
            onComplete={(ctx) => generate(ctx?.direction ?? DEFAULT_DIR, ctx?.prompt ?? buildPrompt(DEFAULT_DIR))} />
        ) },
      ]}
    />
  );
}

/** Items · Material / Texture. View: PBR map set (from the selected candidate) + preview + gallery. */
export function ItemMaterial({ t, entity, step }: StepProps) {
  const asset = itemAsset(entity, 'MI_');
  const { art, history, generate, reselect } = useGenerativeStep(entity.id, step, materialCandidates, [asset]);
  const DEFAULT_DIR = 'PBR set from the master material; expose wear + tint params';
  const buildPrompt = (dir: string) => `Author a PBR set for ${entity.name} from the master material; expose params + wear variants. ${dir}`;
  const maps = (art?.data?.maps ?? []) as string[];
  const done = maps.length > 0;
  const SWATCH: Record<string, string> = { Albedo: '#b08d57', Normal: '#8088ff', ORM: '#9a9a4a', Height: '#777' };

  return (
    <StepFrame t={t} acceptance={ITEM_STEP_SPECS[step].accept(art?.data ?? {})}
      onFix={(fixDir) => generate(fixDir ?? DEFAULT_DIR, buildPrompt(fixDir ?? DEFAULT_DIR))}
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
            <div style={{ width: 120, height: 120, borderRadius: 999, margin: '4px auto', background: done ? (selectedCandidate(history)?.swatch ?? 'radial-gradient(circle at 35% 30%, #e6c98a, #8a5a2b)') : t.panel, border: `1px solid ${t.line}` }} />
            <span style={{ fontSize: 14, color: t.muted, textAlign: 'center' }}>Reference-sphere preview · tiling + wear variants.</span>
          </div>
        ) },
        { label: 'Candidate gallery (kept across re-rolls)', node: (
          <CandidateGallery t={t} history={history} onSelect={reselect} columns={3}
            emptyHint="No material looks yet — run Produce to generate a batch of surface treatments." />
        ) },
        { label: 'Produce', node: (
          <CliProduce t={t} label="Generate PBR maps (CLI)" rows={3}
            defaultDirection={DEFAULT_DIR}
            note={`Each look is kept; the selected one writes MI_${slug(entity.name)} (Albedo/Normal/ORM).`}
            buildPrompt={buildPrompt}
            onComplete={(ctx) => generate(ctx?.direction ?? DEFAULT_DIR, ctx?.prompt ?? buildPrompt(DEFAULT_DIR))} />
        ) },
      ]}
    />
  );
}
