/**
 * Audit the project's REAL save class against the design and the save canon.
 *
 * - `findSaveGameClasses` — every USaveGame-derived class across the parsed headers, the
 *   inheritance chain resolved through project classes, properties merged base-first.
 * - `auditSaveClass` — design coverage (present / missing / type-mismatched against the
 *   `fields.ts` authority by default) plus UE-semantic findings: Transient members (never
 *   serialized), actor/object runtime refs (null after reload), GAS/timer handles
 *   (ephemeral state persisted — canon: in-flight effects and combat targets are never
 *   saved) and no integer version field (no migration path).
 * - `buildSaveFixPrompt` — the ONE CLI task the Save tab's Fix button dispatches, or null
 *   when there is nothing to fix.
 *
 * Pure: no IO, safe on client and server. The audit route only reads Source/.
 */
import { hasSpecifier, type HeaderParseResult, type ParsedMember } from '@/lib/cpp-semantic-parser';
import {
  SAVE_PERSISTED_FIELDS,
  SAVE_VERSION_FIELD,
  SAVE_SCHEMA_VERSION,
  saveFieldNote,
} from '@/lib/save-schema/fields';

/** Engine base classes that make a class a save game. */
const ENGINE_SAVE_BASES = new Set(['USaveGame', 'ULocalPlayerSaveGame']);

export interface SaveClass {
  name: string;
  baseClass: string | null;
  /** Project-relative (or as-parsed) path of the header declaring the class. */
  headerPath: string;
  /** `[name, parent, ..., USaveGame]`. */
  chain: string[];
  /** Effective UPROPERTYs: inherited project-class members first, then own. */
  properties: ParsedMember[];
}

export type SaveFindingKind = 'transient' | 'runtime-object-ref' | 'runtime-handle' | 'unversioned';

export interface SaveFinding {
  kind: SaveFindingKind;
  /** The offending UPROPERTY; null for a class-level finding (`unversioned`). */
  field: string | null;
  type: string | null;
  severity: 'error' | 'warn';
  /** The fix rule, as the panel shows it and the CLI prompt carries it. */
  rule: string;
}

export interface DesignField {
  name: string;
  /** Expected C++ type; omitted -> name-only comparison. */
  type?: string;
  note?: string;
}

export interface SaveAudit {
  className: string;
  headerPath: string;
  findings: SaveFinding[];
  /** Design field names found on the class (design spelling, design order). */
  present: string[];
  /** Design field names the class does not declare. */
  missing: string[];
  /** Present fields whose declared type differs from the design type. */
  mismatched: { field: string; expected: string; actual: string }[];
  /** Design fields with their expected type/note, for the prompt and the panel rows. */
  design: DesignField[];
}

export const FIX_RULES: Record<SaveFindingKind, string> = {
  transient: 'Transient members are skipped by SaveGame serialization; drop Transient if it must persist, or move it off the save class if it is runtime-only',
  'runtime-object-ref': 'actor/object pointers resolve to null after reload; persist a stable id (FName, FGameplayTag, FGuid or TSoftObjectPtr) and re-resolve it on load',
  'runtime-handle': 'handles are session-only (GAS effects, timers, specs); canon never saves in-flight state; remove it and rebuild from saved state on load',
  unversioned: `no integer version field means no migration path; add UPROPERTY() int32 SchemaVersion = ${SAVE_SCHEMA_VERSION} and migrate in UARPGSaveSubsystem::MigrateSaveGame`,
};

const SEVERITY: Record<SaveFindingKind, SaveFinding['severity']> = {
  transient: 'error',
  'runtime-object-ref': 'warn',
  'runtime-handle': 'warn',
  unversioned: 'error',
};

/** Strong/weak/raw object references; TSoftObjectPtr / TSoftClassPtr / TSubclassOf are asset refs and fine. */
const OBJECT_REF = /\*|\bT(?:Weak|Strong)?ObjectPtr\s*</;
/** Session handles (FActiveGameplayEffectHandle, FTimerHandle, FGameplayAbilitySpecHandle, FDelegateHandle, ...). */
const HANDLE = /\bF\w*Handle\b/;
/** Data-table row handles are stable asset references, not session state. */
const ROW_HANDLE = /\bF\w*RowHandle\b/g;
const INTEGER = /^u?int(?:8|16|32|64)?$/;

const norm = (t: string) => t.replace(/\s+/g, '');

