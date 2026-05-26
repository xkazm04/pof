import { register } from './registry';

register('bestiary', {
  dimensions: ['tier', 'role', 'category'],
  expectedShare: {
    tier: { minion: 0.30, standard: 0.40, elite: 0.20, boss: 0.08, 'raid-boss': 0.02 },
    role: { melee: 0.30, ranged: 0.25, tank: 0.15, caster: 0.15, healer: 0.08, swarm: 0.07 },
  },
  summarize: (data: unknown): string => {
    const d = data as { class?: string; tier?: string; role?: string; category?: string };
    return [d.tier, d.role, d.category ?? d.class].filter(Boolean).join(' · ');
  },
});
