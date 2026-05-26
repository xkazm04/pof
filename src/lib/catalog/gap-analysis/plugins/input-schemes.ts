import { register } from './registry';

register('input-schemes', {
  dimensions: ['device'],
  summarize: (data: unknown): string => {
    const d = data as { [key: string]: unknown };
    return [d['name'], d['device']].filter(Boolean).join(' · ');
  },
});
