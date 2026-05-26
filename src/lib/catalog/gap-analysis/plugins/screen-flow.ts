import { register } from './registry';

register('screen-flow', {
  dimensions: ['group'],
  summarize: (data: unknown): string => {
    const d = data as { [key: string]: unknown };
    return [d['label'], d['group']].filter(Boolean).join(' · ');
  },
});
