import { register } from './registry';

register('achievements', {
  dimensions: ['tier'],
  summarize: (data: unknown): string => {
    const d = data as { [key: string]: unknown };
    return [d['name'], d['tier']].filter(Boolean).join(' · ');
  },
});
