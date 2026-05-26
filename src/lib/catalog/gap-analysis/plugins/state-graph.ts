import { register } from './registry';

register('state-graph', {
  dimensions: ['category', 'hasRootMotion'],
  summarize: (data: unknown): string => {
    const d = data as { [key: string]: unknown };
    return [d['name'], d['category']].filter(Boolean).join(' · ');
  },
});
