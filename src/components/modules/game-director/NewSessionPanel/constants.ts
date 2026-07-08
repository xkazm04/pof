import {
  Swords, Compass, MessageSquare, Save, Monitor, Bot,
  Gauge, Eye,
} from 'lucide-react';
import type { TestCategory } from '@/types/game-director';
import { ACCENT_ORANGE } from '@/lib/chart-colors';

export const ACCENT = ACCENT_ORANGE;

export const TEST_CATEGORIES: { id: TestCategory; label: string; icon: typeof Swords; description: string }[] = [
  { id: 'combat', label: 'Combat', icon: Swords, description: 'Test combos, hit detection, damage' },
  { id: 'exploration', label: 'Exploration', icon: Compass, description: 'Test zones, navigation, pacing' },
  { id: 'dialogue', label: 'Dialogue', icon: MessageSquare, description: 'Test conversation branches' },
  { id: 'save-load', label: 'Save/Load', icon: Save, description: 'Test state persistence' },
  { id: 'ui-navigation', label: 'UI Navigation', icon: Monitor, description: 'Test menus, HUD, gamepad' },
  { id: 'ai-behavior', label: 'AI Behavior', icon: Bot, description: 'Test NPC pathfinding, reactions' },
  { id: 'performance-stress', label: 'Performance', icon: Gauge, description: 'Stress test FPS, memory' },
  { id: 'visual-quality', label: 'Visual Quality', icon: Eye, description: 'Detect glitches, pop-in, LOD' },
];

export const PLAYTIME_TIPS = [
  '2–5 min — Quick smoke tests, verify a single fix',
  '6–14 min — Targeted feature tests, one system at a time',
  '15–30 min — Deep exploration, emergent bugs, pacing checks',
];

export const SCREENSHOT_TIPS = [
  '5–10s — Visual-heavy tests (glitches, LOD). High storage use',
  '15–30s — Balanced coverage for most test runs',
  '30–60s — Functional / logic tests where visuals matter less',
];

export const AGGRESSIVE_TIPS = [
  'Triggers edge-case inputs: wall-clipping attempts, rapid menu toggling, spam-casting abilities',
  'Useful for stress-testing collision, state machines, and input handling',
  'May produce false positives — review findings with context',
];
