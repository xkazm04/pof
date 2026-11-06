'use client';

/**
 * Casting look C, "Spotlight": the character's art as a wide hero banner with the name and role set over it;
 * a compact grouped select switches characters (with the avatar of the current one); the bible reads as tabs,
 * one section at a time; the rounds follow as a dense console list.
 */
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { LabTheme } from '@/components/layout-lab/theme';
import { CASTING_GROUPS, type CastingCharacter } from '@/lib/voice/castingTypes';
import type { CastingView } from '@/lib/voice/castingView';
import { openCasting } from './voiceRoomParam';
import { parseBible, BibleItems } from './castingBibleText';
import { Avatar, CastingRounds, statusWord } from './castingParts';
import { castingArtUrl } from './voiceRoomData';

function Selector({ t, characters, current }: { t: LabTheme; characters: CastingCharacter[]; current: string | null }) {
  const cur = characters.find((c) => c.id === current);
  return (
    <label style={{ justifySelf: 'start', maxWidth: '100%', boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center', gap: 10, padding: '6px 10px', borderRadius: 999, border: `1px solid ${t.line}`, background: t.panel, position: 'relative' }}>
      {cur && <Avatar t={t} c={cur} size={26} />}
      <span style={{ fontFamily: 'var(--lab-font-mono)', fontSize: 'var(--lab-fs-xs)', color: t.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Cast</span>
      <select aria-label="Character to cast" data-testid="casting-select" value={current ?? ''} onChange={(e) => openCasting(e.target.value)} className="focus-ring"
        style={{ minWidth: 0, maxWidth: 'min(280px, 48vw)', textOverflow: 'ellipsis', appearance: 'none', border: 'none', background: 'transparent', color: t.inkDeep, fontWeight: 700, fontSize: 'var(--lab-fs-sm)', paddingRight: 22, cursor: 'pointer' }}>
        {!current && <option value="">Pick a character…</option>}
        {CASTING_GROUPS.map((g) => (
          <optgroup key={g} label={g}>
            {characters.filter((c) => c.group === g).map((c) => <option key={c.id} value={c.id}>{c.title} · {statusWord(c).word}</option>)}
          </optgroup>
        ))}
      </select>
      <ChevronDown size={14} color={t.muted} style={{ position: 'absolute', right: 12, pointerEvents: 'none' }} />
    </label>
  );
}

function Hero({ t, v }: { t: LabTheme; v: CastingView }) {
  const [n, setN] = useState(0);
  const status = v.cast ? `Cast · ${v.cast.name}` : v.rounds.some((r) => r.round.status === 'open') ? 'A round waits for your verdicts' : `${v.rounds.length} rounds`;
  return (
    <header style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', border: `1px solid ${t.line}`, minHeight: 240, background: t.panel }}>
      {v.art.length > 0 && (
        // eslint-disable-next-line @next/next/no-img-element -- a served local file
        <img src={castingArtUrl(v.characterId, n)} alt={v.art[n]?.label ?? v.title} data-testid="casting-art"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 35%' }} />
      )}
      <div aria-hidden style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg, color-mix(in srgb, ${t.bg} 94%, transparent) 0%, color-mix(in srgb, ${t.bg} 70%, transparent) 45%, transparent 75%)` }} />
      <div style={{ position: 'relative', padding: '28px 28px 20px', display: 'grid', gap: 8, maxWidth: 560, minHeight: 240, alignContent: 'end' }}>
        <span style={{ fontFamily: 'var(--lab-font-mono)', fontSize: 'var(--lab-fs-xs)', letterSpacing: '0.12em', textTransform: 'uppercase', color: t.ink }}>{status}</span>
        <h3 style={{ margin: 0, fontFamily: 'var(--lab-font-mono)', fontSize: 40, lineHeight: 1, color: t.inkDeep }}>{v.title}</h3>
        <p style={{ margin: 0, fontSize: 'var(--lab-fs-sm)', lineHeight: 1.5, color: t.text }}>{v.role}</p>
        {v.art.length > 1 && (
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            {v.art.map((a) => (
              <button key={a.n} type="button" className="focus-ring" aria-label={`Show ${a.label}`} aria-pressed={a.n === n} onClick={() => setN(a.n)} title={a.label}
                style={{ width: a.n === n ? 26 : 10, height: 10, borderRadius: 5, border: `1px solid ${t.ink}`, background: a.n === n ? t.ink : 'transparent', cursor: 'pointer', padding: 0 }} />
            ))}
          </div>
        )}
      </div>
    </header>
  );
}

function BibleTabs({ t, v }: { t: LabTheme; v: CastingView }) {
  const sections = parseBible(v.bibleExcerpt);
  const [i, setI] = useState(0);
  if (!sections.length) return <p style={{ margin: 0, fontSize: 'var(--lab-fs-sm)', color: t.muted }}>No voice bible yet.</p>;
  const s = sections[Math.min(i, sections.length - 1)];
  return (
    <section aria-label="Voice bible" style={{ display: 'grid', gap: 10 }}>
      <div role="tablist" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {sections.map((x, k) => (
          <button key={x.title} type="button" role="tab" aria-selected={k === i} className="focus-ring" onClick={() => setI(k)}
            style={{ padding: '4px 12px', borderRadius: 999, cursor: 'pointer', fontSize: 'var(--lab-fs-xs)', fontWeight: k === i ? 700 : 500,
              border: `1px solid ${k === i ? t.ink : t.line}`, background: k === i ? t.ink : 'transparent', color: k === i ? t.onAccent : t.text }}>{x.title}</button>
        ))}
      </div>
      <div role="tabpanel" style={{ maxWidth: '90ch' }}><BibleItems t={t} items={s.items} /></div>
    </section>
  );
}

export function CastingLookSpotlight({ t, v, characters, current, gate, onChanged }: {
  t: LabTheme; v: CastingView | null; characters: CastingCharacter[]; current: string | null; gate: string | null; onChanged: () => void;
}) {
  return (
    <div data-testid="casting-look-c" style={{ display: 'grid', gap: 18 }}>
      <Selector t={t} characters={characters} current={current} />
      {v && <Hero t={t} v={v} />}
      {v && <BibleTabs t={t} v={v} />}
      {v && <CastingRounds t={t} v={v} look="c" gate={gate} onChanged={onChanged} />}
    </div>
  );
}
