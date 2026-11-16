/**
 * Casting's view of the line queue (pure: takes the `db`, so tests run on `:memory:`). Casting used to be
 * blind to which speakers have lines: the demand lists, per speaker with a PRESENT line, how many story and
 * bark lines they speak, whether a voice is cast for them and where they first appear in play order, plus
 * the cast voices that speak nothing. The speaker set (quest packages) and the casting roster (bibles, art)
 * overlap only partly, so both sides are listed.
 */
import type Database from 'better-sqlite3';
import { listLines, listVoices } from '@/lib/voice/voice-db';
import type { CastingDemand, SpeakerDemand } from '@/lib/voice/types';

export function castingDemand(db: Database.Database, gameId: string): CastingDemand {
  const cast = new Map(listVoices(db, gameId).filter((v) => v.status === 'cast').map((v) => [v.characterId, v]));
  const bySpeaker = new Map<string, SpeakerDemand>();
  // listLines is present lines in play order (quest order, then lines[] order): the first hit IS the first appearance.
  for (const l of listLines(db, gameId)) {
    const c = cast.get(l.speaker);
    const d = bySpeaker.get(l.speaker) ?? {
      speaker: l.speaker, story: 0, bark: 0, lines: 0, firstQuestId: l.questId, firstLineId: l.lineId,
      cast: c ? { voiceId: c.id, name: c.name } : null,
    };
    if (l.lineClass === 'bark') d.bark += 1; else d.story += 1;
    d.lines += 1;
    bySpeaker.set(l.speaker, d);
  }
  const speakers = [...bySpeaker.values()];
  return {
    speakers,
    needsVoice: speakers.filter((s) => s.cast === null),
    castWithoutLines: [...cast.values()].filter((v) => !bySpeaker.has(v.characterId)).map((v) => ({ characterId: v.characterId, voiceId: v.id, name: v.name })),
  };
}
