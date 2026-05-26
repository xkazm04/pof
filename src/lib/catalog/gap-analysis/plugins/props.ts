import { register } from './registry';

register('props', {
  dimensions: ['destructible', 'archetypeRef'],
  summarize: (data: unknown): string => {
    const d = data as { [key: string]: unknown };
    const destrLabel = d['destructible'] != null ? (d['destructible'] ? 'destr' : 'static') : null;
    return [d['name'], destrLabel].filter(Boolean).join(' · ');
  },
});
