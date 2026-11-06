'use client';

/**
 * The Voice room's Casting page (`?room=voice&cast=<character>`): find a character's voice over rounds of up to 5
 * designed candidates. The character's art and bible sit beside the round, so a voice is judged against the
 * character it must fit; the current round is on top, earlier rounds below as history. Rounds are designed
 * headlessly (`voice.mjs round`, written by Claude from the owner's verdicts and comments); verdicts are clicks.
 */
import { useState } from 'react';
import { MicroLabel } from '@/components/ui/MicroLabel';
import { StatusTag } from '@/components/ui/StatusTag';
import { LoadingRow } from '@/components/ui/LoadingRow';
import { InlineErrorRetry } from '@/components/modules/shared/InlineErrorRetry';
import type { LabTheme } from '@/components/layout-lab/theme';
import type { CastingCharacter, CastingView } from '@/lib/voice/castingView';
import { castingArtUrl, useCasting } from './voiceRoomData';
import { openCasting } from './voiceRoomParam';
import { VoiceCastingRound } from './voiceCastingRound';
import { NO_CLONE_NOTE } from './voiceGateClient';

function CharacterPicker({ t, characters, current }: { t: LabTheme; characters: CastingCharacter[]; current: string | null }) {
  return (
    <nav aria-label="Characters to cast" style={{ display: 'flex', gap: 'var(--lab-s1)', flexWrap: 'wrap' }}>
      {characters.map((c) => (
        <button key={c.id} type="button" className="focus-ring" data-testid="casting-pick" data-character={c.id} aria-current={c.id === current ? 'page' : undefined}
          onClick={() => openCasting(c.id)}
          style={{ fontSize: 'var(--lab-fs-xs)', padding: '4px 10px', borderRadius: 4, cursor: 'pointer', background: c.id === current ? t.accentBg : 'transparent',
            color: c.id === current ? t.inkDeep : t.text, border: `1px solid ${c.id === current ? t.ink : t.line}`, fontWeight: c.id === current ? 700 : 400 }}>
          {c.title}{c.cast ? ' ✓' : ''}{c.hasArt ? '' : ' (no art)'}
        </button>
      ))}
    </nav>
  );
}

function CharacterCard({ t, v }: { t: LabTheme; v: CastingView }) {
  const [big, setBig] = useState(0);
  return (
    <section data-testid="casting-character" style={{ display: 'flex', gap: 'var(--lab-s4)', flexWrap: 'wrap', alignItems: 'start' }}>
      <div style={{ flex: '2 1 360px', minWidth: 0, display: 'grid', gap: 'var(--lab-s2)' }}>
        {v.art.length > 0 ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- a served local file, not an optimisable remote */}
            <img src={castingArtUrl(v.characterId, big)} alt={v.art[big]?.label ?? v.title} data-testid="casting-art"
              style={{ width: '100%', maxHeight: 420, objectFit: 'contain', borderRadius: 6, border: `1px solid ${t.line}`, background: t.panel }} />
            <MicroLabel mono tone="muted">{v.art[big]?.label}</MicroLabel>
            {v.art.length > 1 && (
              <div style={{ display: 'flex', gap: 'var(--lab-s1)', flexWrap: 'wrap' }}>
                {v.art.map((a) => (
                  <button key={a.n} type="button" className="focus-ring" onClick={() => setBig(a.n)} aria-label={`Show ${a.label}`} aria-pressed={a.n === big}
                    style={{ padding: 0, border: `${a.n === big ? 2 : 1}px solid ${a.n === big ? t.ink : t.line}`, borderRadius: 4, background: 'none', cursor: 'pointer' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- thumbnail of a served local file */}
                    <img src={castingArtUrl(v.characterId, a.n)} alt="" style={{ width: 96, height: 54, objectFit: 'cover', display: 'block' }} />
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 'var(--lab-fs-sm)', color: t.muted, padding: 'var(--lab-s3)', border: `1px dashed ${t.line}`, borderRadius: 6 }}>
            No art for {v.title} yet: add it to <code>games/gtai/voice/casting/art.json</code>.
          </p>
        )}
      </div>
      <div style={{ flex: '1 1 300px', minWidth: 0, display: 'grid', gap: 'var(--lab-s2)', alignContent: 'start' }}>
        <div style={{ display: 'flex', gap: 'var(--lab-s2)', alignItems: 'center', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontFamily: 'var(--lab-font-mono)', fontSize: 'var(--lab-fs-lg)', color: t.inkDeep }}>{v.title}</h3>
          <StatusTag level={v.cast ? 'ok' : 'warn'} word={v.cast ? `cast: ${v.cast.name}` : 'not cast yet'} />
        </div>
        {v.bibleExcerpt
          ? <pre data-testid="casting-bible" style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 'var(--lab-fs-xs)', lineHeight: 1.5, color: t.text, fontFamily: 'inherit', maxHeight: 420, overflow: 'auto' }}>{v.bibleExcerpt}</pre>
          : <span style={{ fontSize: 'var(--lab-fs-xs)', color: t.muted }}>No voice bible yet (games/gtai/voices/{v.characterId}.md).</span>}
      </div>
    </section>
  );
}

