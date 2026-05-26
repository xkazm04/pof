import { register } from './registry';

register('icon-sets', {
  dimensions: ['theme'],
  summarize: (data: unknown): string => {
    const d = data as { [key: string]: unknown };
    return [d['setName'] ?? d['name'], d['theme']].filter(Boolean).join(' · ');
  },
});
