import { register } from './registry';

register('crafting-recipes', {
  dimensions: ['outputType'],
  summarize: (data: unknown): string => {
    const d = data as { [key: string]: unknown };
    const matCount = d['materials'] != null
      ? `mats ${Array.isArray(d['materials']) ? d['materials'].length : '?'}`
      : null;
    return [d['outputName'] ?? d['name'], matCount].filter(Boolean).join(' · ');
  },
});
