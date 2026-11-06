/**
 * Client-safe casting shapes (no node imports): the Casting page imports these, while the server read model
 * (`castingView.ts`, which reads files and the database) re-exports them.
 */
export type CastingGroup = 'Lead' | 'Souls' | 'Bosses' | 'Cast';
export const CASTING_GROUPS: readonly CastingGroup[] = ['Lead', 'Souls', 'Bosses', 'Cast'];

export interface CastingCharacter {
  id: string; title: string; hasArt: boolean; cast: boolean;
  /** One line: who they are (art.json `$roles`, else the bible's id line). */
  role: string;
  group: CastingGroup;
  /** Rounds so far, and whether one waits for the owner's verdicts. */
  rounds: number;
  open: boolean;
}
