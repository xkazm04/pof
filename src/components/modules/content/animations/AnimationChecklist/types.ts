import type { LucideIcon } from 'lucide-react';

// ── Types ──

export type StepType = 'manual' | 'code' | 'auto';

export interface ChecklistStep {
  id: string;
  number: number;
  title: string;
  type: StepType;
  icon: LucideIcon;
  description: string;
  /** Detailed instructions shown when expanded */
  details: string[];
  /** External links for manual steps */
  links?: { label: string; url: string }[];
  /** CLI prompt for code-generation steps */
  prompt?: string;
}
