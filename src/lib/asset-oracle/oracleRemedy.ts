/**
 * One-click remedies for Asset-Code Oracle violations.
 *
 * Plans the TASK BODY of an `ask-claude` CLITask for the violation types a CLI run
 * can fix without deleting anything. The rail handler composes the project
 * header, so this emits none. After the run completes the oracle re-scans, and
 * the diff (`oracleDiff`) shows whether each key resolved.
 *
 *   - naming-mismatch -> editor rename (leaves redirectors, then fixes them up)
 *   - missing-asset   -> create the Blueprint subclass of the C++ Actor
 *   - orphaned-asset / unreferenced-asset -> null: the only automated fix is a
 *     delete, which stays a human decision
 *   - stale-reference -> null: scan-assets infers edges from existing names, so
 *     the "right" retarget is not knowable from the scan
 */

import type { ConsistencyViolation, ViolationType } from '@/lib/asset-code-oracle';

export interface OracleRemedyContext {
  /** Mount point Content/ is served under in UE asset paths (default `/Game`). */
  contentRoot?: string;
}

export interface OracleRemedyPlan {
  type: ViolationType;
  /** Button / CLI tab label, e.g. "Fix 2 naming mismatches". */
  label: string;
  /** Task body (no project header). */
  prompt: string;
  /** Violation keys this remedy targets (to verify on the rescan). */
  keys: string[];
}

export const REMEDIABLE_TYPES: readonly ViolationType[] = ['naming-mismatch', 'missing-asset'];

const NOUN: Partial<Record<ViolationType, [string, string]>> = {
  'naming-mismatch': ['naming mismatch', 'naming mismatches'],
  'missing-asset': ['missing Blueprint', 'missing Blueprints'],
};

export function remedyLabel(type: ViolationType, count: number): string {
  const noun = NOUN[type];
  if (!noun) return `Fix ${count}`;
  return `Fix ${count} ${count === 1 ? noun[0] : noun[1]}`;
}

/** `Env/X_Foo.uasset` -> `/Game/Env/X_Foo`. */
function objectPath(relativePath: string, root: string): string {
  return `${root}/${relativePath.replace(/\.u(asset|map)$/i, '')}`;
}

function label(v: ConsistencyViolation): string {
  return v.label ?? (v.subject.split('/').pop() ?? v.subject).replace(/\.u(asset|map)$/i, '');
}

const VERIFY =
  'When you finish, the Asset-Code Oracle re-scans Content/ and checks that each listed item is gone from its report. ' +
  'If an item cannot be fixed, say which one and why.';

export function planOracleRemedy(
  type: ViolationType,
  violations: readonly ConsistencyViolation[],
  ctx: OracleRemedyContext = {},
): OracleRemedyPlan | null {
  const targets = violations.filter((v) => v.type === type);
  if (targets.length === 0) return null;
  const root = ctx.contentRoot ?? '/Game';
  const keys = targets.map((v) => v.id);

  if (type === 'naming-mismatch') {
    const lines = targets.map((v) => {
      const from = label(v);
      const to = v.expected ?? from;
      return `- ${from} -> ${to}  (${objectPath(v.subject, root)})`;
    });
    const prompt = [
      `Rename ${targets.length} asset${targets.length === 1 ? '' : 's'} in Content/ to the UE5 naming-convention prefix for ${targets.length === 1 ? 'its' : 'their'} type:`,
      ...lines,
      '',
      'Rename each one INSIDE the editor (unreal.EditorAssetLibrary.rename_asset via editor Python, or Content Browser > Rename), keeping it in its current folder, so the engine leaves a redirector at the old path and every reference keeps resolving. Then run Fix Up Redirectors on the affected folders.',
      'Do NOT delete any asset, and do NOT rename or move .uasset files on disk.',
      VERIFY,
    ].join('\n');
    return { type, label: remedyLabel(type, targets.length), prompt, keys };
  }

  if (type === 'missing-asset') {
    const lines = targets.map((v) => `- ${v.expected ?? `BP_${label(v)}`} parented to ${v.subject}`);
    const prompt = [
      `Create ${targets.length} Blueprint class${targets.length === 1 ? '' : 'es'}, each with its C++ Actor as the parent class:`,
      ...lines,
      '',
      `Create them in the editor (editor Python with unreal.BlueprintFactory and parent_class set, or Content Browser > Blueprint Class) under ${root}/Blueprints/ unless the project already keeps gameplay Blueprints in another folder. Compile and save each one. If a parent class is abstract or not Blueprintable, skip it and say so.`,
      'Do NOT delete or rename any existing asset.',
      VERIFY,
    ].join('\n');
    return { type, label: remedyLabel(type, targets.length), prompt, keys };
  }

  return null;
}
