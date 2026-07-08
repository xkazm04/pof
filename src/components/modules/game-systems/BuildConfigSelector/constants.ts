import {
  Monitor, Terminal as TerminalIcon, Laptop, Smartphone, Tablet,
} from 'lucide-react';
import {
  type PlatformId, type BuildConfig,
} from '@/lib/packaging/build-profiles';

export const PLATFORM_ICONS: Record<PlatformId, typeof Monitor> = {
  Win64: Monitor,
  Linux: TerminalIcon,
  Mac: Laptop,
  Android: Smartphone,
  IOS: Tablet,
};

export const CONFIG_OPTIONS: Array<{ value: BuildConfig; label: string; description: string }> = [
  { value: 'Development', label: 'Development', description: 'Debug features enabled, no optimizations' },
  { value: 'DebugGame', label: 'DebugGame', description: 'Game debugging with engine optimizations' },
  { value: 'Shipping', label: 'Shipping', description: 'Final build, all optimizations, no debug' },
  { value: 'Test', label: 'Test', description: 'Shipping-like with test features enabled' },
];
