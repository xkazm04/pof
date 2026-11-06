import type { PromptKind } from './types';

export const BINARY_CONTENT_TRIPWIRE = `## Binary Content Wall
Ask once per channel you hold: C++ source the compiler reads; a Python script the FULL editor runs headless (-ExecutePythonScript, not -run=pythonscript); a tool protocol into a running editor (\`unreal-official\`, only if this session lists it and the editor is serving). A class stays on the wall when the probe fails on every channel you hold.
These asset types CANNOT be authored from C++ source or a headless script — they require the editor's graph/asset tooling. No live-channel write is proven for them here: if you hold one, probe it and read the result back before relying on it:
- Widget Blueprint (WBP) — UMG visual tree; a BindWidget C++ base still needs the WBP
- Animation Blueprint (ABP) — AnimGraph / state machine
- Behavior Tree graph — task/decorator/service wiring
- Material Function graph — node network
- Skeletal mesh / skeleton — rig and bind pose
Level (.umap) is NOT on the wall: script placement and the save through the full editor, then read the map back. Lightmass bake is skipped headlessly, so use Movable lights or declare the bake as a dependency. On a live channel, log each call as a replayable step; that replay is unproven until it has rebuilt the level from empty.
If your solution depends on a class on the wall, declare it in Wiring Requirements and prefer a pure-C++ pattern where one exists (e.g. build the Slate tree in RebuildWidget instead of a WBP).`;

/**
 * Returns the binary-content tripwire for UE prompt kinds, '' for web.
 */
export function formatBinaryContentTripwire(kind: PromptKind): string {
  if (kind === 'web') return '';
  return BINARY_CONTENT_TRIPWIRE;
}
