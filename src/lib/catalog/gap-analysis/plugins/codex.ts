import { register } from './registry';

register('codex', {
  dimensions: ['faction'],
  summarize: (data: unknown): string => {
    const d = data as { [key: string]: unknown };
    return [d['title'] ?? d['name'], d['faction']].filter(Boolean).join(' · ');
  },
});
