import type { AudioZone, SoundEmitter, AudioZoneShape } from '@/types/audio-scene';
import type { Bounds, MinimapProjection } from '@/lib/audio-scene-viewport';

export interface MinimapModel {
  proj: MinimapProjection;
  vpRect: Bounds;
}

/**
 * The painter's optimistic buffer: the scene as the user's in-flight gesture has
 * left it, before (or while) the server knows about it.
 */
export interface SceneDraft {
  zones: AudioZone[];
  emitters: SoundEmitter[];
}

export interface AudioScenePainterProps {
  zones: AudioZone[];
  emitters: SoundEmitter[];
  onUpdateZones: (zones: AudioZone[]) => void | Promise<unknown>;
  onUpdateEmitters: (emitters: SoundEmitter[]) => void | Promise<unknown>;
  /**
   * Preferred commit path: one write for the whole gesture (zones AND emitters
   * together), so deleting a zone — which also unlinks its emitters — costs one
   * request rather than two. Must REJECT when the write fails; the painter keeps
   * the user's buffer and offers a retry instead of silently reverting.
   * When omitted the painter falls back to `onUpdateZones` / `onUpdateEmitters`,
   * calling only the one(s) whose content actually changed.
   */
  onCommit?: (next: SceneDraft) => void | Promise<unknown>;
  onSelectZone: (zoneId: string | null) => void;
  onSelectEmitter: (emitterId: string | null) => void;
  selectedZoneId: string | null;
  selectedEmitterId: string | null;
  accentColor: string;
}

export type PaintMode = 'select' | 'zone-rect' | 'zone-circle' | 'emitter';

export interface DrawState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  shape: AudioZoneShape;
}
