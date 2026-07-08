import type { LucideIcon } from 'lucide-react';

export interface SystemNode {
  id: string;
  label: string;
  subtitle: string;
  description: string;
  icon: LucideIcon;
  prompt: string;
  /** Position in the spatial layout (percentage-based) */
  x: number;
  y: number;
  dependencies: string[];
}

export interface LevelDesignSpatialDiagramProps {
  onRunPrompt: (itemId: string, prompt: string) => void;
  isRunning: boolean;
  activeItemId: string | null;
}
