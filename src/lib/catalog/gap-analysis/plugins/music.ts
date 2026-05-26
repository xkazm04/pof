import { register } from './registry';

register('music', {
  dimensions: ['mood', 'bpm'],
  summarize: (data: unknown): string => {
    const d = data as { [key: string]: unknown };
    const bpmLabel = d['bpm'] != null ? `${d['bpm']}bpm` : null;
    return [d['name'], d['mood'], bpmLabel].filter(Boolean).join(' · ');
  },
});
