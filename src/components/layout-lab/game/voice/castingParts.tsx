'use client';

/**
 * Pieces every Casting look shares: the character avatar (its first art image, else initials), the art viewer
 * (a large image + thumbnails), the status words, and the rounds section (open round, waiting state, history).
 */
import { useState } from 'react';
import type { LabTheme } from '@/components/layout-lab/theme';
import type { CastingCharacter, CastingView } from '@/lib/voice/castingView';
import { castingArtUrl } from './voiceRoomData';
import { OpenRound, PastRound } from './castingRoundPanel';
import type { CastingLook } from './castingRow';

export const initials = (title: string) => title.replace(/\(.*\)/, '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');

/** The word under a character in a selector: cast, a round waiting, rounds so far, or nothing yet. */
export function statusWord(c: Pick<CastingCharacter, 'cast' | 'open' | 'rounds'>): { word: string; tone: 'ok' | 'warn' | 'muted' } {
  if (c.cast) return { word: 'cast', tone: 'ok' };
  if (c.open) return { word: 'your verdicts', tone: 'warn' };
  if (c.rounds) return { word: `${c.rounds} round${c.rounds === 1 ? '' : 's'}`, tone: 'muted' };
  return { word: 'not started', tone: 'muted' };
}

export function Avatar({ t, c, size, ring }: { t: LabTheme; c: Pick<CastingCharacter, 'id' | 'title' | 'hasArt'>; size: number; ring?: boolean }) {
  const box = { width: size, height: size, borderRadius: '50%', flex: 'none' as const, border: `${ring ? 2 : 1}px solid ${ring ? t.ink : t.line}`, overflow: 'hidden' as const };
  return c.hasArt
    // eslint-disable-next-line @next/next/no-img-element -- a served local file
    ? <img src={castingArtUrl(c.id, 0)} alt="" style={{ ...box, objectFit: 'cover', background: t.panel }} />
    : <span aria-hidden style={{ ...box, display: 'grid', placeItems: 'center', background: t.accentBg, color: t.inkDeep, fontFamily: 'var(--lab-font-mono)', fontSize: size * 0.36, fontWeight: 700 }}>{initials(c.title)}</span>;
}

export function ArtViewer({ t, v, height }: { t: LabTheme; v: CastingView; height: number }) {
  const [n, setN] = useState(0);
  if (v.art.length === 0) {
    return <div style={{ height: 90, display: 'grid', placeItems: 'center', border: `1px dashed ${t.line}`, borderRadius: 8, fontSize: 'var(--lab-fs-xs)', color: t.muted, padding: 12, textAlign: 'center' }}>No art yet: add it to games/gtai/voice/casting/art.json</div>;
  }
  return (
    <figure style={{ margin: 0, display: 'grid', gap: 6 }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a served local file */}
      <img src={castingArtUrl(v.characterId, n)} alt={v.art[n]?.label ?? v.title} data-testid="casting-art"
        style={{ width: '100%', height, objectFit: 'contain', borderRadius: 8, background: t.panel, border: `1px solid ${t.line}` }} />
      <figcaption style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        {v.art.length > 1 && v.art.map((a) => (
          <button key={a.n} type="button" className="focus-ring" onClick={() => setN(a.n)} aria-label={`Show ${a.label}`} aria-pressed={a.n === n}
            style={{ padding: 0, border: `${a.n === n ? 2 : 1}px solid ${a.n === n ? t.ink : t.line}`, borderRadius: 4, background: 'none', cursor: 'pointer', lineHeight: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- thumbnail of a served local file */}
            <img src={castingArtUrl(v.characterId, a.n)} alt="" style={{ width: 56, height: 36, objectFit: 'cover', borderRadius: 3 }} />
          </button>
        ))}
        <span style={{ fontSize: 'var(--lab-fs-xs)', color: t.muted, flex: '1 1 160px' }}>{v.art[n]?.label}</span>
      </figcaption>
    </figure>
  );
}

export function CastingRounds({ t, v, look, gate, onChanged }: { t: LabTheme; v: CastingView; look: CastingLook; gate: string | null; onChanged: () => void }) {
  const names = new Map(v.rounds.flatMap((r) => r.candidates.map((c, i) => [c.voice.id, `R${r.round.roundNo} #${i + 1} ${c.candidate.label}`] as const)));
  const lineageName = (id: string) => names.get(id) ?? null;
  const open = v.rounds.find((r) => r.round.status === 'open');
  const past = v.rounds.filter((r) => r.round.status !== 'open').reverse();
  const note = { margin: 0, fontSize: 'var(--lab-fs-sm)', color: t.muted, padding: 12, border: `1px dashed ${t.line}`, borderRadius: 8 };
  return (
    <div style={{ display: 'grid', gap: 16, alignContent: 'start', minWidth: 0 }}>
      {v.rounds.length === 0 && <p data-testid="casting-empty" style={note}>No rounds yet. Claude designs round 1 (<code>voice.mjs round --character {v.characterId}</code>); it appears here on its own.</p>}
      {!open && past.length > 0 && !v.cast && <p data-testid="casting-waiting" role="status" style={note}>Round {past[0].round.roundNo} is submitted. The next round is being designed from your verdicts and comment; it appears here on its own.</p>}
      {open && <OpenRound key={open.round.id} t={t} r={open} look={look} gate={gate} onChanged={onChanged} lineageName={lineageName} />}
      {past.map((r) => <PastRound key={r.round.id} t={t} r={r} look={look} lineageName={lineageName} />)}
    </div>
  );
}
