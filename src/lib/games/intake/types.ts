/**
 * Pitch intake wire types (WP3). An LLM splits a game pitch into PROPOSALS; nothing is written to
 * the canon or the catalogs until the operator accepts one.
 */
import type { ProjectRule } from '@/lib/catalog/canon/types';
import type { GameId } from '@/lib/games/types';

export type IntakeProposalKind = 'rule' | 'entity';
export type IntakeDecision = 'accept' | 'reject';
export type IntakeStatus = 'pending' | 'accepted' | 'rejected';

export interface IntakeEntityProposal {
  catalogId: string;
  /** Always prefixed `<gameId>-` (the entity PK is global across games). */
  entityId: string;
  name: string;
  tags: string[];
  data: unknown;
}

export interface IntakeProposal {
  id: string;
  kind: IntakeProposalKind;
  /** Present iff kind === 'rule'; its `profile` is the game's authoring profile. */
  rule?: ProjectRule;
  /** Present iff kind === 'entity'. */
  entity?: IntakeEntityProposal;
  /** Which pitch section it was extracted from, quoted for the reviewer. */
  sourceSection: string;
}

export interface StoredIntakeProposal extends IntakeProposal {
  gameId: GameId;
  runId: string;
  status: IntakeStatus;
  decidedAt?: string;
}

/** POST /api/games/[gameId]/intake body (the CLI callback). */
export interface IntakeCallbackBody {
  runId: string;
  proposals: IntakeProposal[];
}

/** PATCH /api/games/[gameId]/intake body. */
export interface IntakeDecisionBody {
  id: string;
  decision: IntakeDecision;
}
