/**
 * Uniqueness guard: is this quest a different quest, or a reskin of one already in the ledger?
 * Compares fingerprints (giver, core verb, new mechanic, payoff kind) and titles against every OTHER
 * ledger quest; `selfId` is skipped. Comparison is case- and whitespace-insensitive, and a `null`
 * newMechanic equals a `null` one (two quests that both add nothing share that shape). Pure.
 */

import type { GuardFinding, GuardVerdict, QuestDesign, QuestGuardContext } from '@/lib/games/gtai-quest/types';

const norm = (s: string | null): string | null => (s === null ? null : s.trim().toLowerCase());

export function assessUniqueness(design: QuestDesign, ctx: QuestGuardContext, selfId?: string): GuardVerdict {
  const others = ctx.ledger.filter((p) => p.id !== selfId);
  const f = design.fingerprint;
  const findings: GuardFinding[] = [];

  for (const p of others) {
    const g = p.fingerprint;
    const same = [norm(f.giver) === norm(g.giver), norm(f.coreVerb) === norm(g.coreVerb), norm(f.newMechanic) === norm(g.newMechanic)];
    const hits = same.filter(Boolean).length;
    if (hits === 3) {
      findings.push({ code: 'DUPLICATE_SHAPE', severity: 'error', ref: p.id, message: `same giver, verb and new mechanic as ${p.id}` });
    } else if (hits === 2 && norm(f.payoffKind) === norm(g.payoffKind)) {
      findings.push({ code: 'NEAR_DUPLICATE', severity: 'warn', ref: p.id, message: `2 of giver/verb/mechanic and the payoff (${f.payoffKind}) match ${p.id}` });
    }
    if (norm(design.title) === norm(p.title)) {
      findings.push({ code: 'DUPLICATE_TITLE', severity: 'error', ref: p.id, message: `title "${design.title}" is already ${p.id}'s` });
    }
    if (f.newMechanic !== null && norm(f.newMechanic) === norm(g.newMechanic)) {
      findings.push({ code: 'MECHANIC_NOT_NEW', severity: 'warn', ref: p.id, message: `mechanic ${f.newMechanic} was already introduced by ${p.id}` });
    }
  }

  return {
    guard: 'uniqueness',
    state: findings.some((x) => x.severity === 'error') ? 'red' : 'green',
    basis: `${others.length} ledger quests`,
    findings,
  };
}
