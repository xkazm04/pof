/**
 * Provider-abstraction types for PoF audio asset generation (folder-05 §7).
 * Adding a new provider = a new file under providers/ + a registry entry.
 */

export type AudioKind = 'sfx' | 'ambient' | 'music' | 'tts';

/** Every kind an audio SET can be recorded as — the closed list `AudioKind` names. */
export const AUDIO_KINDS: readonly AudioKind[] = ['sfx', 'ambient', 'music', 'tts'] as const;

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
  /**
   * The kinds `generate` REALLY serves — the contract the route enforces
   * (`supportsKind`), not a wish list. A kind absent here is refused before any
   * billed provider call, so it can never come back as a mislabelled clip.
   */
  capabilities: AudioKind[];
  /**
   * Commercial-licence status, declared ONLY for kinds in `capabilities`. A
   * licence badge for a kind the provider cannot serve is a claim about audio
   * that will never exist — hence `Partial`, and hence the Forge renders
   * "licence not declared" rather than inventing a default.
   */
  commercialLicense: Partial<Record<AudioKind, CommercialLicense>>;
  /**
   * Why each unserved kind is unserved, in the provider's own words. Surfaced
   * verbatim by the route's refusal envelope and next to the disabled option in
   * the Forge — an unavailable kind states its reason instead of vanishing.
   */
  unsupported: Partial<Record<AudioKind, string>>;
  generate(req: AudioGenRequest): Promise<AudioGenResult>;
}
