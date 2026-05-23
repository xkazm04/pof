import type { PromptKind } from './types';

export const BINARY_CONTENT_TRIPWIRE = `## Binary Content Wall
These asset types CANNOT be authored from Python or text — they require the editor's graph/asset tooling:
- Widget Blueprint (WBP) — UMG visual tree; a BindWidget C++ base still needs the WBP
- Animation Blueprint (ABP) — AnimGraph / state machine
- Level (.umap) — placed actors, lighting, navigation
- Behavior Tree graph — task/decorator/service wiring
- Material Function graph — node network
- Skeletal mesh / skeleton — rig and bind pose
If your solution depends on one of these, declare it in Wiring Requirements and prefer a pure-C++ pattern where one exists (e.g. build the Slate tree in RebuildWidget instead of a WBP).`;

/**
 * Returns the binary-content tripwire for UE prompt kinds, '' for web.
 */
export function formatBinaryContentTripwire(kind: PromptKind): string {
  if (kind === 'web') return '';
  return BINARY_CONTENT_TRIPWIRE;
}
