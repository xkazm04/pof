'use client';

import { useMemo, type ReactNode } from 'react';
import { GitCompareArrows, Pin, PinOff, Undo2 } from 'lucide-react';
import { STATUS_SUCCESS, STATUS_ERROR, ACCENT_CYAN, withOpacity, OPACITY_8 } from '@/lib/chart-colors';
import { simulateEncounter, type ChoreographySimResult, type EncounterOutcome } from '@/lib/combat/choreography-sim';
import { diffEncounterRuns, type EncounterRunDiff } from '@/lib/combat/encounter-compare';
import type { EncounterFindingKind } from '@/lib/combat/encounter-findings';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import { BEAT_STYLES, FEEDBACK_CHANNEL_COLORS, severityColor, type BalanceAlert } from './types';
import type { EncounterDraft } from './encounterDraftStore';

/** Designer-facing name per finding kind (compile-checked against the kind union). */
const FINDING_LABELS: Record<EncounterFindingKind, string> = {
  'unknown-archetype': 'Unknown archetype',
  'player-death': 'Player death',
  spongy: 'Spongy fight',
  trivial: 'Trivial fight',
  'tedious-hp': 'Tedious enemy HP',
  'burst-spike': 'Burst spike',
  'dead-zone': 'Dead zone',
  anticlimax: 'Anticlimax',
  'flat-pacing': 'Flat pacing',
};

const BTN = 'flex items-center gap-1 px-2 py-0.5 text-xs font-mono uppercase tracking-[0.15em] font-bold rounded-md bg-surface-deep border border-border hover:border-border-bright transition-colors text-text-muted';
const signed = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}s`;
const s1 = (v: number) => Number(v.toFixed(1));
/** "8s" / "12.5–17s" at 0.1s (a death time is the raw sim float). */
const at = (a: BalanceAlert) => (a.endTimeSec !== undefined ? `${s1(a.timeSec)}–${s1(a.endTimeSec)}s` : `${s1(a.timeSec)}s`);

function outcomeText(o: EncounterOutcome): string {
  return o.playerDied ? `Dies at ${(o.diedAtSec ?? 0).toFixed(1)}s` : `Survives (${Math.round(o.playerHpEnd * 100)}% HP)`;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-xs font-mono">
      <span className="w-20 shrink-0 uppercase tracking-[0.15em] text-text-muted">{label}</span>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-text">{children}</div>
    </div>
  );
}

function DiffRows({ d, current }: { d: EncounterRunDiff; current: ChoreographySimResult }) {
  const { base, next } = d.outcome;
  const outcomeColor = base.playerDied === next.playerDied ? 'var(--text)' : next.playerDied ? STATUS_ERROR : STATUS_SUCCESS;
  const beatChanges = d.beatsAdded.length + d.beatsRemoved.length + d.beatsMoved.length;
  const findingChanges = d.alertsResolved.length + d.alertsNew.length;
  return (
    <div className="space-y-1.5">
      <Row label="Outcome">
        <span style={{ color: outcomeColor }}>{outcomeText(base)} &rarr; {outcomeText(next)}</span>
      </Row>
      <Row label="Duration">
        <span>{(current.totalDurationSec - d.durationDeltaSec).toFixed(1)}s &rarr; {current.totalDurationSec.toFixed(1)}s ({signed(d.durationDeltaSec)})</span>
      </Row>
      <Row label="Beats">
        {beatChanges === 0 && <span className="text-text-muted">unchanged</span>}
        {d.beatsRemoved.map((b, i) => (
          <span key={`r${i}`} style={{ color: BEAT_STYLES[b.type].color }}>&minus;{BEAT_STYLES[b.type].label} @{b.timeSec}s</span>
        ))}
        {d.beatsAdded.map((b, i) => (
          <span key={`a${i}`} style={{ color: BEAT_STYLES[b.type].color }}>+{BEAT_STYLES[b.type].label} @{b.timeSec}s</span>
        ))}
        {d.beatsMoved.map((m, i) => (
          <span key={`m${i}`} style={{ color: BEAT_STYLES[m.type].color }}>{BEAT_STYLES[m.type].label} {m.fromSec}s &rarr; {m.toSec}s</span>
        ))}
      </Row>
      <Row label="Findings">
        {findingChanges === 0 && <span className="text-text-muted">unchanged</span>}
        {d.alertsResolved.map((a, i) => (
          <span key={`r${i}`} style={{ color: STATUS_SUCCESS }}>resolved: {FINDING_LABELS[a.kind]} @{at(a)}</span>
        ))}
        {d.alertsNew.map((a, i) => (
          <span key={`n${i}`} style={{ color: severityColor(a.severity) }}>new: {FINDING_LABELS[a.kind]} @{at(a)}</span>
        ))}
        {d.alertsPersisting.length > 0 && <span className="text-text-muted">{d.alertsPersisting.length} persisting</span>}
      </Row>
    </div>
  );
}

/**
 * Pin the current encounter as a baseline, keep tuning, and read what the pass
 * changed (outcome, duration, beats, findings) — with a one-click revert.
 */
export function CompareStrip({ baseline, current, onPin, onRevert, onClear }: {
  baseline: EncounterDraft | null;
  current: ChoreographySimResult;
  onPin: () => void; onRevert: () => void; onClear: () => void;
}) {
  const diff = useMemo(() => {
    if (!baseline) return null;
    const base = simulateEncounter(baseline.enemies, baseline.waves, baseline.tuning, baseline.playerLevel, FEEDBACK_CHANNEL_COLORS);
    return diffEncounterRuns(base, current);
  }, [baseline, current]);

  return (
    <BlueprintPanel className="p-3 space-y-2" color={ACCENT_CYAN}>
      <div data-testid="encounter-compare-strip" className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <SectionHeader label={baseline ? 'This pass vs baseline' : 'Tuning pass compare'} icon={GitCompareArrows} color={ACCENT_CYAN} />
          <div className="flex items-center gap-1 -mt-3">
            <button type="button" onClick={onPin} className={BTN}>
              <Pin className="w-2.5 h-2.5" aria-hidden />{baseline ? 'Re-pin' : 'Pin as baseline'}
            </button>
            {baseline && (
              <>
                <button type="button" onClick={onRevert} className={BTN}>
                  <Undo2 className="w-2.5 h-2.5" aria-hidden />Revert to baseline
                </button>
                <button type="button" onClick={onClear} className={BTN} aria-label="Unpin baseline">
                  <PinOff className="w-2.5 h-2.5" aria-hidden />
                </button>
              </>
            )}
          </div>
        </div>
        {diff ? <DiffRows d={diff} current={current} /> : (
          <p className="text-xs font-mono text-text-muted px-2 py-1 rounded" style={{ backgroundColor: withOpacity(ACCENT_CYAN, OPACITY_8) }}>
            Pin the current encounter, then tune: this strip states what the pass changed.
          </p>
        )}
      </div>
    </BlueprintPanel>
  );
}
