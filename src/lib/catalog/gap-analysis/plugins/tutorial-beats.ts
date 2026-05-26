import { register } from './registry';

register('tutorial-beats', {
  dimensions: ['stage'],
  summarize: (data: unknown): string => {
    const d = data as { [key: string]: unknown };
    return [d['name'], d['stage']].filter(Boolean).join(' · ');
  },
});