/** Every USaveGame-derived class declared across `headers`, in header order. */
export function findSaveGameClasses(headers: HeaderParseResult[]): SaveClass[] {
  const byName = new Map<string, { cls: HeaderParseResult['classes'][number]; headerPath: string }>();
  for (const h of headers) {
    for (const cls of h.classes) if (cls.kind === 'class' && !byName.has(cls.name)) byName.set(cls.name, { cls, headerPath: h.filePath });
  }

  const out: SaveClass[] = [];
  for (const { cls, headerPath } of byName.values()) {
    const chain = [cls.name];
    let base = cls.baseClass;
    while (base && !ENGINE_SAVE_BASES.has(base) && byName.has(base) && !chain.includes(base)) {
      chain.push(base);
      base = byName.get(base)!.cls.baseClass;
    }
    if (!base || !ENGINE_SAVE_BASES.has(base)) continue;
    chain.push(base);
    const properties = chain
      .slice(0, -1)
      .reverse()
      .flatMap((n) => byName.get(n)!.cls.properties);
    out.push({ name: cls.name, baseClass: cls.baseClass, headerPath, chain, properties });
  }
  return out;
}

/** The fields.ts authority as design fields: SchemaVersion + the 14 persisted fields. */
export function defaultDesignFields(): DesignField[] {
  return [
    { name: SAVE_VERSION_FIELD.ueName, type: SAVE_VERSION_FIELD.ueType, note: SAVE_VERSION_FIELD.note },
    ...SAVE_PERSISTED_FIELDS.map((f) => ({ name: f.ueName, type: f.ueType, note: saveFieldNote(f) })),
  ];
}

function findingsFor(p: ParsedMember): SaveFinding[] {
  const out: SaveFinding[] = [];
  const make = (kind: SaveFindingKind): SaveFinding => ({ kind, field: p.name, type: p.type, severity: SEVERITY[kind], rule: FIX_RULES[kind] });
  if (hasSpecifier(p.specifiers, 'Transient')) out.push(make('transient'));
  if (OBJECT_REF.test(p.type)) out.push(make('runtime-object-ref'));
  if (HANDLE.test(p.type.replace(ROW_HANDLE, ''))) out.push(make('runtime-handle'));
  return out;
}

export function auditSaveClass(cls: SaveClass, designFields: readonly (string | DesignField)[] = defaultDesignFields()): SaveAudit {
  const design = designFields.map((d) => (typeof d === 'string' ? { name: d } : d));
  const findings = cls.properties.flatMap(findingsFor);
  if (!cls.properties.some((p) => /version/i.test(p.name) && INTEGER.test(p.type.trim()))) {
    findings.push({ kind: 'unversioned', field: null, type: null, severity: SEVERITY.unversioned, rule: FIX_RULES.unversioned });
  }

  const declared = new Map(cls.properties.map((p) => [p.name.toLowerCase(), p]));
  const present: string[] = [];
  const missing: string[] = [];
  const mismatched: SaveAudit['mismatched'] = [];
  for (const d of design) {
    const prop = declared.get(d.name.toLowerCase());
    if (!prop) { missing.push(d.name); continue; }
    present.push(d.name);
    if (d.type && norm(d.type) !== norm(prop.type)) mismatched.push({ field: d.name, expected: d.type, actual: prop.type });
  }
  return { className: cls.name, headerPath: cls.headerPath, findings, present, missing, mismatched, design };
}

/** Everything the Fix button would fix. */
export function fixCount(audit: SaveAudit): number {
  return audit.findings.length + audit.missing.length + audit.mismatched.length;
}

export function buildSaveFixPrompt(audit: SaveAudit): string | null {
  if (fixCount(audit) === 0) return null;
  const byName = new Map(audit.design.map((d) => [d.name, d]));
  const lines = [
    `Fix the save-game class ${audit.className} declared in ${audit.headerPath}.`,
    'The Save tab audited the real header against the save design and the save canon and found:',
    '',
    ...audit.findings.map((f) => `- ${f.field ?? audit.className} [${f.kind}]${f.type ? ` (${f.type})` : ''}: ${f.rule}`),
    ...audit.missing.map((name) => {
      const d = byName.get(name);
      return `- ${name} [missing]: add UPROPERTY(SaveGame) ${d?.type ?? '<type>'} ${name}${d?.note ? ` (${d.note})` : ''}`;
    }),
    ...audit.mismatched.map((m) => `- ${m.field} [type-mismatch]: declared ${m.actual}, the design says ${m.expected}; change the declaration to ${m.expected}`),
    '',
    'Change only what is listed. If the persisted field set changes, bump SchemaVersion and add the step to UARPGSaveSubsystem::MigrateSaveGame.',
    'Verify the project compiles.',
  ];
  return lines.join('\n');
}
