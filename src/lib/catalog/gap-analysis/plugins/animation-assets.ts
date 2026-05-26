import { register } from './registry';

register('animation-assets', {
  dimensions: ['skeleton', 'source'],
  summarize: (data: unknown): string => {
    const d = data as { [key: string]: unknown };
    return [d['assetName'], d['source']].filter(Boolean).join(' · ');
  },
});
