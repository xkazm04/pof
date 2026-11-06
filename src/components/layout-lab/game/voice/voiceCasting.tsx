'use client';

/**
 * The Voice room's Casting page (`?room=voice&cast=<character>`): find a character's voice over rounds of up to 5
 * designed voices, one line per voice, verdicts as toggles, the whole round sent with one submit. Three visual
 * prototypes share the data and the round list and differ in the character selector, the bible's layout and
 * the page shell: `?look=a` Roster, `b` Dossier, `c` Spotlight (the switch at the top, kept in the address).
 */
import { MicroLabel } from '@/components/ui/MicroLabel';
import { LoadingRow } from '@/components/ui/LoadingRow';
import { InlineErrorRetry } from '@/components/modules/shared/InlineErrorRetry';
import type { LabTheme } from '@/components/layout-lab/theme';
import type { CastingCharacter, CastingView } from '@/lib/voice/castingView';
import { useCasting } from './voiceRoomData';
import { setLook, useLookParam } from './voiceRoomParam';
import { NO_CLONE_NOTE } from './voiceGateClient';
import type { CastingLook } from './castingRow';
import { CastingLookRoster } from './castingLookRoster';
import { CastingLookDossier } from './castingLookDossier';
import { CastingLookSpotlight } from './castingLookSpotlight';

const LOOKS: Array<{ id: CastingLook; name: string }> = [{ id: 'a', name: 'Roster' }, { id: 'b', name: 'Dossier' }, { id: 'c', name: 'Spotlight' }];
type Data = CastingView | { characters: CastingCharacter[] };
const isView = (d: Data): d is CastingView => 'rounds' in d;

function LookSwitch({ t, look }: { t: LabTheme; look: CastingLook }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <MicroLabel mono uppercase tone="muted">Prototype</MicroLabel>
      <div role="radiogroup" aria-label="Casting page prototype" style={{ display: 'inline-flex', flexWrap: 'wrap', maxWidth: '100%', border: `1px solid ${t.line}`, borderRadius: 999, padding: 2 }}>
        {LOOKS.map((l) => (
          <button key={l.id} type="button" role="radio" aria-checked={l.id === look} className="focus-ring" data-testid={`casting-look-${l.id}-btn`} onClick={() => setLook(l.id)}
            style={{ padding: '3px 12px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 'var(--lab-fs-xs)', fontWeight: l.id === look ? 700 : 500,
              background: l.id === look ? t.ink : 'transparent', color: l.id === look ? t.onAccent : t.text }}>
            {l.id.toUpperCase()} · {l.name}
          </button>
        ))}
      </div>
      <span style={{ fontSize: 'var(--lab-fs-xs)', color: t.muted }}>{NO_CLONE_NOTE}</span>
    </div>
  );
}

export function VoiceCasting({ t, character, gate }: { t: LabTheme; character: string | null; gate: string | null }) {
  const raw = useLookParam();
  const look: CastingLook = raw === 'b' || raw === 'c' ? raw : 'a';
  const { read, reload } = useCasting<Data>(character || null);
  const data = read.kind === 'ready' ? read.data : null;
  const view = data && isView(data) ? data : null;
  const props = { t, v: view, characters: data?.characters ?? [], current: character || null, gate, onChanged: reload };
  return (
    <div data-testid="voice-casting" style={{ display: 'grid', gap: 18, alignContent: 'start' }}>
      <LookSwitch t={t} look={look} />
      {read.kind === 'loading' && <LoadingRow variant="inline" label="Reading the casting rounds…" />}
      {read.kind === 'error' && <InlineErrorRetry message={`casting unavailable (${read.reason})`} onRetry={reload} />}
      {data && look === 'a' && <CastingLookRoster {...props} />}
      {data && look === 'b' && <CastingLookDossier {...props} />}
      {data && look === 'c' && <CastingLookSpotlight {...props} />}
    </div>
  );
}
