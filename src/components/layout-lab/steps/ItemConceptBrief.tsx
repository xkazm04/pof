'use client';

import { useState } from 'react';
import { StepFrame } from './StepFrame';
import { Lbl, LabButton, LabTextarea, LabInput } from './controls';
import type { LabTheme } from '../theme';
import type { LabEntity } from '../useLabCatalogData';

const MIN = 300;
const REFS = [
  ['Steel Saber', 'A guardsman\'s reliable sidearm — clean lines, municipal issue.'],
  ['Worn Greatsword', 'A heirloom past its prime; pitted steel, a story in every notch.'],
  ['Iron Mace', 'Blunt, brutal, peasant-levy gear — function over grace.'],
];

function seedBrief(name: string, dir: string): string {
  const base = `${name} is a mid-tier martial weapon forged for frontline duelists. It favors disciplined, rhythmic strikes over raw burst — rewarding players who weave light and heavy attacks rather than spamming a single button. Visually it reads as weathered steel with a leather-wrapped grip and a faint guild sigil etched near the crossguard. Intended player feeling: dependable and earned — a soldier's tool, not a hero's relic.`;
  return dir.trim() ? `${base}\n\nDirection applied: ${dir.trim()}.` : base;
}

/** Items · Step 1 — Concept Brief. View: brief + style refs. Produce: CLI text-gen. Acceptance: char count. */
export function ItemConceptBrief({ t, entity }: { t: LabTheme; entity: LabEntity }) {
  const [brief, setBrief] = useState(() => seedBrief(entity.name, ''));
  const [dir, setDir] = useState('');
  const status = brief.length >= MIN ? 'pass' : 'pending';

  return (
    <StepFrame
      t={t}
      acceptance={{ label: `Brief is at least ${MIN} characters`, status, detail: `${brief.length} / ${MIN} chars` }}
      panels={[
        {
          label: 'Current brief',
          node: <div style={{ fontSize: 15, lineHeight: 1.75, color: t.text, whiteSpace: 'pre-wrap' }}>{brief}</div>,
        },
        {
          label: 'Style references (peers)',
          node: (
            <div style={{ display: 'grid', gap: 12 }}>
              {REFS.map(([n, blurb]) => (
                <div key={n} style={{ borderLeft: `2px solid ${t.line}`, paddingLeft: 12 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: t.inkDeep }}>{n}</div>
                  <div style={{ fontSize: 14, color: t.muted, lineHeight: 1.5 }}>{blurb}</div>
                </div>
              ))}
              <span className={t.fontMono} style={{ fontSize: 14, color: t.muted }}>Saved briefs are reused as tone references for the catalog.</span>
            </div>
          ),
        },
        {
          label: 'Produce',
          node: (
            <div style={{ display: 'grid', gap: 12 }}>
              <Lbl t={t}>Direction (optional)</Lbl>
              <LabInput t={t} value={dir} onChange={setDir} placeholder="e.g. darker, ceremonial, dwarven" />
              <Lbl t={t}>Brief draft</Lbl>
              <LabTextarea t={t} value={brief} onChange={setBrief} rows={9} />
              <LabButton t={t} onClick={() => setBrief(seedBrief(entity.name, dir))}>⚡ Generate with CLI</LabButton>
              <span className={t.fontMono} style={{ fontSize: 14, color: t.muted }}>Saved to DB · feeds the UE item description.</span>
            </div>
          ),
        },
      ]}
    />
  );
}
