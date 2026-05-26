import { register } from './registry';

register('currencies', {
  dimensions: ['scope'],
  summarize: (data: unknown): string => {
    const d = data as { [key: string]: unknown };
    return [d['name'], d['scope']].filter(Boolean).join(' · ');
  },
});
