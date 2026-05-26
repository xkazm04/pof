import { register } from './registry';

register('factions', {
  dimensions: [],
  summarize: (data: unknown): string => {
    const d = data as { [key: string]: unknown };
    return [d['name'], d['description']].filter(Boolean).join(' · ');
  },
});
