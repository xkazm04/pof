import { register } from './registry';

register('spellbook', {
  dimensions: ['tier', 'element', 'category'],
  summarize: (data: unknown): string => {
    const d = data as { [key: string]: unknown };
    const damage = d['damage'] != null ? `dmg ${d['damage']}` : null;
    return [d['tier'], d['element'], d['category'], damage].filter(Boolean).join(' · ');
  },
});
