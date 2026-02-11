import type { SubModuleId } from './modules';

export interface Recommendation {
  id: string;
  moduleId: SubModuleId;
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  suggestedPrompt: string;
}

export interface ModuleScore {
  moduleId: SubModuleId;
  score: number;
  issues: string[];
}

export interface EvaluatorReport {
  id: string;
  timestamp: number;
  overallScore: number;
  moduleScores: ModuleScore[];
  recommendations: Recommendation[];
  summary: string;
}
