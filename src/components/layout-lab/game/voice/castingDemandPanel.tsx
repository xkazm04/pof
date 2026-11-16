'use client';

/**
 * "Needs a voice": the speakers who have present quest lines and no cast voice, in order of first appearance
 * (speaker, lines, first quest). Casting used to be blind to the line queue; this is its demand. A speaker that
 * is in the casting roster opens its casting page; the quest packages name speakers (a dock guard, a nurse)
 * the roster has no bible for, which stay plain text.
 */
import { MicroLabel } from '@/components/ui/MicroLabel';
import type { LabTheme } from '@/components/layout-lab/theme';
import type { CastingDemand } from '@/lib/voice/types';
import { openCasting } from './voiceRoomParam';

export function CastingDemandPanel({ t, demand, castable }: { t: LabTheme; demand: CastingDemand | null; castable: ReadonlySet<string> }) {
  if (!demand || demand.needsVoice.length === 0) return null;
  return (
    <section data-testid="casting-needs-voice" aria-label="Speakers that need a voice" style={{ display: 'grid', gap: 6, padding: '8px 12px', borderRadius: 6, border: `1px solid ${t.line}`, borderLeft: `3px solid ${t.warn}` }}>
      <MicroLabel mono uppercase tone="muted">Needs a voice ({demand.needsVoice.length} speakers, {demand.needsVoice.reduce((n, s) => n + s.lines, 0)} lines)</MicroLabel>
      <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
        {demand.needsVoice.map((s) => (
          <li key={s.speaker} data-testid="casting-needs-voice-row" data-speaker={s.speaker} style={{ fontSize: 'var(--lab-fs-xs)', color: t.text, display: 'flex', gap: 6, alignItems: 'baseline' }}>
            {castable.has(s.speaker)
              ? <button type="button" className="focus-ring" onClick={() => openCasting(s.speaker)} style={{ all: 'unset', cursor: 'pointer', fontFamily: 'var(--lab-font-mono)', color: t.inkDeep, textDecoration: 'underline' }}>{s.speaker}</button>
              : <span style={{ fontFamily: 'var(--lab-font-mono)', color: t.inkDeep }}>{s.speaker}</span>}
            <span style={{ color: t.muted }}>{s.lines} {s.lines === 1 ? 'line' : 'lines'} · first in {s.firstQuestId}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
