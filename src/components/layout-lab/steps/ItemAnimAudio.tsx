'use client';

import { useState } from 'react';
import { StepFrame } from './StepFrame';
import { CliProduce } from './shared/CliProduce';
import type { LabTheme } from '../theme';
import type { LabEntity } from '../useLabCatalogData';

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

/** Items · Animations. View: clip set + source. Produce: retarget. Acceptance: required clips. */
export function ItemAnimations({ t, entity }: { t: LabTheme; entity: LabEntity }) {
  const [made, setMade] = useState(false);
  const clips = [['Pickup', '0.6s'], ['Equip', '0.8s'], ['Idle Loop', '2.0s'], ['Inspect', '1.4s']];
  return (
    <StepFrame t={t}
      acceptance={{ label: 'Required clips present (Pickup · Equip)', status: made ? 'pass' : 'pending', detail: made ? `${clips.length} clips` : '0 clips' }}
      panels={[
        { label: 'Clip set', node: <div>{clips.map(([n, d]) => <Row key={n} t={t} name={n} right={d} on={made} />)}</div> },
        { label: 'Skeleton · source', node: (
          <div style={{ display: 'grid', gap: 10 }}>
            <span className={t.fontMono} style={{ fontSize: 14, color: t.muted }}>skeleton: SK_Mannequin</span>
            <span style={{ fontSize: 14, color: t.muted, lineHeight: 1.55 }}>Clips retarget from the shared mannequin library; per-weapon timing comes from the Attributes step (attack speed).</span>
          </div>
        ) },
        { label: 'Produce', node: (
          <CliProduce t={t} label="Generate / retarget (CLI)" rows={3}
            note="Writes the equip/pickup/idle montages to the UE project."
            buildPrompt={(d) => `Generate/retarget pickup + equip + idle clips for ${entity.name} from SK_Mannequin. ${d}`.trim()}
            onComplete={() => setMade(true)} />
        ) },
      ]}
    />
  );
}

/** Items · VFX. View: variant set + GPU budget. Produce: Niagara. Acceptance: >=1 VFX + budget. */
export function ItemVFX({ t, entity }: { t: LabTheme; entity: LabEntity }) {
  const [made, setMade] = useState(false);
  const cost = made ? 0.4 : 0;
  const CAP = 0.8;
  const variants = [['Idle glow', 'small'], ['Equip flash', 'med'], ['Use trail', 'med']];
  return (
    <StepFrame t={t}
      acceptance={{ label: 'At least one VFX bound · GPU cost under budget', status: made && cost <= CAP ? 'pass' : 'pending', detail: made ? `${cost.toFixed(1)} / ${CAP} ms` : 'no vfx' }}
      panels={[
        { label: 'Variants', node: <div>{variants.map(([n, s]) => <Row key={n} t={t} name={n} right={s} on={made} />)}</div> },
        { label: 'GPU budget', node: (
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ height: 16, background: t.line, opacity: 0.4 }}><div style={{ width: `${(cost / CAP) * 100}%`, height: '100%', background: cost <= CAP ? t.ok : t.bad }} /></div>
            <span className={t.fontMono} style={{ fontSize: 14, color: t.muted }}>{cost.toFixed(1)} ms of {CAP} ms frame budget</span>
          </div>
        ) },
        { label: 'Produce', node: (
          <CliProduce t={t} label="Generate Niagara (CLI)" rows={3}
            note="Writes NS_<item> variants bound to anim notifies."
            buildPrompt={(d) => `Author Niagara variants (idle/equip/use) for ${entity.name} keyed to anim notifies, under ${CAP}ms GPU. ${d}`.trim()}
            onComplete={() => setMade(true)} />
        ) },
      ]}
    />
  );
}

/** Items · SFX. View: clip set + loudness. Produce: import set. Acceptance: required events. */
export function ItemSFX({ t, entity }: { t: LabTheme; entity: LabEntity }) {
  const [made, setMade] = useState(false);
  const clips = [['Pickup', '-14 LUFS'], ['Equip', '-13 LUFS'], ['Swing', '-12 LUFS']];
  return (
    <StepFrame t={t}
      acceptance={{ label: 'Required SFX events covered (pickup · equip · use)', status: made ? 'pass' : 'pending', detail: made ? `${clips.length} cues` : '0 cues' }}
      panels={[
        { label: 'Cues · loudness', node: <div>{clips.map(([n, d]) => <Row key={n} t={t} name={n} right={d} on={made} />)}</div> },
        { label: 'Waveform', node: (
          <svg viewBox="0 0 300 70" width="100%" height="70" style={{ marginTop: 4 }}>
            {Array.from({ length: 48 }, (_, i) => {
              const h = made ? (Math.sin(i * 0.7) * 0.5 + 0.5) * 56 + 4 : 2;
              return <rect key={i} x={i * 6.2} y={35 - h / 2} width={3.6} height={h} fill={made ? t.ink : t.line} opacity={made ? 0.8 : 0.4} />;
            })}
          </svg>
        ) },
        { label: 'Produce', node: (
          <CliProduce t={t} label="Import set (CLI)" rows={3}
            note="Imports a randomizing SoundCue set wired to anim notifies."
            buildPrompt={(d) => `Import a randomizing SoundCue set for ${entity.name} (pickup/equip/swing), normalized loudness. ${d}`.trim()}
            onComplete={() => setMade(true)} />
        ) },
      ]}
    />
  );
}
