'use client';

import { usePofBridge } from '@/hooks/usePofBridge';
import { LayoutLab } from './LayoutLab';

/**
 * Root "New" variant wrapper. Calls usePofBridge() so the bridge-status strip
 * in LayoutLab connects when running inside the real app. The lab's own tests
 * render <LayoutLab /> directly and are unaffected by this wrapper.
 */
export function NewHome() {
  usePofBridge();
  return <LayoutLab />;
}