const isView = (d: CastingView | { characters: CastingCharacter[] }): d is CastingView => 'rounds' in d;

export function VoiceCasting({ t, character, gate }: { t: LabTheme; character: string | null; gate: string | null }) {
  const { read, reload } = useCasting<CastingView | { characters: CastingCharacter[] }>(character || null);
  const data = read.kind === 'ready' ? read.data : null;
  const view = data && isView(data) ? data : null;
  const characters = data?.characters ?? [];
  const names = new Map(view?.rounds.flatMap((r) => r.candidates.map((c) => [c.voice.id, `R${r.round.roundNo} #${r.candidates.indexOf(c) + 1} ${c.candidate.label}`] as const)) ?? []);
  const rounds = view ? [...view.rounds].reverse() : [];
  return (
    <div data-testid="voice-casting" style={{ display: 'grid', gap: 'var(--lab-s4)', alignContent: 'start' }}>
      <p role="note" style={{ margin: 0, fontSize: 'var(--lab-fs-sm)', color: t.text, padding: 'var(--lab-s2)', borderLeft: `3px solid ${t.warn}` }}>
        Give every voice a verdict: <strong>Cast</strong> (this is the voice), <strong>Iterate</strong> (close: keep its identity, refine it) or <strong>Decline</strong>, with a note. Close the round with a comment, and the next round is designed from it. {NO_CLONE_NOTE}
      </p>
      {characters.length > 0 && <CharacterPicker t={t} characters={characters} current={character || null} />}
      {read.kind === 'loading' && <LoadingRow variant="inline" label="Reading the casting rounds…" />}
      {read.kind === 'error' && <InlineErrorRetry message={`casting unavailable (${read.reason})`} onRetry={reload} />}
      {!character && data && <span style={{ fontSize: 'var(--lab-fs-sm)', color: t.muted }}>Pick a character to cast.</span>}
      {view && <CharacterCard t={t} v={view} />}
      {view && rounds.length === 0 && (
        <p data-testid="casting-empty" style={{ margin: 0, fontSize: 'var(--lab-fs-sm)', color: t.muted }}>
          No rounds yet. Round 1 is designed headlessly: <code>node games/gtai/voice/voice.mjs round --character {view.characterId} --file round.json</code>. It appears here on its own.
        </p>
      )}
      {view && view.rounds.length > 0 && !view.rounds.some((r) => r.round.status === 'open') && !view.cast && (
        <p data-testid="casting-waiting" role="status" style={{ margin: 0, fontSize: 'var(--lab-fs-sm)', color: t.text }}>
          Round {view.rounds[view.rounds.length - 1].round.roundNo} is closed. The next round is being designed from your verdicts and comment; it appears here on its own.
        </p>
      )}
      {rounds.map((r) => <VoiceCastingRound key={r.round.id} t={t} r={r} gate={gate} onChanged={reload} lineageName={(id) => names.get(id) ?? null} />)}
    </div>
  );
}
