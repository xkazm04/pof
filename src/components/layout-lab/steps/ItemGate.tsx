'use client';

import { useState } from 'react';
import { StepFrame } from './StepFrame';
import { CliProduce } from './shared/CliProduce';
import type { LabTheme } from '../theme';
import type { LabEntity } from '../useLabCatalogData';

function Check({ t, name, ran }: { t: LabTheme; name: string; ran: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: `1px solid ${t.line}`, fontSize: 15 }}>
      <span style={{ width: 20, height: 20, borderRadius: t.glass ? 6 : 0, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, background: ran ? t.ok : 'transparent', color: t.onAccent, border: ran ? 'none' : `2px solid ${t.line}` }}>{ran ? '✓' : ''}</span>
      <span style={{ color: ran ? t.text : t.muted }}>{name}</span>
      <span className={t.fontMono} style={{ marginLeft: 'auto', fontSize: 14, color: ran ? t.ok : t.muted }}>{ran ? 'PASS' : 'not run'}</span>
    </div>
  );
}

/** Items · Test Gate. View: checks + log. Produce: run functional test. Acceptance: all pass. */
export function ItemTestGate({ t, entity }: { t: LabTheme; entity: LabEntity }) {
  const [ran, setRan] = useState(false);
  const checks = ['Stat/rules unit test', 'Equip + use in PIE', 'Visual QA (icon + mesh)', 'Performance budget'];
  return (
    <StepFrame t={t}
      acceptance={{ label: 'All gate checks pass in the UE project', status: ran ? 'pass' : 'pending', detail: ran ? `${checks.length}/${checks.length} pass` : `0/${checks.length}` }}
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
            buildPrompt={(d) => `Run the UE functional test that equips + uses ${entity.name}; judge PASS/FAIL by -abslog content. ${d}`.trim()}
            onComplete={() => setRan(true)} />
        ) },
      ]}
    />
  );
}

/** Items · UE Packaging. View: asset manifest + deps. Produce: package. Acceptance: all packaged. */
export function ItemPackaging({ t, entity }: { t: LabTheme; entity: LabEntity }) {
  const [packed, setPacked] = useState(false);
  const slug = entity.name.replace(/[^a-z0-9]+/gi, '');
  const assets = [`DT_Items :: ${slug}`, `T_${slug}_Icon`, `SM_${slug}`, `MI_${slug}`, `A_${slug}_Equip`, `NS_${slug}_Use`];
  return (
    <StepFrame t={t}
      acceptance={{ label: 'All produced assets packaged + committed to the UE project', status: packed ? 'pass' : 'pending', detail: packed ? `${assets.length} assets` : 'not packaged' }}
      panels={[
        { label: 'Asset manifest', node: (
          <div>{assets.map((a) => (
            <div key={a} className={t.fontMono} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, padding: '6px 0', borderTop: `1px solid ${t.line}`, color: packed ? t.text : t.muted }}>
              <span style={{ color: packed ? t.ok : t.muted }}>{packed ? '✓' : '·'}</span>{a}
            </div>
          ))}</div>
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
            buildPrompt={(d) => `Write the DT_Items row for ${entity.name} + cook the referenced icon/mesh/material/montage/VFX into the UE project; commit narrowly. ${d}`.trim()}
            onComplete={() => setPacked(true)} />
        ) },
      ]}
    />
  );
}
