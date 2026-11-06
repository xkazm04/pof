'use client';

/**
 * A one-line player for a casting row: play/pause, a seekable progress bar, the time, and a "heard" tick once
 * played to `HEARD_FRACTION` (Cast stays locked until then). A hidden <audio> does the work, so the room's
 * exclusive-playback listener still pauses the other rows. On a load error it falls back once to `fallbackSrc`
 * (the provider original) and says so; a second failure is shown, never a silent dead button.
 */
import { useRef, useState } from 'react';
import { Check, Pause, Play } from 'lucide-react';
import type { LabTheme } from '@/components/layout-lab/theme';
import { HEARD_FRACTION } from './voiceAudio';

const clock = (s: number) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '–:––');

export function CastingPlayer({ t, src, fallbackSrc, label, heard, onHeard }: {
  t: LabTheme; src: string; fallbackSrc?: string; label: string; heard: boolean; onHeard: () => void;
}) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(Number.NaN);
  const [fellBack, setFellBack] = useState(false);
  const [failed, setFailed] = useState(false);
  const toggle = () => {
    const a = ref.current;
    if (!a) return;
    if (a.paused) void a.play().catch(() => setFailed(true)); else a.pause();
  };
  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = ref.current;
    if (!a || !Number.isFinite(a.duration)) return;
    const r = e.currentTarget.getBoundingClientRect();
    a.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * a.duration;
  };
  const pct = Number.isFinite(dur) && dur > 0 ? (pos / dur) * 100 : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      <audio ref={ref} preload="metadata" src={fellBack && fallbackSrc ? fallbackSrc : src} aria-label={label}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => { setPlaying(false); onHeard(); }}
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
        onTimeUpdate={(e) => { const a = e.currentTarget; setPos(a.currentTime); if (a.duration > 0 && a.currentTime / a.duration >= HEARD_FRACTION) onHeard(); }}
        onError={() => { if (fallbackSrc && !fellBack) setFellBack(true); else setFailed(true); }} />
      <button type="button" className="focus-ring" onClick={toggle} aria-label={`${playing ? 'Pause' : 'Play'} ${label}`} data-testid="casting-play"
        style={{ width: 30, height: 30, flex: 'none', display: 'grid', placeItems: 'center', borderRadius: '50%', cursor: 'pointer',
          border: `1px solid ${t.ink}`, background: playing ? t.ink : 'transparent', color: playing ? t.onAccent : t.ink }}>
        {playing ? <Pause size={14} /> : <Play size={14} style={{ marginLeft: 2 }} />}
      </button>
      <div role="slider" aria-label={`Seek ${label}`} aria-valuemin={0} aria-valuemax={Math.round(dur || 0)} aria-valuenow={Math.round(pos)} tabIndex={-1} onClick={seek}
        style={{ flex: 1, minWidth: 60, height: 6, borderRadius: 3, background: t.line, cursor: 'pointer', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: t.ink, borderRadius: 3 }} />
      </div>
      <span style={{ fontFamily: 'var(--lab-font-mono)', fontSize: 'var(--lab-fs-xs)', color: t.muted, flex: 'none', minWidth: 74, textAlign: 'right' }}>
        {clock(pos)} / {clock(dur)}
      </span>
      <span title={heard ? 'Heard through' : 'Not heard through yet'} aria-label={heard ? 'heard' : 'not heard yet'}
        style={{ flex: 'none', width: 16, display: 'grid', placeItems: 'center', color: heard ? t.ok : t.line }}>
        <Check size={14} />
      </span>
      {(failed || fellBack) && (
        <span role={failed ? 'alert' : 'status'} title={failed ? 'Audio did not load' : 'Playing the provider original (not at the game level)'}
          style={{ flex: 'none', fontSize: 'var(--lab-fs-xs)', color: failed ? t.bad : t.muted }}>{failed ? 'no audio' : 'orig.'}</span>
      )}
    </div>
  );
}
