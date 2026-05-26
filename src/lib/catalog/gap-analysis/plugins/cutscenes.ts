import { register } from './registry';

register('cutscenes', {
  dimensions: [],
  summarize: (data: unknown): string => {
    const d = data as { [key: string]: unknown };
    return [d['name']].filter(Boolean).join(' · ');
  },
});
