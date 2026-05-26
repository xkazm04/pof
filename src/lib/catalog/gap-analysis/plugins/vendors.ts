import { register } from './registry';

register('vendors', {
  dimensions: ['faction'],
  summarize: (data: unknown): string => {
    const d = data as { [key: string]: unknown };
    return [d['name'], d['faction']].filter(Boolean).join(' · ');
  },
});
