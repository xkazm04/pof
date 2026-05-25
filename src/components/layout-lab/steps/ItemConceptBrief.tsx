'use client';

import { useState } from 'react';
import { StepFrame } from './StepFrame';
import { Lbl, LabButton, LabTextarea, LabInput } from './controls';
import type { LabTheme } from '../theme';
import type { LabEntity } from '../useLabCatalogData';

const MIN = 300;

function seedBrief(name: string, dir: string): string {
  const base = `${name} is a mid-tier martial weapon forged for frontline duelists. It favors disciplined, rhythmic strikes over raw burst — rewarding players who weave light and heavy attacks rather than spamming a single button. Visually it reads as weathered steel with a leather-wrapped grip and a faint guild sigil etched near the crossguard. Intended player feeling: dependable and earned — a soldier's tool, not a hero's relic.`;
  return dir.trim() ? `${base}\n\nDirection applied: ${dir.trim()}.` : base;
}

/** Items · Step 1 — Concept Brief. View: brief prose. Produce: CLI text-gen + direction. Acceptance: char count. */
export function ItemConceptBrief({ t, entity }: { t: LabTheme; entity: LabEntity }) {
  const [brief, setBrief] = useState(() => seedBrief(entity.name, ''));
  const [dir, setDir] = useState('');
  const status = brief.length >= MIN ? 'pass' : 'pending';

  return (
    <StepFrame
      t={t}
      acceptance={{ label: `Brief is at least ${MIN} characters`, status, detail: `${brief.length} / ${MIN} chars` }}
      view={<div style={{ fontSize: 15, lineHeight: 1.75, color: t.text, whiteSpace: 'pre-wrap' }}>{brief}</div>}
      produce={
        <div style={{ display: 'grid', gap: 10 }}>
          <Lbl t={t}>Direction (optional)</Lbl>
          <LabInput t={t} value={dir} onChange={setDir} placeholder="e.g. darker, ceremonial, dwarven" />
          <Lbl t={t}>Brief draft</Lbl>
          <LabTextarea t={t} value={brief} onChange={setBrief} rows={8} />
          <LabButton t={t} onClick={() => setBrief(seedBrief(entity.name, dir))}>⚡ Generate with CLI</LabButton>
          <span className={t.fontMono} style={{ fontSize: 11, color: t.muted }}>Saved to DB · feeds the UE item description.</span>
        </div>
      }
    />
  );
}
