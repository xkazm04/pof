import type { AudioKind } from '@/lib/audio-gen/types';

export interface AudioSet {
  id: string;
  name: string;
  kind: AudioKind;
  eventKey: string | null;
  surface: string | null;
  loopable: boolean;
  createdAt: number;
}

export interface AudioAsset {
  id: string;
  setId: string;
  filename: string;
  relPath: string;
  prompt: string;
  provider: string;
  durationMs: number;
  format: 'mp3' | 'wav';
  createdAt: number;
}
