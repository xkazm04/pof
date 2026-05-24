'use client';

import { Zap, Swords, Shield, Camera, Activity } from 'lucide-react';
import {
  MODULE_COLORS, ACCENT_ORANGE, ACCENT_EMERALD, ACCENT_CYAN,
  ACCENT_VIOLET, STATUS_ERROR,
} from '@/lib/chart-colors';

export const ACCENT = MODULE_COLORS.core;

export const CATEGORY_ICONS: Record<string, typeof Zap> = {
  Movement: Zap,
  Combat: Swords,
  Dodge: Shield,
  Camera: Camera,
  Stamina: Activity,
};

export const CATEGORY_COLORS: Record<string, string> = {
  Movement: ACCENT_EMERALD,
  Combat: STATUS_ERROR,
  Dodge: ACCENT_CYAN,
  Camera: ACCENT_ORANGE,
  Stamina: ACCENT_VIOLET,
};

export const FEEL_HINTS = [
  'Dark Souls heavy',
  'Hades snappy',
  'Diablo 4 weighty',
  'DMC5 stylish',
  'Monster Hunter deliberate',
] as const;
