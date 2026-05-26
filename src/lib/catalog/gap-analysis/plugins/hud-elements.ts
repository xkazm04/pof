import { register } from './registry';

register('hud-elements', {
  dimensions: ['kind'],
  summarize: (data: unknown): string => {
    const d = data as { [key: string]: unknown };
    return [d['name'], d['kind']].filter(Boolean).join(' · ');
  },
});
