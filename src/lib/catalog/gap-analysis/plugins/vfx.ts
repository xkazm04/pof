import { register } from './registry';

register('vfx', {
  dimensions: ['element'],
  summarize: (data: unknown): string => {
    const d = data as { [key: string]: unknown };
    return [d['name'], d['element']].filter(Boolean).join(' · ');
  },
});
