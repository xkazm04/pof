import {
  Swords, TreePine, Monitor, Music,
} from 'lucide-react';
import {
  STATUS_ERROR, ACCENT_EMERALD, STATUS_INFO, ACCENT_VIOLET, STATUS_WARNING,
  MODULE_COLORS,
} from '@/lib/chart-colors';
import type { EventCategory, PriorityLevel, AudioEvent } from './types';

export const ACCENT = MODULE_COLORS.content;

// -- Constants --

export const CATEGORY_CONFIG: Record<EventCategory, {
  color: string;
  label: string;
  icon: typeof Swords;
  description: string;
}> = {
  combat: {
    color: STATUS_ERROR,
    label: 'Combat',
    icon: Swords,
    description: 'Hit impacts, death cries, dodge whooshes, ability casts',
  },
  environment: {
    color: ACCENT_EMERALD,
    label: 'Environment',
    icon: TreePine,
    description: 'Ambient loops, footsteps, doors, weather',
  },
  ui: {
    color: STATUS_INFO,
    label: 'UI',
    icon: Monitor,
    description: 'Button clicks, menu open/close, notifications',
  },
  music: {
    color: ACCENT_VIOLET,
    label: 'Music',
    icon: Music,
    description: 'Combat layers, exploration, boss themes',
  },
};

export const PRIORITY_CONFIG: Record<PriorityLevel, { color: string; label: string; weight: number }> = {
  low: { color: 'var(--text-muted)', label: 'Low', weight: 0 },
  normal: { color: STATUS_INFO, label: 'Normal', weight: 1 },
  high: { color: STATUS_WARNING, label: 'High', weight: 2 },
  critical: { color: STATUS_ERROR, label: 'Critical', weight: 3 },
};

export const CATEGORIES: EventCategory[] = ['combat', 'environment', 'ui', 'music'];

export const DEFAULT_EVENTS: AudioEvent[] = [
  // Combat
  { id: 'evt-1', name: 'Melee Hit', category: 'combat', trigger: 'OnMeleeHitConfirm', priority: 'high', spatial: '3d', concurrency: 4, cooldownMs: 50, tags: ['impact'] },
  { id: 'evt-2', name: 'Player Death', category: 'combat', trigger: 'OnCharacterDeath', priority: 'critical', spatial: '3d', concurrency: 1, cooldownMs: 0, tags: ['death', 'voice'] },
  { id: 'evt-3', name: 'Dodge Roll', category: 'combat', trigger: 'OnDodgeExecute', priority: 'normal', spatial: '3d', concurrency: 1, cooldownMs: 200, tags: ['movement'] },
  { id: 'evt-4', name: 'Ability Cast', category: 'combat', trigger: 'OnAbilityActivated', priority: 'high', spatial: '3d', concurrency: 2, cooldownMs: 100, tags: ['ability', 'magic'] },
  // Environment
  { id: 'evt-5', name: 'Footstep', category: 'environment', trigger: 'OnFootstepNotify', priority: 'low', spatial: '3d', concurrency: 2, cooldownMs: 100, tags: ['movement', 'surface'] },
  { id: 'evt-6', name: 'Door Open', category: 'environment', trigger: 'OnInteractDoor', priority: 'normal', spatial: '3d', concurrency: 1, cooldownMs: 500, tags: ['interact'] },
  { id: 'evt-7', name: 'Ambient Loop', category: 'environment', trigger: 'OnZoneEnter', priority: 'low', spatial: '3d', concurrency: 3, cooldownMs: 0, tags: ['ambient', 'loop'] },
  // UI
  { id: 'evt-8', name: 'Button Click', category: 'ui', trigger: 'OnUIButtonPressed', priority: 'normal', spatial: '2d', concurrency: 1, cooldownMs: 50, tags: ['click'] },
  { id: 'evt-9', name: 'Menu Open', category: 'ui', trigger: 'OnMenuOpened', priority: 'normal', spatial: '2d', concurrency: 1, cooldownMs: 0, tags: ['menu'] },
  { id: 'evt-10', name: 'Notification', category: 'ui', trigger: 'OnNotificationReceived', priority: 'high', spatial: '2d', concurrency: 2, cooldownMs: 300, tags: ['alert'] },
  // Music
  { id: 'evt-11', name: 'Combat Layer', category: 'music', trigger: 'OnCombatStateChange', priority: 'high', spatial: '2d', concurrency: 1, cooldownMs: 0, tags: ['layer', 'combat'] },
  { id: 'evt-12', name: 'Exploration Layer', category: 'music', trigger: 'OnExplorationStart', priority: 'normal', spatial: '2d', concurrency: 1, cooldownMs: 0, tags: ['layer', 'explore'] },
  { id: 'evt-13', name: 'Boss Theme', category: 'music', trigger: 'OnBossEncounterStart', priority: 'critical', spatial: '2d', concurrency: 1, cooldownMs: 0, tags: ['boss', 'layer'] },
];
