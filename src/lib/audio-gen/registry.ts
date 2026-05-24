import type { AudioProvider } from '@/lib/audio-gen/types';
import { ElevenLabsProvider } from '@/lib/audio-gen/providers/elevenlabs';

export const AUDIO_PROVIDERS: Record<string, AudioProvider> = {
  elevenlabs: ElevenLabsProvider,
};

export function getAudioProvider(id: string): AudioProvider | undefined {
  return AUDIO_PROVIDERS[id];
}
