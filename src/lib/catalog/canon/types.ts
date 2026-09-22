export type RuleCategory = 'art' | 'game' | 'project';

/** One project canon rule CLIs reference when producing pipeline steps. */
export interface ProjectRule {
  id: string;
  category: RuleCategory;
  /** 'global' (applies everywhere) or a specific catalogId. */
  scope: string;
  title: string;
  body: string;
  refs?: string[];
  updatedAt?: string;
  /** The canon profile this rule belongs to (`profiles.ts`). Absent = `pof`, PoF's own world. */
  profile?: string;
}
