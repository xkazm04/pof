import type { EvaluatorTabId } from '@/lib/evaluator/tab-glossary';
import type { ModuleScore, Recommendation } from '@/types/evaluator';

export interface ProjectHealthDashboardProps {
  onNavigateTab?: (tab: EvaluatorTabId) => void;
}

export interface RegressionAlert {
  id: string;
  message: string;
  severity: string;
}

export type SelectedModuleDetailData = ModuleScore & {
  recommendations: Recommendation[];
  label: string;
};
