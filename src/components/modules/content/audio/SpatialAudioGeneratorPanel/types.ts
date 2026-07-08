import type { AudioSceneDocument } from '@/types/audio-scene';
import type { RoomAudioReport } from '@/lib/spatial-audio-generator';

export interface LevelDocItem {
  id: number;
  name: string;
  roomCount: number;
  connectionCount: number;
}

export interface GenerateResult {
  audioScene: AudioSceneDocument;
  report: RoomAudioReport[];
  merged: boolean;
}

export interface SpatialAudioGeneratorPanelProps {
  activeDoc: AudioSceneDocument | null;
  accentColor: string;
  onSceneCreated: () => void;
}
