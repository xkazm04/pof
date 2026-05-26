import { register } from './registry';

register('characters', {
  dimensions: ['role'],
  summarize: (data: unknown): string => {
    const d = data as { [key: string]: unknown };
    return [d['name'], d['role'], d['class']].filter(Boolean).join(' · ');
  },
});
