import type { SubGenreId } from '@/types/telemetry';

export function formatPatternName(pattern: string): string {
  return pattern
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function formatSubGenreName(id: SubGenreId): string {
  const names: Record<SubGenreId, string> = {
    'souls-like': 'Souls-like',
    'character-action': 'Character Action',
    'diablo-like': 'Diablo-like',
    'arpg-shooter': 'ARPG Shooter',
    'tactical-arpg': 'Tactical ARPG',
    'open-world-arpg': 'Open World ARPG',
    'roguelite-arpg': 'Roguelite ARPG',
    'survival-arpg': 'Survival ARPG',
  };
  return names[id] ?? id;
}
