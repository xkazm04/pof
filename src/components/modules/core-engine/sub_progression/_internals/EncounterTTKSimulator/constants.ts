import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
  ACCENT_CYAN, ACCENT_VIOLET, ACCENT_ORANGE,
} from '@/lib/chart-colors';
import type { EnemyType, EncounterResult } from './types';

/* ── Encounter TTK Simulator Data ────────────────────────────────────────── */

export const ENEMY_TYPES: EnemyType[] = [
  { name: 'Trash Mob', hpMultiplier: 0.6, dpsMultiplier: 0.5, armorMultiplier: 0.3, icon: '\u{1F400}', color: STATUS_SUCCESS },
  { name: 'Normal', hpMultiplier: 1.0, dpsMultiplier: 1.0, armorMultiplier: 1.0, icon: '⚔️', color: STATUS_WARNING },
  { name: 'Elite', hpMultiplier: 2.5, dpsMultiplier: 1.8, armorMultiplier: 1.5, icon: '\u{1F6E1}️', color: ACCENT_ORANGE },
  { name: 'Champion', hpMultiplier: 5.0, dpsMultiplier: 2.5, armorMultiplier: 2.0, icon: '\u{1F451}', color: ACCENT_VIOLET },
  { name: 'Boss', hpMultiplier: 12.0, dpsMultiplier: 3.5, armorMultiplier: 3.0, icon: '\u{1F480}', color: STATUS_ERROR },
];

export const DEFAULT_HEALTHY_RANGE = { min: 2.0, max: 5.0 };

export const VERDICT_STYLES: Record<EncounterResult['balanceVerdict'], { color: string; label: string; desc: string }> = {
  trivial: { color: ACCENT_CYAN, label: 'TRIVIAL', desc: 'No challenge — player massively overleveled' },
  easy: { color: STATUS_SUCCESS, label: 'EASY', desc: 'Low threat — consider reducing player power or buffing enemy' },
  balanced: { color: STATUS_WARNING, label: 'BALANCED', desc: 'Healthy encounter — engaging combat' },
  hard: { color: ACCENT_ORANGE, label: 'HARD', desc: 'High tension — player may die if not careful' },
  lethal: { color: STATUS_ERROR, label: 'LETHAL', desc: 'Near-certain death — player severely undergeared/underleveled' },
};
