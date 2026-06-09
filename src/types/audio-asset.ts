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
  /** Whether the user starred this variation. Persisted in the DB. */
  favorite: boolean;
  /**
   * Content hash of the generation request (provider+kind+prompt+duration).
   * Powers the cache that skips regenerating an identical prompt. Null for
   * assets created before the cache existed.
   */
  promptHash: string | null;
  createdAt: number;
}

/**
 * Rolling generation-usage summary surfaced as the library quota meter. Real
 * provider calls are billed; cache hits are calls we skipped (spend saved).
 */
export interface AudioUsageSummary {
  /** Billed provider calls in the current window. */
  generated: number;
  /** Calls served from the content-hash cache in the current window (saved). */
  cached: number;
  /** Informational monthly budget the meter fills against. */
  quota: number;
  /** Start of the window the counts cover (ms epoch). */
  windowStart: number;
  /** All-time billed provider calls. */
  totalGenerated: number;
  /** All-time cache hits. */
  totalCached: number;
}
