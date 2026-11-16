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

// ── the `tts` kind: speech with a chosen voice (providers/elevenlabs-speech.ts, the Voice room) ──

export interface SpeechSettings {
  model: string;
  stability: number;
  similarityBoost: number;
  style: number;
  speed: number;
}

export interface SpeechRequest {
  providerVoiceId: string;
  text: string;
  /** Delivery direction in words; sent as audio tags only where the model supports them. */
  direction: string;
  settings: SpeechSettings;
}

export interface SpeechResult {
  bytes: Buffer;
  format: 'mp3';
  /** Exactly what was sent and billed. */
  sentText: string;
  chars: number;
}

export interface SpeechDesignRequest {
  /** The voice description (from the character's voice bible). Never a real person. */
  description: string;
  /** 100-1000 chars the previews speak. */
  text: string;
  /** The design model; default `DESIGN_MODEL`. `eleven_ttv_v3` is the expressive v3 design model. */
  model?: string;
  /** A fixed seed: the same seed with a refined description keeps a voice's identity (casting "iterate"). */
  seed?: number;
}

export interface SpeechDesignResult {
  previews: Array<{ generatedVoiceId: string; bytes: Buffer; durationMs: number | null }>;
  text: string;
  chars: number;
}
