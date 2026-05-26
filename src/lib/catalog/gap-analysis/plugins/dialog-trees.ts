import { register } from './registry';

register('dialog-trees', {
  dimensions: ['npcId'],
  summarize: (data: unknown): string => {
    const d = data as { [key: string]: unknown };
    return [d['name'], d['npcId']].filter(Boolean).join(' · ');
  },
});
