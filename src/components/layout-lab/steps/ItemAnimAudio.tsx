'use client';

import { StepFrame } from './StepFrame';
import { CliProduce } from './shared/CliProduce';
import { ChartPanel } from './shared/ChartPanel';
import { useStaticStep } from './useStaticStep';
import { ITEM_STEP_SPECS, slug, DEFAULT_ANIM_CLIPS, DEFAULT_VFX_VARIANTS, DEFAULT_SFX_CUES } from './itemsSteps';
import type { LabTheme } from '../theme';
import type { StepProps } from './stepProps';

/** Deterministic sample bank for the SFX waveform — derived once, not per render. */
const WAVEFORM_SAMPLES = Array.from({ length: 48 }, (_, i) => Math.sin(i * 0.7) * 0.5 + 0.5);

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
  const { art, runProduce } = useStaticStep(entity, step);
  const clips = (art?.data?.clips ?? []) as [string, string][];
  const rows = clips.length ? clips : DEFAULT_ANIM_CLIPS;
  const made = clips.length > 0;

  return (
    <StepFrame t={t} acceptance={ITEM_STEP_SPECS[step].accept(art?.data ?? {})}
      onFix={runProduce}
      panels={[
        { label: 'Clip set', node: <div>{rows.map(([n, dur]) => <Row key={n} t={t} name={n} right={dur} on={made} />)}</div> },
        { label: 'Skeleton · source', node: (
          <div style={{ display: 'grid', gap: 10 }}>
            <span className={t.fontMono} style={{ fontSize: 14, color: t.muted }}>skeleton: SK_Mannequin</span>
            <span style={{ fontSize: 14, color: t.muted, lineHeight: 1.55 }}>Clips retarget from the shared mannequin library; per-weapon timing comes from the Attributes step (attack speed).</span>
            {made && art?.ueAssets?.[0] && <span className={t.fontMono} style={{ fontSize: 14, color: t.ok }}>✓ {art.ueAssets[0]}</span>}
          </div>
        ) },
        { label: 'Produce', node: (
          <CliProduce t={t} label="Generate / retarget (CLI)" rows={3}
            note={`Writes A_${slug(entity.name)}_Equip + pickup/idle montages to the UE project.`}
            buildPrompt={(dir) => `Generate/retarget pickup + equip + idle clips for ${entity.name} from SK_Mannequin. ${dir}`}
            onComplete={runProduce} />
        ) },
      ]}
    />
  );
}

/** Items · VFX. View: variant set + GPU budget (persisted). Produce: Niagara. */
export function ItemVFX({ t, entity, step }: StepProps) {
  const { art, runProduce } = useStaticStep(entity, step);
  const variants = (art?.data?.variants ?? []) as [string, string][];
  const made = variants.length > 0;
  const cost = Number((art?.data?.cost as number) ?? 0);
  const CAP = Number((art?.data?.cap as number) ?? 0.8);

  return (
    <StepFrame t={t} acceptance={ITEM_STEP_SPECS[step].accept(art?.data ?? {})}
      onFix={runProduce}
      panels={[
        { label: 'Variants', node: <div>{(made ? variants : DEFAULT_VFX_VARIANTS).map(([n, s]) => <Row key={n} t={t} name={n} right={s} on={made} />)}</div> },
        { label: 'GPU budget', node: (
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ height: 16, background: t.line, opacity: 0.4 }}><div style={{ width: `${(cost / CAP) * 100}%`, height: '100%', background: cost <= CAP ? t.ok : t.bad }} /></div>
            <span className={t.fontMono} style={{ fontSize: 14, color: t.muted }}>{cost.toFixed(1)} ms of {CAP} ms frame budget</span>
          </div>
        ) },
        { label: 'Produce', node: (
          <CliProduce t={t} label="Generate Niagara (CLI)" rows={3}
            note={`Writes NS_${slug(entity.name)}_Use bound to anim notifies.`}
            buildPrompt={(dir) => `Author Niagara variants (idle/equip/use) for ${entity.name} keyed to anim notifies, under ${CAP}ms GPU. ${dir}`}
            onComplete={runProduce} />
        ) },
      ]}
    />
  );
}

/** Items · SFX. View: cue set + loudness + waveform (persisted). Produce: import set. */
export function ItemSFX({ t, entity, step }: StepProps) {
  const { art, runProduce } = useStaticStep(entity, step);
  const cues = (art?.data?.cues ?? []) as [string, string][];
  const made = cues.length > 0;
  const rows = made ? cues : DEFAULT_SFX_CUES;

  return (
    <StepFrame t={t} acceptance={ITEM_STEP_SPECS[step].accept(art?.data ?? {})}
      onFix={runProduce}
      panels={[
        { label: 'Cues · loudness', node: <div>{rows.map(([n, dur]) => <Row key={n} t={t} name={n} right={dur} on={made} />)}</div> },
        { label: 'Waveform', node: (
          <ChartPanel t={t} variant="waveform" samples={WAVEFORM_SAMPLES} active={made}
            ariaLabel={`SFX waveform — ${made ? 'imported' : 'idle'}`} />
        ) },
        { label: 'Produce', node: (
          <CliProduce t={t} label="Import set (CLI)" rows={3}
            note={`Imports SC_${slug(entity.name)} (randomizing SoundCue set) wired to anim notifies.`}
            buildPrompt={(dir) => `Import a randomizing SoundCue set for ${entity.name} (pickup/equip/swing), normalized loudness. ${dir}`}
            onComplete={runProduce} />
        ) },
      ]}
    />
  );
}
