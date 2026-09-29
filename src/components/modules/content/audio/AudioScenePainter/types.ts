import type { AudioZone, SoundEmitter, AudioZoneShape } from '@/types/audio-scene';
import type { Bounds, MinimapProjection } from '@/lib/audio-scene-viewport';
import type { SceneDraft } from '@/lib/audio-scene-ops';
import type { SceneBuffer } from '@/components/modules/content/audio/AudioView/useSceneBuffer';

/** The editable half of a scene (zones + emitters). Defined with the op reducer. */
export type { SceneDraft };

export interface MinimapModel {
  proj: MinimapProjection;
  vpRect: Bounds;
}

interface PainterBaseProps {
  /** The server's copy of the scene. */
  zones: AudioZone[];
  emitters: SoundEmitter[];
  onSelectZone: (zoneId: string | null) => void;
  onSelectEmitter: (emitterId: string | null) => void;
  selectedZoneId: string | null;
  selectedEmitterId: string | null;
  accentColor: string;
}

/**
 * Where the painter's edits go — exactly one of:
 *   - `buffer`: a SHARED scene buffer (`useSceneBuffer`) that the property panels
 *     also write through, so the canvas and the panels render and persist one op
 *     list. The painter then renders `buffer.scene` and writes nothing itself.
 *   - callbacks: the painter builds its own buffer and persists through them.
 */
type PainterWrites =
  | {
      buffer: SceneBuffer;
      onCommit?: undefined;
      onUpdateZones?: undefined;
      onUpdateEmitters?: undefined;
    }
  | {
      buffer?: undefined;
      /**
       * Preferred commit path: one write for the whole gesture (zones AND emitters
       * together), so deleting a zone — which also re-derives its emitters' zones —
       * costs one request rather than two. Must REJECT when the write fails; the
       * painter keeps the user's buffer and offers a retry instead of silently
       * reverting. When omitted the painter falls back to `onUpdateZones` /
       * `onUpdateEmitters`, calling only the one(s) whose content actually changed.
       */
      onCommit?: (next: SceneDraft) => void | Promise<unknown>;
      onUpdateZones: (zones: AudioZone[]) => void | Promise<unknown>;
      onUpdateEmitters: (emitters: SoundEmitter[]) => void | Promise<unknown>;
    };

export type AudioScenePainterProps = PainterBaseProps & PainterWrites;

export type PaintMode = 'select' | 'zone-rect' | 'zone-circle' | 'emitter';

export interface DrawState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  shape: AudioZoneShape;
}
