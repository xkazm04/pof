import { register } from './registry';

register('save-points', {
  dimensions: ['type'],
  summarize: (data: unknown): string => {
    const d = data as { [key: string]: unknown };
    return [d['name'], d['type']].filter(Boolean).join(' · ');
  },
});
