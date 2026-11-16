/**
 * The words a refused approval carries (the verdict route answers 409 with them). One reason per
 * `StaleReason` (`lineQueue.ts` decides it), so the owner reads why a take cannot be approved.
 */
import { staleReason, type VoiceCtx } from '@/lib/voice/lineQueue';
import { describeProfile } from '@/lib/voice/takeProfile';
import type { QueueLine, TakeRow, TakeSettings } from '@/lib/voice/types';

export const TEXT_EDITED_REFUSAL = 'This take speaks an older text of the line (the quest package changed); it cannot be approved.';

const describeSettings = (s: TakeSettings): string => `${s.model}, speed ${s.speed}, stability ${s.stability}, style ${s.style}`;

/** null = the take may be approved; otherwise why not. `line` null/absent = the line left the queue. */
export function approvalRefusal(take: TakeRow, line: QueueLine | null, ctx: VoiceCtx): string | null {
  if (!line || !line.present) return TEXT_EDITED_REFUSAL;
  const reason = staleReason(take, line, ctx);
  switch (reason) {
    case null: return null;
    case 'text-edited': return TEXT_EDITED_REFUSAL;
    case 'wrong-speaker': {
      const owner = ctx.voices.get(take.voiceId)?.characterId;
      return `This take's voice ${owner ? `belongs to ${owner}` : 'has no voice row'}, not to the line's speaker ${line.speaker} (the quest package may have reassigned the line); it cannot be approved.`;
    }
    case 'audition':
      return `This take is an audition: ${line.speaker} has no cast voice; cast ${line.speaker} first (Cast tab), then approve a take in the cast voice.`;
    case 'profile-changed':
      return `This take was rendered with a recipe (${describeSettings(take.settings)}) that is not its voice's take profile (${describeProfile(ctx.voices.get(take.voiceId)?.takeProfile)}); generate a new take (Generate defaults to the profile) or change the profile.`;
    case 'recast':
      return "This take is not in the speaker's cast voice; cast that voice first, or approve a take in the cast voice.";
  }
}
