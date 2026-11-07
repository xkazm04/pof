/** An audition take (the speaker has no cast voice) is labelled, and its Approve is disabled with the reason; the casting page lists who needs a voice. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock', variable: 'font-var' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import { VoiceTake } from '@/components/layout-lab/game/voice/voiceTake';
import { CastingRoster } from '@/components/layout-lab/game/voice/castingRoster';
import { LIGHT } from '@/components/layout-lab/theme';
import type { TakeView } from '@/lib/voice/room';
import type { CastingCharacter } from '@/lib/voice/castingTypes';

const TAKE: TakeView = {
  id: 'take-1', gameId: 'gtai', questId: 'q', lineId: 'l', voiceId: 'v1', providerVoiceId: 'p1', textHash: 'h', direction: '', sentText: 'x',
  settings: { model: 'eleven_v3', stability: 0.5, similarityBoost: 0.75, style: 0, speed: 1 }, durationMs: 1000, loudnessLufs: -18, maxSilenceMs: 100,
  readbackText: null, readbackWer: null, chars: 1, verdict: 'pending', verdictNote: null, verdictAt: null, createdAt: 1, stale: true, reason: 'audition',
};
const ok = (data: unknown) => Promise.resolve({ json: () => Promise.resolve({ success: true, data }) });
const CHARS: CastingCharacter[] = [
  { id: 'rivet', title: 'Rivet', hasArt: false, cast: true, role: 'protagonist', group: 'Lead', rounds: 1, open: false },
  { id: 'ohm', title: 'Ohm', hasArt: false, cast: true, role: 'ghost', group: 'Souls', rounds: 1, open: false },
];
const DEMAND = {
  speakers: [], castWithoutLines: [{ characterId: 'ohm', voiceId: 'v9', name: 'Ohm voice' }],
  needsVoice: [
    { speaker: 'don-fax', story: 3, bark: 1, lines: 4, firstQuestId: 'first-quest', firstLineId: 'a', cast: null },
    { speaker: 'nurse', story: 2, bark: 0, lines: 2, firstQuestId: 'second-quest', firstLineId: 'b', cast: null },
  ],
};

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('audition in the room', () => {
  it('labels the take an audition and disables Approve with the reason (Reject stays available)', () => {
    render(<VoiceTake t={LIGHT} take={TAKE} voiceName="Chris" gate={{ token: 'TOKEN', error: null }} onChanged={() => {}} />);
    expect(screen.getByTestId('voice-take-audition').textContent).toContain('audition');
    expect((screen.getByTestId('voice-approve') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('voice-reject') as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByTestId('voice-audition-note').textContent).toContain('no cast voice');
  });

  it('the casting page lists who needs a voice by first appearance and marks cast characters with no lines', async () => {
    vi.stubGlobal('fetch', vi.fn(() => ok({ characters: CHARS, demand: DEMAND })));
    render(<CastingRoster t={LIGHT} v={null} characters={CHARS} current={null} gate={null} onChanged={() => {}} />);
    await waitFor(() => expect(screen.queryByTestId('casting-needs-voice')).not.toBeNull());
    expect(screen.getAllByTestId('casting-needs-voice-row').map((r) => r.getAttribute('data-speaker'))).toEqual(['don-fax', 'nurse']);
    expect(screen.getAllByTestId('casting-needs-voice-row')[0].textContent).toContain('4 lines · first in first-quest');
    const zero = screen.getAllByTestId('casting-zero-lines');
    expect(zero).toHaveLength(1);
    expect(screen.getAllByTestId('casting-pick').find((b) => b.getAttribute('data-character') === 'ohm')?.contains(zero[0])).toBe(true);
  });
});
