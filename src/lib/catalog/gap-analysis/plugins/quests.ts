import { register } from './registry';

register('quests', {
  dimensions: ['status', 'area'],
  summarize: (data: unknown): string => {
    const d = data as { [key: string]: unknown };
    return [d['name'], d['area']].filter(Boolean).join(' · ');
  },
});
