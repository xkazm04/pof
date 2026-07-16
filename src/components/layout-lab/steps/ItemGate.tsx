'use client';

import { StaticStepFrame } from './StaticStepFrame';
import { CliProduce } from './shared/CliProduce';
import { deriveGateChecks, type GateCheckResult } from './itemsSteps';
import { useEntitySteps } from '../labPipelineStore';
import type { LabTheme } from '../theme';
import type { StepProps } from './stepProps';

function Check({ t, check, ran }: { t: LabTheme; check: GateCheckResult; ran: boolean }) {
  const ok = ran && check.ok;
  const blocked = ran && !check.ok;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: `1px solid ${t.line}`, fontSize: 15 }}>
      <span style={{ width: 20, height: 20, borderRadius: t.glass ? 6 : 0, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, background: ok ? t.ok : blocked ? t.bad : 'transparent', color: t.onAccent, border: ok || blocked ? 'none' : `2px solid ${t.line}` }}>{ok ? '✓' : blocked ? '✕' : ''}</span>
      <span style={{ color: ok ? t.text : t.muted }}>
        {check.name}
        {blocked && <span style={{ display: 'block', fontSize: 13, color: t.muted, marginTop: 2 }}>blocked by {check.blockedBy.join(', ')}</span>}
      </span>
      <span className={t.fontMono} style={{ marginLeft: 'auto', fontSize: 14, color: ok ? t.ok : blocked ? t.bad : t.muted, flexShrink: 0 }}>{ok ? 'PASS' : blocked ? 'FAIL' : 'not run'}</span>
    </div>
  );
}

/** Fixed-width dotted log label, mirroring the UE -abslog visual convention. */
function logLine(name: string, ok: boolean): string {
  return `[gate] ${name} ${'.'.repeat(Math.max(2, 20 - name.length))} ${ok ? 'PASS' : 'FAIL'}`;
}

/** Items · Test Gate. View: checks + log — DERIVED from sibling-step acceptance
 *  (never fabricated; the gate can genuinely fail). Produce: run functional test. */
export function ItemTestGate({ t, entity, step }: StepProps) {
  const entitySteps = useEntitySteps(entity.id);
  return (
    <StaticStepFrame t={t} entity={entity} step={step} panels={({ art, runProduce }) => {
      const ran = art?.data?.ran === true || art?.data?.pass === true; // `pass` = legacy artifacts
      const siblings: Record<string, Record<string, unknown>> = {};
      for (const [s, a] of Object.entries(entitySteps ?? {})) siblings[s] = a.data;
      const results = deriveGateChecks(siblings);
      const allOk = results.every((r) => r.ok);
      return [
        { label: 'Checks', node: <div>{results.map((c) => <Check key={c.name} t={t} check={c} ran={ran} />)}</div> },
        { label: 'Log', node: (
          <pre className={t.fontMono} style={{ fontSize: 14, color: t.muted, whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.6 }}>
            {ran
              ? `[gate] ${entity.name}\n${results.map((r) => logLine(r.name, r.ok)).join('\n')}\nResult={${allOk ? 'Success' : 'Failure'}}`
              : '> awaiting run …'}
          </pre>
        ) },
        { label: 'Produce', node: (
          <CliProduce t={t} label="Run functional test (CLI)" rows={3}
            note="Runs the UE functional test; the gate verdict derives from upstream step acceptance — it fails while any upstream step fails."
            buildPrompt={(dir) => `Run the UE functional test that equips + uses ${entity.name}; judge PASS/FAIL by -abslog content. ${dir}`}
            onComplete={runProduce} />
        ) },
      ];
    }} />
  );
}

/** Items · UE Packaging. View: asset manifest + deps (persisted). Produce: package. */
export function ItemPackaging({ t, entity, step }: StepProps) {
  return (
    <StaticStepFrame t={t} entity={entity} step={step} panels={({ art, runProduce }) => {
      const assets = (art?.data?.assets ?? []) as string[];
      const packed = assets.length > 0;
      return [
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
            onComplete={runProduce} />
        ) },
      ];
    }} />
  );
}
