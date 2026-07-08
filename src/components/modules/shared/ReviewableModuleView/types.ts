import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { SubModuleId, ChecklistItem, QuickAction } from '@/types/modules';

export interface ExtraTab {
  id: string;
  label: string;
  icon?: LucideIcon;
  render: (moduleId: SubModuleId) => ReactNode;
}

export interface ReviewableModuleViewProps {
  moduleId: SubModuleId;
  moduleLabel: string;
  moduleDescription: string;
  moduleIcon: LucideIcon;
  accentColor: string;
  checklist: ChecklistItem[];
  quickActions: QuickAction[];
  extraTabs?: ExtraTab[];
}
