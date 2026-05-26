import { register } from './registry';

register('combat-map', {
  dimensions: ['name'],
  summarize: (data: unknown): string => {
    const d = data as { [key: string]: unknown };
    return [d['name'], d['weaponCategory'] ?? d['position']].filter(Boolean).join(' · ');
  },
});
