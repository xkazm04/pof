/**
 * Provider-abstraction types for PoF audio asset generation (folder-05 §7).
 * Adding a new provider = a new file under providers/ + a registry entry.
 */

export type AudioKind = 'sfx' | 'ambient' | 'music' | 'tts';

export type CommercialLicense = 'yes' | 'extra-license' | 'non-commercial';

export interface AudioGenRequest {
  kind: AudioKind;
  prompt: string;
  /** 0.5-22 sec. If omitted, the provider chooses. */
  durationSeconds?: number;
  /** Metadata only — applied at UE import (USoundWave.looping). Not sent to providers. */
  loop?: boolean;
  /** Hint; provider may downgrade. */
  outputFormat?: 'mp3' | 'wav';
}

export interface AudioGenResult {
  bytes: Buffer;
  format: 'mp3' | 'wav';
  /** Approximate ms — set from `durationSeconds` if known, otherwise 0. */
  durationMs: number;
}

export interface AudioProvider {
  id: string;
  label: string;
  capabilities: AudioKind[];
  commercialLicense: Record<AudioKind, CommercialLicense>;
  generate(req: AudioGenRequest): Promise<AudioGenResult>;
}
