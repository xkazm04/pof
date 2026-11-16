import { register } from './registry';

register('zone-map', {
  dimensions: ['type', 'status'],
  summarize: (data: unknown): string => {
    const d = data as { [key: string]: unknown };
    return [d['displayName'], d['group'], d['status']].filter(Boolean).join(' · ');
  },
});
