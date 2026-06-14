import {
  ACCENT_VIOLET, ACCENT_ORANGE, MODULE_COLORS,
} from '@/lib/chart-colors';
import { tryApiFetch } from '@/lib/api-utils';
import { nlaStateMachineScript } from '@/lib/blender-mcp/scripts/nla-state-machine';
import type { ExecuteOutput } from '@/lib/blender-mcp/types';
import type { Result } from '@/types/result';

// ── Shared state taxonomy ──
//
// Single source of truth for the state-type classification used by both
// AnimationStateMachine (read-only graph) and StateMachineEditor (editable
// graph). The union is the superset of the two: the editor only ever assigns
// the four non-`montage` members (via its STATE_TYPE_OPTIONS), while the
// read-only graph additionally classifies montage-bearing states. Widening the
// editor to this union is behavior-identical because the extra `montage` color
// is simply never produced there.

export type StateType = 'locomotion' | 'combat' | 'reaction' | 'montage' | 'other';

export const STATE_TYPE_COLORS: Record<StateType, string> = {
  locomotion: MODULE_COLORS.core,
  combat: MODULE_COLORS.evaluator,
  reaction: ACCENT_ORANGE,
  montage: MODULE_COLORS.content,
  other: ACCENT_VIOLET,
};

// ── Shared Blender NLA export ──
//
// Canonical frame-layout convention for exported NLA strips. The project
// standard is 30 FPS throughout (Mixamo import / AnimationChecklist / movement
// specs all specify 30 FPS), so one 30-frame strip == exactly 1 second of
// playback per state. This consolidates the two previously-drifted copies
// (60 in AnimationStateMachine, 30 in StateMachineEditor) onto the 30-frame
// canonical value.
export const NLA_FRAME_DURATION = 30; // frames per state @ 30 FPS == 1s/state

/** A logical state ready for NLA strip layout. */
export interface NLAExportState {
  /** Display label / action name. */
  name: string;
  /** State-type tag (passed through to the Blender script as a comment). */
  type: string;
}

/**
 * Lay out the given states as sequential NLA strips and POST the generated
 * Blender script to the MCP execute endpoint. Each state occupies
 * `frameDuration` frames starting at frame 1 (state i: `[i*d+1, (i+1)*d]`).
 *
 * Returns the non-throwing {@link tryApiFetch} Result so callers can surface
 * success/error without their own try/catch around the network call.
 */
export function exportStatesToBlenderNLA(
  states: NLAExportState[],
  { armatureName = 'Armature', frameDuration = NLA_FRAME_DURATION }: {
    armatureName?: string;
    frameDuration?: number;
  } = {},
): Promise<Result<ExecuteOutput, string>> {
  const code = nlaStateMachineScript({
    armatureName,
    states: states.map((state, i) => ({
      name: state.name,
      type: state.type,
      frameStart: i * frameDuration + 1,
      frameEnd: (i + 1) * frameDuration,
    })),
  });
  return tryApiFetch<ExecuteOutput>('/api/blender-mcp/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
}
