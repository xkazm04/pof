import { Activity, Camera, Target, Gamepad2, AlertOctagon, Info } from 'lucide-react';
import { ACCENT_ORANGE } from '@/lib/chart-colors';

export const ACCENT = ACCENT_ORANGE;

export const EVENT_ICONS: Record<string, typeof Activity> = {
  action: Activity,
  observation: Info,
  screenshot: Camera,
  finding: Target,
  'system-test': Gamepad2,
  error: AlertOctagon,
};
