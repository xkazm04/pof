import { register } from './registry';

register('loot-tables', {
  dimensions: ['archetypeName'],
  summarize: (data: unknown): string => {
    const d = data as { [key: string]: unknown };
    const dropChance = d['dropChance'] != null ? `p ${d['dropChance']}` : null;
    return [d['archetypeName'], dropChance].filter(Boolean).join(' · ');
  },
});
