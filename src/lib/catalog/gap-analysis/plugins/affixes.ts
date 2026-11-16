import { register } from './registry';

register('affixes', {
  dimensions: ['group', 'isPrefix', 'minRarity'],
  summarize: (data: unknown): string => {
    const d = data as { [key: string]: unknown };
    const slot = d['isPrefix'] === true ? 'prefix' : d['isPrefix'] === false ? 'suffix' : null;
    return [d['displayName'], slot, d['group']].filter(Boolean).join(' · ');
  },
});
