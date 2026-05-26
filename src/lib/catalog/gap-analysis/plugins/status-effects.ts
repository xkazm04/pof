import { register } from './registry';

register('status-effects', {
  dimensions: ['element', 'family'],
  summarize: (data: unknown): string => {
    const d = data as { [key: string]: unknown };
    const dur = d['duration'] != null ? `${d['duration']}s` : null;
    return [d['name'], d['element'], dur].filter(Boolean).join(' · ');
  },
});
