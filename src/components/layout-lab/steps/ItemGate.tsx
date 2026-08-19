'use client';

import { StaticStepFrame } from './StaticStepFrame';
import { CliProduce } from './shared/CliProduce';
import { deriveGateChecks, type GateCheckResult } from './itemsSteps';
import { useEntitySteps } from '../labPipelineStore';
import type { LabTheme } from '../theme';
import type { StepProps } from './stepProps';

/**
 * A gate check has THREE readings, not two. `deferred` is the one that was missing: every
 * upstream step still blocking the check is itself deferred (a generator or runtime that has
 * not run), so the check has not failed — it cannot be observed yet. Printing FAIL there sent
 * the operator hunting for a defect that does not exist; printing PASS (the older bug) claimed
 * a verification nobody performed.
 */
function verdictOf(check: GateCheckResult, ran: boolean): 'pass' | 'defer' | 'fail' | 'idle' {
  if (!ran) return 'idle';
  if (check.ok) return 'pass';
  return check.deferred ? 'defer' : 'fail';
}

const GLYPH = { pass: '✓', defer: '◐', fail: '✕', idle: '' } as const;
const WORD = { pass: 'PASS', defer: 'DEFER', fail: 'FAIL', idle: 'not run' } as const;

function Check({ t, check, ran }: { t: LabTheme; check: GateCheckResult; ran: boolean }) {
  const v = verdictOf(check, ran);
  const tone = v === 'pass' ? t.ok : v === 'fail' ? t.bad : v === 'defer' ? t.warn : t.muted;
  const filled = v === 'pass' || v === 'fail' || v === 'defer';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: `1px solid ${t.line}`, fontSize: 15 }}>
      <span style={{ width: 20, height: 20, borderRadius: t.glass ? 6 : 0, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, background: filled ? tone : 'transparent', color: t.onAccent, border: filled ? 'none' : `2px solid ${t.line}` }}>{GLYPH[v]}</span>
      <span style={{ color: v === 'pass' ? t.text : t.muted }}>
        {check.name}
        {(v === 'fail' || v === 'defer') && (
          <span style={{ display: 'block', fontSize: 13, color: t.muted, marginTop: 2 }}>
            {v === 'defer' ? 'awaiting ' : 'blocked by '}{check.blockedBy.join(', ')}
          </span>
        )}
      </span>
      <span className={t.fontMono} style={{ marginLeft: 'auto', fontSize: 14, color: tone, flexShrink: 0 }}>{WORD[v]}</span>
    </div>
  );
}

/** Fixed-width dotted log label, mirroring the UE -abslog visual convention. */
function logLine(name: string, verdict: 'pass' | 'defer' | 'fail' | 'idle'): string {
  return `[gate] ${name} ${'.'.repeat(Math.max(2, 20 - name.length))} ${WORD[verdict]}`;
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
      // Same three-state reading the derived Acceptance uses, so the log can never print
      // `Result={Success}` next to a banner that says otherwise (it did: an upstream step the
      // SERVER had already condemned still printed PASS here).
      const outcome = allOk ? 'Success' : results.every((r) => r.ok || r.deferred) ? 'Deferred' : 'Failure';
      return [
        { label: 'Checks', node: <div>{results.map((c) => <Check key={c.name} t={t} check={c} ran={ran} />)}</div> },
        { label: 'Log', node: (
          <pre className={t.fontMono} style={{ fontSize: 14, color: t.muted, whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.6 }}>
            {ran
              ? `[gate] ${entity.name}\n${results.map((r) => logLine(r.name, verdictOf(r, ran))).join('\n')}\nResult={${outcome}}`
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
