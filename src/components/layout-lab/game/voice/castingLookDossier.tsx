'use client';

/**
 * Casting look B, "Dossier": a horizontal strip of portrait cards across the top (group dividers, status under
 * each name); below, a sticky dossier card (art, name, role, the bible as a definition list) beside the rounds,
 * whose voices sit in separate rounded rows.
 */
import { Fragment } from 'react';
import type { LabTheme } from '@/components/layout-lab/theme';
import { CASTING_GROUPS, type CastingCharacter } from '@/lib/voice/castingTypes';
import type { CastingView } from '@/lib/voice/castingView';
import { openCasting } from './voiceRoomParam';
import { parseBible, BibleItems } from './castingBibleText';
import { ArtViewer, Avatar, CastingRounds, statusWord } from './castingParts';

function PortraitStrip({ t, characters, current }: { t: LabTheme; characters: CastingCharacter[]; current: string | null }) {
  return (
    <nav aria-label="Characters to cast" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, alignItems: 'stretch' }}>
      {CASTING_GROUPS.map((g, gi) => {
        const list = characters.filter((c) => c.group === g);
        if (!list.length) return null;
        return (
          <Fragment key={g}>
            {gi > 0 && <span aria-hidden style={{ width: 1, background: t.line, margin: '6px 4px', flex: 'none' }} />}
            <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontFamily: 'var(--lab-font-mono)', fontSize: 'var(--lab-fs-xs)', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.muted, flex: 'none', textAlign: 'center' }}>{g}</span>
            {list.map((c) => {
              const on = c.id === current;
              const s = statusWord(c);
              return (
                <button key={c.id} type="button" className="focus-ring" data-testid="casting-pick" data-character={c.id} aria-current={on ? 'page' : undefined} onClick={() => openCasting(c.id)}
                  title={c.role} style={{ flex: 'none', width: 96, display: 'grid', justifyItems: 'center', gap: 4, padding: '8px 4px', borderRadius: 10, cursor: 'pointer',
                    border: `1px solid ${on ? t.ink : 'transparent'}`, background: on ? t.accentBg : 'transparent' }}>
                  <Avatar t={t} c={c} size={52} ring={on} />
                  <span style={{ fontSize: 'var(--lab-fs-xs)', fontWeight: on ? 700 : 500, color: t.inkDeep, width: '100%', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title.replace(/\s*\(.*\)/, '')}</span>
                  <span style={{ fontSize: 'var(--lab-fs-xs)', color: s.tone === 'muted' ? t.muted : t[s.tone], lineHeight: 1 }}>{s.word}</span>
                </button>
              );
            })}
          </Fragment>
        );
      })}
    </nav>
  );
}

function Dossier({ t, v }: { t: LabTheme; v: CastingView }) {
  const sections = parseBible(v.bibleExcerpt);
  return (
    <aside style={{ position: 'sticky', top: 0, display: 'grid', gap: 14, padding: 16, borderRadius: 12, border: `1px solid ${t.line}`, background: t.panel, maxHeight: '85vh', overflow: 'auto' }}>
      <ArtViewer t={t} v={v} height={200} />
      <div>
        <h3 style={{ margin: 0, fontSize: 'var(--lab-fs-xl)', fontFamily: 'var(--lab-font-mono)', color: t.inkDeep }}>{v.title}</h3>
        <p style={{ margin: '4px 0 0', fontSize: 'var(--lab-fs-xs)', lineHeight: 1.45, color: t.muted }}>{v.role}</p>
        {v.cast && <p style={{ margin: '6px 0 0', fontSize: 'var(--lab-fs-sm)', color: t.ok, fontWeight: 600 }}>✓ Cast: {v.cast.name}</p>}
      </div>
      <dl style={{ margin: 0, display: 'grid', gap: 12 }}>
        {sections.map((s) => (
          <div key={s.title} style={{ display: 'grid', gap: 4, borderTop: `1px solid ${t.line}`, paddingTop: 10 }}>
            <dt style={{ fontFamily: 'var(--lab-font-mono)', fontSize: 'var(--lab-fs-xs)', textTransform: 'uppercase', letterSpacing: '0.06em', color: t.ink }}>
              {s.title}{s.note && <span style={{ color: t.muted, textTransform: 'none', letterSpacing: 0 }}> · {s.note}</span>}
            </dt>
            <dd style={{ margin: 0 }}><BibleItems t={t} items={s.items} /></dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

export function CastingLookDossier({ t, v, characters, current, gate, onChanged }: {
  t: LabTheme; v: CastingView | null; characters: CastingCharacter[]; current: string | null; gate: string | null; onChanged: () => void;
}) {
  return (
    <div data-testid="casting-look-b" style={{ display: 'grid', gap: 20 }}>
      <PortraitStrip t={t} characters={characters} current={current} />
      {!v ? <p style={{ color: t.muted, fontSize: 'var(--lab-fs-sm)' }}>Pick a character above.</p> : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 300px', maxWidth: 400, minWidth: 0, position: 'sticky', top: 0 }}><Dossier t={t} v={v} /></div>
          <div style={{ flex: '3 1 560px', minWidth: 0 }}><CastingRounds t={t} v={v} look="b" gate={gate} onChanged={onChanged} /></div>
        </div>
      )}
    </div>
  );
}
