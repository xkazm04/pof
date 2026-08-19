'use client';

import { StaticStepFrame } from './StaticStepFrame';
import { CliProduce } from './shared/CliProduce';
import { ChartPanel } from './shared/ChartPanel';
import { AssetTarget } from './shared/assetHonesty';
import { entitySlug, DEFAULT_ANIM_CLIPS, DEFAULT_VFX_VARIANTS, DEFAULT_SFX_CUES } from './itemsSteps';
import type { LabTheme } from '../theme';
import type { StepProps } from './stepProps';

/**
 * Deterministic sample bank for the SFX strip — derived once, not per render.
 *
 * It is a SYNTHETIC sine trace, not the item's audio: the SFX artifact carries cue names
 * and loudness targets only (`itemsSteps.ts` → `{ cues }`), and nothing in this pipeline
 * decodes a SoundCue. It used to render unlabelled beside "Cues · loudness", reading as the
 * produced waveform; the panel now says what it is. When a future produce writes real
 * samples on `data.waveform`, {@link ItemSFX} shows those instead and drops the caveat.
 */
const PLACEHOLDER_SAMPLES = Array.from({ length: 48 }, (_, i) => Math.sin(i * 0.7) * 0.5 + 0.5);

function Row({ t, name, right, on }: { t: LabTheme; name: string; right: string; on: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderTop: `1px solid ${t.line}`, fontSize: 15 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: on ? t.text : t.muted }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: on ? t.ok : t.line, flexShrink: 0 }} />{name}
      </span>
      <span className={t.fontMono} style={{ fontSize: 14, color: on ? t.inkDeep : t.muted }}>{on ? right : '—'}</span>
    </div>
  );
}

/** Items · Animations. View: clip set (persisted). Produce: retarget. */
export function ItemAnimations({ t, entity, step }: StepProps) {
  return (
    <StaticStepFrame t={t} entity={entity} step={step} panels={({ art, runProduce }) => {
      const clips = (art?.data?.clips ?? []) as [string, string][];
      const rows = clips.length ? clips : DEFAULT_ANIM_CLIPS;
      const made = clips.length > 0;
      return [
        { label: 'Clip set', node: <div>{rows.map(([n, dur]) => <Row key={n} t={t} name={n} right={dur} on={made} />)}</div> },
        { label: 'Skeleton · source', node: (
          <div style={{ display: 'grid', gap: 10 }}>
            <span className={t.fontMono} style={{ fontSize: 14, color: t.muted }}>skeleton: SK_Mannequin</span>
            <span style={{ fontSize: 14, color: t.muted, lineHeight: 1.55 }}>Clips retarget from the shared mannequin library; per-weapon timing comes from the Attributes step (attack speed).</span>
            {made && art?.ueAssets?.[0] && <AssetTarget t={t} path={art.ueAssets[0]} />}
          </div>
        ) },
        { label: 'Produce', node: (
          <CliProduce t={t} label="Produce anim / retarget" rows={3}
            note={`Writes A_${entitySlug(entity)}_Equip + pickup/idle montages to the UE project.`}
            buildPrompt={(dir) => `Generate/retarget pickup + equip + idle clips for ${entity.name} from SK_Mannequin. ${dir}`}
            onComplete={runProduce} />
        ) },
      ];
    }} />
  );
}

/** Items · VFX. View: variant set + GPU budget (persisted). Produce: Niagara. */
export function ItemVFX({ t, entity, step }: StepProps) {
  return (
    <StaticStepFrame t={t} entity={entity} step={step} panels={({ art, runProduce }) => {
      const variants = (art?.data?.variants ?? []) as [string, string][];
      const made = variants.length > 0;
      const cost = Number((art?.data?.cost as number) ?? 0);
      const CAP = Number((art?.data?.cap as number) ?? 0.8);
      return [
        { label: 'Variants', node: <div>{(made ? variants : DEFAULT_VFX_VARIANTS).map(([n, s]) => <Row key={n} t={t} name={n} right={s} on={made} />)}</div> },
        { label: 'GPU budget', node: (
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ height: 16, background: t.line, opacity: 0.4 }}><div style={{ width: `${(cost / CAP) * 100}%`, height: '100%', background: cost <= CAP ? t.ok : t.bad }} /></div>
            <span className={t.fontMono} style={{ fontSize: 14, color: t.muted }}>{cost.toFixed(1)} ms of {CAP} ms frame budget</span>
          </div>
        ) },
        { label: 'Produce', node: (
          <CliProduce t={t} label="Produce Niagara" rows={3}
            note={`Writes NS_${entitySlug(entity)}_Use bound to anim notifies.`}
            buildPrompt={(dir) => `Author Niagara variants (idle/equip/use) for ${entity.name} keyed to anim notifies, under ${CAP}ms GPU. ${dir}`}
            onComplete={runProduce} />
        ) },
      ];
    }} />
  );
}

/** Items · SFX. View: cue set + loudness + waveform (persisted). Produce: import set. */
export function ItemSFX({ t, entity, step }: StepProps) {
  return (
    <StaticStepFrame t={t} entity={entity} step={step} panels={({ art, runProduce }) => {
      const cues = (art?.data?.cues ?? []) as [string, string][];
      const made = cues.length > 0;
      const rows = made ? cues : DEFAULT_SFX_CUES;
      const recorded = (art?.data?.waveform ?? null) as number[] | null;
      const real = Array.isArray(recorded) && recorded.length > 0;
      return [
        { label: 'Cues · loudness', node: <div>{rows.map(([n, dur]) => <Row key={n} t={t} name={n} right={dur} on={made} />)}</div> },
        { label: real ? 'Waveform' : 'Waveform (placeholder)', node: (
          <div style={{ display: 'grid', gap: 8 }}>
            <ChartPanel t={t} variant="waveform" samples={real ? recorded : PLACEHOLDER_SAMPLES} active={made}
              ariaLabel={real ? 'SFX waveform — recorded samples' : 'placeholder waveform — not the produced audio'} />
            <span data-testid="sfx-waveform-provenance" style={{ fontSize: 14, color: t.muted, lineHeight: 1.55 }}>
              {real
                ? 'Samples recorded on this step’s artifact.'
                : 'Synthetic trace — not the produced audio. This step’s artifact records cue names and loudness targets only; nothing here decodes a SoundCue.'}
            </span>
          </div>
        ) },
        { label: 'Produce', node: (
          <CliProduce t={t} label="Import set (CLI)" rows={3}
            note={`Imports SC_${entitySlug(entity)} (randomizing SoundCue set) wired to anim notifies.`}
            buildPrompt={(dir) => `Import a randomizing SoundCue set for ${entity.name} (pickup/equip/swing), normalized loudness. ${dir}`}
            onComplete={runProduce} />
        ) },
      ];
    }} />
  );
}
