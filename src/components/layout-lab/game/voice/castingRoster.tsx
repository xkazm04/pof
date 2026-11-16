'use client';

/**
 * The Casting page layout ("Roster", the owner's pick 2026-11-06 over Dossier and Spotlight): a sticky sidebar lists the cast grouped by role (Lead, Souls, Bosses, Cast) with
 * avatars and status; the main column opens with a compact header (art left, name + role + bible sections as
 * small cards right) and then the rounds as a striped list.
 */
import type { LabTheme } from '@/components/layout-lab/theme';
import { CASTING_GROUPS, type CastingCharacter } from '@/lib/voice/castingTypes';
import type { CastingView } from '@/lib/voice/castingView';
import { openCasting } from './voiceRoomParam';
import { useCastingDemand } from './voiceRoomData';
import { CastingDemandPanel } from './castingDemandPanel';
import { parseBible, BibleItems } from './castingBibleText';
import { ArtViewer, Avatar, CastingRounds, statusWord } from './castingParts';

function Roster({ t, characters, current, noLines }: { t: LabTheme; characters: CastingCharacter[]; current: string | null; noLines: ReadonlySet<string> }) {
  return (
    <nav aria-label="Characters to cast" style={{ position: 'sticky', top: 0, alignSelf: 'start', display: 'grid', gap: 14, maxHeight: '80vh', overflow: 'auto', paddingRight: 4 }}>
      {CASTING_GROUPS.map((g) => {
        const list = characters.filter((c) => c.group === g);
        if (!list.length) return null;
        return (
          <div key={g} style={{ display: 'grid', gap: 2 }}>
            <span style={{ fontFamily: 'var(--lab-font-mono)', fontSize: 'var(--lab-fs-xs)', letterSpacing: '0.08em', textTransform: 'uppercase', color: t.muted, padding: '0 8px 4px' }}>{g}</span>
            {list.map((c) => {
              const on = c.id === current;
              const s = statusWord(c);
              return (
                <button key={c.id} type="button" className="focus-ring" data-testid="casting-pick" data-character={c.id} aria-current={on ? 'page' : undefined} onClick={() => openCasting(c.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', textAlign: 'left',
                    background: on ? t.accentBg : 'transparent', boxShadow: on ? `inset 3px 0 0 ${t.ink}` : 'none' }}>
                  <Avatar t={t} c={c} size={30} ring={on} />
                  <span style={{ minWidth: 0, display: 'grid' }}>
                    <span style={{ fontSize: 'var(--lab-fs-sm)', fontWeight: on ? 700 : 500, color: t.inkDeep, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title.replace(/\s*\(.*\)/, '')}</span>
                    <span style={{ fontSize: 'var(--lab-fs-xs)', color: s.tone === 'muted' ? t.muted : t[s.tone] }}>{s.word}{noLines.has(c.id) && <span data-testid="casting-zero-lines" title="Cast, but speaks no present quest line"> · 0 lines</span>}</span>
                  </span>
                </button>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

export function CastingRoster({ t, v, characters, current, gate, onChanged }: {
  t: LabTheme; v: CastingView | null; characters: CastingCharacter[]; current: string | null; gate: string | null; onChanged: () => void;
}) {
  const sections = parseBible(v?.bibleExcerpt ?? null);
  const { read } = useCastingDemand();
  const demand = read.kind === 'ready' ? read.data.demand : null;
  const noLines = new Set((demand?.castWithoutLines ?? []).map((c) => c.characterId));
  return (
    <div style={{ display: 'grid', gap: 18 }}>
    <CastingDemandPanel t={t} demand={demand} castable={new Set(characters.map((c) => c.id))} />
    <div data-testid="casting-roster" style={{ display: 'flex', flexWrap: 'wrap', gap: 28, alignItems: 'flex-start' }}>
      <div style={{ flex: '1 1 200px', maxWidth: 240, minWidth: 0, position: 'sticky', top: 0 }}><Roster t={t} characters={characters} current={current} noLines={noLines} /></div>
      {!v ? <p style={{ color: t.muted, fontSize: 'var(--lab-fs-sm)' }}>Pick a character from the roster.</p> : (
        <div style={{ flex: '999 1 520px', display: 'grid', gap: 24, minWidth: 0 }}>
          <header style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 20, alignItems: 'start' }}>
            <ArtViewer t={t} v={v} height={260} />
            <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
              <div>
                <h3 style={{ margin: 0, fontFamily: 'var(--lab-font-mono)', fontSize: 'var(--lab-fs-xl)', color: t.inkDeep }}>{v.title}</h3>
                <p style={{ margin: '2px 0 0', fontSize: 'var(--lab-fs-sm)', color: t.muted }}>{v.role || 'no role recorded'}{v.cast ? ` · cast: ${v.cast.name}` : ''}</p>
              </div>
              <div style={{ display: 'grid', gap: 10, maxHeight: 300, overflow: 'auto' }}>
                {sections.map((s) => (
                  <section key={s.title} style={{ padding: '8px 12px', borderRadius: 6, border: `1px solid ${t.line}` }}>
                    <h4 style={{ margin: '0 0 6px', fontFamily: 'var(--lab-font-mono)', fontSize: 'var(--lab-fs-xs)', letterSpacing: '0.06em', textTransform: 'uppercase', color: t.ink }}>{s.title}</h4>
                    <BibleItems t={t} items={s.items} />
                  </section>
                ))}
              </div>
            </div>
          </header>
          <CastingRounds t={t} v={v} gate={gate} onChanged={onChanged} />
        </div>
      )}
    </div>
    </div>
  );
}
