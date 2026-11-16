'use client';

/**
 * The GTAI Combat lab: where the owner judges combat design. The weapons / enemy / power tables the combat lanes
 * write, a measured time-to-kill-by-range chart and the latest arena telemetry sessions, read through the game root
 * and the lane worktrees. A source picker (auto, the game root, or one lane) says where everything on the page
 * comes from; nothing absent is drawn as zero.
 */
import { useState } from 'react';
import { MicroLabel } from '@/components/ui/MicroLabel';
import { LoadingRow } from '@/components/ui/LoadingRow';
import { InlineErrorRetry } from '@/components/modules/shared/InlineErrorRetry';
import type { LabTheme } from '@/components/layout-lab/theme';
import { openRoom } from '../voice/voiceRoomParam';
import { useCombatLab } from './combatLabData';
import { CombatTtkChart } from './combatTtkChart';
import { CombatDesignTtk } from './combatDesignTtk';
import { CombatTableBlock } from './combatTables';
import { CombatSessions } from './combatSessions';
import { CombatStations } from './combatStations';

const H = { margin: 0, fontSize: 'var(--lab-fs-sm)' } as const;

export function CombatLabRoom({ t, gameId }: { t: LabTheme; gameId: string }) {
  const [source, setSource] = useState('auto');
  const { read, reread, sources } = useCombatLab(gameId, source);
  const d = read.kind === 'ok' ? read.data : null;
  return (
    <section data-testid="combat-lab" aria-labelledby="combat-lab-title"
      style={{ flex: 1, minHeight: 0, maxWidth: '100vw', boxSizing: 'border-box', overflow: 'auto', color: t.text, padding: 'var(--lab-s4) var(--lab-s6)', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', alignContent: 'start', gap: 'var(--lab-s4)' }}>
      <header style={{ display: 'grid', gap: 'var(--lab-s1)' }}>
        <button type="button" className="focus-ring" onClick={() => openRoom(null)}
          style={{ justifySelf: 'start', background: 'transparent', border: 'none', padding: 0, color: t.muted, cursor: 'pointer', fontSize: 'var(--lab-fs-xs)' }}>← Game home</button>
        <MicroLabel mono uppercase tone="muted">GTAI · Combat lab</MicroLabel>
        <h2 id="combat-lab-title" style={{ fontFamily: 'var(--lab-font-mono)', fontSize: 'var(--lab-fs-xl)', color: t.inkDeep, margin: 0 }}>Combat lab</h2>
        {(d ? d.configured : sources !== null) && (
          <label style={{ display: 'flex', gap: 'var(--lab-s2)', alignItems: 'center', flexWrap: 'wrap', fontSize: 'var(--lab-fs-xs)', color: t.muted }}>
            Read from
            <select data-testid="combat-source" value={source} onChange={(e) => setSource(e.target.value)} className="focus-ring"
              style={{ fontSize: 'var(--lab-fs-xs)', color: t.text, background: t.panel, border: `1px solid ${t.line}`, padding: '2px 6px', maxWidth: '100%' }}>
              {(d?.sources ?? sources ?? []).map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
        )}
        {d && !d.configured && <span data-testid="combat-unconfigured" style={{ fontSize: 'var(--lab-fs-xs)', color: t.muted }}>{d.reason}</span>}
        {read.kind === 'ok' && read.staleError && <span role="status" style={{ fontSize: 'var(--lab-fs-xs)', color: t.warn }}>Showing the last read; the latest poll failed ({read.staleError}).</span>}
      </header>
      {read.kind === 'loading' && <LoadingRow variant="inline" label="Reading the combat tables…" />}
      {read.kind === 'error' && <InlineErrorRetry message={`combat lab unavailable (${read.message})`} onRetry={reread} />}
      {d?.configured && (
        <>
          <h3 style={{ ...H, color: t.inkDeep }}>Time to kill by range, measured</h3>
          <CombatTtkChart t={t} sessions={d.telemetry.sessions} expected={d.telemetry.expected} />
          <h3 style={{ ...H, color: t.inkDeep }}>Time to kill by weapon, from the table</h3>
          <CombatDesignTtk t={t} weapons={d.tables.find((x) => x.key === 'weapons')} />
          {d.tables.map((tb) => <CombatTableBlock key={tb.key} t={t} table={tb} />)}
          {d.stations && <CombatStations t={t} stations={d.stations} />}
          <h3 style={{ ...H, color: t.inkDeep }}>Arena telemetry</h3>
          <CombatSessions t={t} sessions={d.telemetry.sessions} expected={d.telemetry.expected} />
        </>
      )}
    </section>
  );
}
