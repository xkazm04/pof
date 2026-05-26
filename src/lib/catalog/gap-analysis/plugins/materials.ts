import { register } from './registry';

register('materials', {
  dimensions: ['surfaceType'],
  summarize: (data: unknown): string => {
    const d = data as { [key: string]: unknown };
    return [d['surfaceType'], d['displayName']].filter(Boolean).join(' · ');
  },
});
