import { register } from './registry';

register('audio', {
  dimensions: ['surface', 'license'],
  summarize: (data: unknown): string => {
    const d = data as { [key: string]: unknown };
    return [d['setName'], d['surface']].filter(Boolean).join(' · ');
  },
});
