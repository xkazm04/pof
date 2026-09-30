import type Database from 'better-sqlite3';
import type { ReferenceCaster } from '@/lib/catalog/reference/spellLaw';
import type { StepSeed } from '@/lib/catalog/reference/stepSeeds';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';

export interface SeedContext {
  db: Database.Database;
  sourceId: string;
  ids?: string[];
  promoted: Set<string>;
  root?: string;
  emit(seeds: readonly StepSeed[]): void;
  generic(wrappers: readonly ReferenceWrapper[], caster?: ReferenceCaster): void;
  print(line: string): void;
}

export interface CatalogReport {
  dialogueReport?: unknown;
  monsterTalkReport?: unknown;
  uniqueItemReport?: unknown;
  beforeSummary?: string[];
  afterSummary?: string[];
}

export interface CatalogHandler {
  catalogId: string;
  pool?(
    db: Database.Database,
    sourceId: string,
    wrappers: readonly ReferenceWrapper[],
  ): ReferenceWrapper[];
  seed?(ctx: SeedContext): void;
  report?(): CatalogReport;
  /** Promotion uses code-owned pseudo-wrappers and therefore skips source ingestion. */
  standalonePromotion?: boolean;
}
