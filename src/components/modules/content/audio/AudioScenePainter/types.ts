import type { AudioZone, SoundEmitter, AudioZoneShape } from '@/types/audio-scene';
import type { Bounds, MinimapProjection } from '@/lib/audio-scene-viewport';

export interface MinimapModel {
  proj: MinimapProjection;
  vpRect: Bounds;
}

export interface AudioScenePainterProps {
  zones: AudioZone[];
  emitters: SoundEmitter[];
  onUpdateZones: (zones: AudioZone[]) => void;
  onUpdateEmitters: (emitters: SoundEmitter[]) => void;
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
