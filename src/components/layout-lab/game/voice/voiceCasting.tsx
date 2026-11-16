'use client';

/**
 * The Voice room's Casting page (`?room=voice&cast=<character>`): find a character's voice over rounds of up to 5
 * designed voices, one line per voice, verdicts as toggles, the whole round sent with one submit. Layout: the
 * Roster (`castingRoster.tsx`), the owner's pick on 2026-11-06 over the Dossier and Spotlight prototypes.
 */
import { LoadingRow } from '@/components/ui/LoadingRow';
import { InlineErrorRetry } from '@/components/modules/shared/InlineErrorRetry';
import type { LabTheme } from '@/components/layout-lab/theme';
import type { CastingCharacter } from '@/lib/voice/castingTypes';
import type { CastingView } from '@/lib/voice/castingView';
import { useCasting } from './voiceRoomData';
import { NO_CLONE_NOTE } from './voiceGateClient';
import { CastingRoster } from './castingRoster';

type Data = CastingView | { characters: CastingCharacter[] };
const isView = (d: Data): d is CastingView => 'rounds' in d;

export function VoiceCasting({ t, character, gate }: { t: LabTheme; character: string | null; gate: string | null }) {
  const { read, reload } = useCasting<Data>(character || null);
  const data = read.kind === 'ready' ? read.data : null;
  return (
    <div data-testid="voice-casting" style={{ display: 'grid', gap: 18, alignContent: 'start' }}>
      <span style={{ fontSize: 'var(--lab-fs-xs)', color: t.muted }}>{NO_CLONE_NOTE}</span>
      {read.kind === 'loading' && <LoadingRow variant="inline" label="Reading the casting rounds…" />}
      {read.kind === 'error' && <InlineErrorRetry message={`casting unavailable (${read.reason})`} onRetry={reload} />}
      {data && (
        <CastingRoster t={t} v={isView(data) ? data : null} characters={data.characters} current={character || null} gate={gate} onChanged={reload} />
      )}
    </div>
  );
}
