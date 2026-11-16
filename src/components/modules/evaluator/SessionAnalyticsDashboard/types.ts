import type { EvaluatorTabId } from '@/lib/evaluator/tab-glossary';

export interface SessionAnalyticsDashboardProps {
  onNavigateTab?: (tab: EvaluatorTabId) => void;
}
