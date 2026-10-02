import type { AudioSceneDocument, LevelAudioSyncRow, LevelAudioSyncStatus, ReverbPreset } from '@/types/audio-scene';
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
  rows: LevelAudioSyncRow[];
  summary: Record<LevelAudioSyncStatus, number>;
  merged: boolean;
}

/** `action: 'preview'`: what applying would do. Nothing has been written. */
export interface SyncPreview {
  rows: LevelAudioSyncRow[];
  /** The SceneOps applying would replay; only the count is shown. */
  ops: unknown[];
  summary: Record<LevelAudioSyncStatus, number>;
  suggestedGlobalReverb: ReverbPreset;
  report: RoomAudioReport[];
  targetSceneId: number | null;
}

export interface SpatialAudioGeneratorPanelProps {
  activeDoc: AudioSceneDocument | null;
  accentColor: string;
  onSceneCreated: () => void;
}
