import { register } from './registry';

register('ambient', {
  dimensions: ['biome'],
  summarize: (data: unknown): string => {
    const d = data as { [key: string]: unknown };
    return [d['name'], d['biome']].filter(Boolean).join(' · ');
  },
});
