// ── Structured entity types extracted from CLI responses ──

export type EntityType = 'class' | 'step' | 'warning' | 'file' | 'concept';

export interface ExtractedEntity {
  type: EntityType;
  value: string;
  /** Optional parent class for inheritance */
  parent?: string;
  /** Estimated complexity for steps */
  complexity?: 'low' | 'medium' | 'high';
  /** Ordering hint for implementation steps */
  order?: number;
  /** Module this entity relates to */
  moduleId?: string;
  /** Checklist item ID if linked */
  checklistItemId?: string;
}

export interface StructuredInsight {
  id: string;
  sessionId: string;
  moduleId: string;
  extractedAt: string;
  entities: ExtractedEntity[];
  /** Summary of classes found with hierarchy */
  classHierarchy: { name: string; parent?: string }[];
  /** Ordered implementation steps */
  steps: { order: number; description: string; complexity: 'low' | 'medium' | 'high' }[];
  /** Warnings/caveats from the response */
  warnings: string[];
  /** File paths mentioned */
  filePaths: string[];
}
