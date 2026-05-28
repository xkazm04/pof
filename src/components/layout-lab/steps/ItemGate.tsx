'use client';

import { StepFrame } from './StepFrame';
import { CliProduce } from './shared/CliProduce';
import { useLabStep, useLabPipelineStore } from '../labPipelineStore';
import { ITEM_STEP_SPECS } from './itemsSteps';
import type { LabTheme } from '../theme';
import type { StepProps } from './stepProps';

function Check({ t, name, ran }: { t: LabTheme; name: string; ran: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: `1px solid ${t.line}`, fontSize: 15 }}>
      <span style={{ width: 20, height: 20, borderRadius: t.glass ? 6 : 0, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, background: ran ? t.ok : 'transparent', color: t.onAccent, border: ran ? 'none' : `2px solid ${t.line}` }}>{ran ? '✓' : ''}</span>
      <span style={{ color: ran ? t.text : t.muted }}>{name}</span>
      <span className={t.fontMono} style={{ marginLeft: 'auto', fontSize: 14, color: ran ? t.ok : t.muted }}>{ran ? 'PASS' : 'not run'}</span>
    </div>
  );
}

/** Items · Test Gate. View: checks + log (persisted). Produce: run functional test. */
export function ItemTestGate({ t, entity, step }: StepProps) {
  const art = useLabStep(entity.id, step);
  const produce = useLabPipelineStore((s) => s.produce);
  const ran = art?.data?.pass === true;
  const checks = (art?.data?.checks ?? ['Stat/rules unit test', 'Equip + use in PIE', 'Visual QA (icon + mesh)', 'Performance budget']) as string[];

  return (
    <StepFrame t={t} acceptance={ITEM_STEP_SPECS[step].accept(art)}
      onFix={() => produce(entity.id, step, ITEM_STEP_SPECS[step].produce(entity))}
      panels={[
        { label: 'Checks', node: <div>{checks.map((c) => <Check key={c} t={t} name={c} ran={ran} />)}</div> },
        { label: 'Log', node: (
          <pre className={t.fontMono} style={{ fontSize: 14, color: t.muted, whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.6 }}>
            {ran
              ? `[gate] ${entity.name}\n[gate] rules ........ PASS\n[gate] PIE equip ... PASS\n[gate] visual ...... PASS\n[gate] perf ........ PASS\nResult={Success}`
              : '> awaiting run …'}
          </pre>
        ) },
        { label: 'Produce', node: (
          <CliProduce t={t} label="Run functional test (CLI)" rows={3}
            note="Runs the UE functional test; the gate is judged by the -abslog, not the exit code."
            buildPrompt={(dir) => `Run the UE functional test that equips + uses ${entity.name}; judge PASS/FAIL by -abslog content. ${dir}`}
            onComplete={() => produce(entity.id, step, ITEM_STEP_SPECS[step].produce(entity))} />
        ) },
      ]}
    />
  );
}

/** Items · UE Packaging. View: asset manifest + deps (persisted). Produce: package. */
export function ItemPackaging({ t, entity, step }: StepProps) {
  const art = useLabStep(entity.id, step);
  const produce = useLabPipelineStore((s) => s.produce);
  const assets = (art?.data?.assets ?? []) as string[];
  const packed = assets.length > 0;

  return (
    <StepFrame t={t} acceptance={ITEM_STEP_SPECS[step].accept(art)}
      onFix={() => produce(entity.id, step, ITEM_STEP_SPECS[step].produce(entity))}
      panels={[
        { label: 'Asset manifest', node: (
          packed
            ? <div>{assets.map((a) => (
                <div key={a} className={t.fontMono} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, padding: '6px 0', borderTop: `1px solid ${t.line}`, color: t.text }}>
                  <span style={{ color: t.ok }}>✓</span>{a}
                </div>
              ))}</div>
            : <span style={{ fontSize: 15, color: t.muted }}>Nothing packaged yet — run Produce after the upstream steps.</span>
        ) },
        { label: 'Dependencies', node: (
          <div style={{ display: 'grid', gap: 8 }}>
            <span style={{ fontSize: 14, color: t.muted, lineHeight: 1.55 }}>Row references the icon texture, mesh, material instance, equip montage, and use VFX produced by the earlier steps.</span>
            <span className={t.fontMono} style={{ fontSize: 14, color: packed ? t.ok : t.warn }}>{packed ? 'all dependencies resolved' : 'awaiting upstream steps'}</span>
          </div>
        ) },
        { label: 'Produce', node: (
          <CliProduce t={t} label="Package to UE (CLI)" rows={3}
            note={`Writes the DT_Items row for ${entity.name} + cooks referenced assets; commits narrowly.`}
            buildPrompt={(dir) => `Write the DT_Items row for ${entity.name} + cook the referenced icon/mesh/material/montage/VFX into the UE project; commit narrowly. ${dir}`}
            onComplete={() => produce(entity.id, step, ITEM_STEP_SPECS[step].produce(entity))} />
        ) },
      ]}
    />
  );
}
