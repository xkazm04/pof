'use client';

import { useNavigationStore } from '@/stores/navigationStore';
import { SidebarL1 } from './SidebarL1';
import { SidebarL2 } from './SidebarL2';

export function Sidebar() {
  const sidebarMode = useNavigationStore((s) => s.sidebarMode);

  if (sidebarMode === 'hidden') return null;

  return (
    <div className="flex h-full">
      <SidebarL1 />
      {sidebarMode === 'full' && <SidebarL2 />}
    </div>
  );
}
