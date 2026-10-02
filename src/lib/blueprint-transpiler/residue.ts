/**
 * Transpile residue — the worklist of every node the transpiler did not turn
 * into code, read from the walker's per-node ledger (`TranspileResult.nodeLedger`).
 *
 * Refused nodes come first and each points at the `// TODO` stub it left
 * (the stub carries `(node <id>)`, stamped at emit time); unreached nodes
 * follow with the reason they were never evaluated and no location — they
 * left no stub. ai-registry `game-production/visual-script-to-code-transpilation`:
 * "leave the residue where it happened"; a node not evaluated is not measured,
 * never counted as translated.
 *
 * Pure — no React, no I/O.
 */
import type { NodeLedgerEntry, TranspileResult } from '@/types/blueprint';

export type ResidueFile = 'header' | 'source';

export interface ResidueEntry {
  nodeId: string;
  /** `[K2Node_IfThenElse] Branch` — the same head the stub prints. */
  label: string;
  disposition: 'refused' | 'unreached';
  reason: string;
  /** Which generated file holds the stub. */
  file: ResidueFile;
  /** 1-based line of the stub, or null when the node left none. */
  line: number | null;
}

/** 1-based line of the first line matching `test`, or null. */
function findLine(code: string, test: (line: string) => boolean): number | null {
  const lines = code.split('\n');
  for (let i = 0; i < lines.length; i++) if (test(lines[i])) return i + 1;
  return null;
}

/**
 * The 1-based line of the `// TODO` stub the walker wrote for `nodeId`, or
 * null when that node has no stub (it was translated, structural, or never
 * reached).
 */
export function locateStub(code: string, nodeId: string): number | null {
  const stamp = `(node ${nodeId})`;
  return findLine(code, (l) => l.includes('// TODO') && l.includes(stamp));
}

/**
 * An unknown event's stub is the override TODO in the header. That line is
 * part of the pinned member-model output and carries no node id, so it is
 * found by the event name the header prints.
 */
function locateEventStub(headerCode: string, entry: NodeLedgerEntry): number | null {
  const name = entry.memberName ?? entry.name;
  const marker = `// TODO: Override for ${name}`;
  return findLine(headerCode, (l) => l.trimEnd().endsWith(marker));
}

function toEntry(result: Pick<TranspileResult, 'headerCode' | 'sourceCode'>, e: NodeLedgerEntry): ResidueEntry {
  const base = {
    nodeId: e.nodeId,
    label: `[${e.nodeType}] ${e.name}`,
    reason: e.reason ?? '',
  };
  if (e.disposition === 'unreached') return { ...base, disposition: 'unreached', file: 'source', line: null };
  const inSource = locateStub(result.sourceCode, e.nodeId);
  if (inSource !== null) return { ...base, disposition: 'refused', file: 'source', line: inSource };
  const inHeader = e.nodeType.includes('Event') ? locateEventStub(result.headerCode, e) : null;
  return inHeader !== null
    ? { ...base, disposition: 'refused', file: 'header', line: inHeader }
    : { ...base, disposition: 'refused', file: 'source', line: null };
}

/**
 * Every refused node (with its stub location), then every unreached node, in
 * ledger order within each group. A result without a ledger yields nothing —
 * there is no per-node record to list.
 */
export function buildResidue(
  result: Pick<TranspileResult, 'headerCode' | 'sourceCode' | 'nodeLedger'>,
): ResidueEntry[] {
  const ledger = result.nodeLedger ?? [];
  const refused = ledger.filter((e) => e.disposition === 'refused').map((e) => toEntry(result, e));
  const unreached = ledger.filter((e) => e.disposition === 'unreached').map((e) => toEntry(result, e));
  return [...refused, ...unreached];
}
