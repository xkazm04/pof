import { register } from './registry';

register('progression-curves', {
  dimensions: ['type'],
  summarize: (data: unknown): string => {
    const d = data as { [key: string]: unknown };
    return [d['name'], d['type']].filter(Boolean).join(' · ');
  },
});
