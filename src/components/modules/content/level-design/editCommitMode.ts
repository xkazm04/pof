/**
 * @deprecated Import `EditCommitMode` from `@/hooks/useEntityCommitBuffer`.
 *
 * The vocabulary moved to sit beside the shared commit buffer it names, so the
 * next per-keystroke fix finds both together. This re-export only exists so a
 * level-design file still open in a parallel session keeps compiling; delete it
 * once nothing imports `../editCommitMode`.
 */
export type { EditCommitMode } from '@/hooks/useEntityCommitBuffer';
