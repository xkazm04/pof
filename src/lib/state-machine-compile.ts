/**
 * compileMachine — the ONE model of what the visual AnimBP state machine IS.
 *
 * The C++ emitter (StateMachineEditor/codegen.ts), the linter
 * (state-machine-validator.ts) and the canvas Entry marker all read this, so
 * they cannot disagree about which state is the entry/fallback, which states
 * become `if (<flag>)` branches of ComputeAnimState(), or which rule strings
 * are written out as C++. The diagnostics describe what WILL be emitted
 * (severity-by-construction: the emitter owns its own findings).
 *
 * Fallback rule (= what ComputeAnimState() returns when no flag is set):
 *   exactly one isDefault → it; several → the lowest-priority default
 *   (error `multiple-defaults`; the others stay in the cascade as flagged
 *   branches); none → the lowest-priority state (warning `implicit-fallback`).
 */
import type { ValidationWarning } from '@/lib/state-machine-validator';

export const DEFAULT_FLAG_SENTINEL = '(default)';

export interface CompileStateLike {
  id: string;
  name: string;
  priority: number;
  flag: string;
  isDefault?: boolean;
}

export interface CompileTransitionLike {
  id: string;
  from: string;
  to: string;
  rule: string;
  description?: string;
}

/** A `bCan<From>To<To>` bool the emitter assigns (and declares) from a rule. */
export interface DerivedFlag {
  name: string;
  rule: string;
  transitionId: string;
  fromName: string;
  toName: string;
  description?: string;
}

export interface CompiledMachine<S extends CompileStateLike> {
  /** The fallback state's id — also the canvas Entry. Null for an empty machine. */
  entryId: string | null;
  fallback: S | null;
  /** 'declared' when ≥1 state is marked Default, 'implicit' when none is. */
  entrySource: 'declared' | 'implicit' | 'none';
  /** All states, priority ascending (0 = checked first); ties keep input order. */
  ordered: S[];
  /** States emitted as `if (<flag>) return …;`, in emit order. */
  cascade: S[];
  enumMembers: string[];
  derivedFlags: DerivedFlag[];
  diagnostics: ValidationWarning[];
}

const CPP_IDENTIFIER = /^[A-Za-z_]\w*$/;

// comment | qualified identifier | number | binary operator | ! | ( | ) | ,
const TOKEN =
  /\s*(?:(\/\/|\/\*|\*\/)|([A-Za-z_]\w*(?:(?:\.|->|::)[A-Za-z_]\w*)*)|(\d+\.?\d*(?:[eE][+-]?\d+)?[fF]?|\.\d+(?:[eE][+-]?\d+)?[fF]?)|(&&|\|\||==|!=|<=|>=|<|>|\+|-|\*|\/|%)|(!)|(\()|(\))|(,))/y;

/**
 * Null when `rule` reads as one C++ boolean expression, else the reason it
 * would not compile when emitted as `bCan<X>To<Y> = <rule>;`.
 */
export function checkRuleExpression(rule: string): string | null {
  const text = rule.trim();
  if (text.length === 0) return 'is empty';
  const placeholder = text.match(/\{[^}]*\}/);
  if (placeholder) return `contains the template placeholder "${placeholder[0]}"`;
  if (text.includes(';')) return 'contains ";"';
  let expectOperand = true;
  let prev = '';
  const stack: ('group' | 'call')[] = [];
  TOKEN.lastIndex = 0;
  while (TOKEN.lastIndex < text.length) {
    const at = TOKEN.lastIndex;
    const m = TOKEN.exec(text);
    if (!m) return `has an unexpected "${text.slice(at).trim()[0]}"`;
    const [, comment, ident, num, binop, not, open, close, comma] = m;
    const tok = m[0].trim();
    if (comment) return 'contains a comment marker';
    if (expectOperand) {
      if (ident || num) {
        expectOperand = false;
        if (ident && text.slice(TOKEN.lastIndex).trimStart().startsWith('(')) {
          TOKEN.exec(text); // consume '('
          stack.push('call');
          expectOperand = true;
          if (text.slice(TOKEN.lastIndex).trimStart().startsWith(')')) {
            TOKEN.exec(text);
            stack.pop();
            expectOperand = false;
          }
        }
      } else if (open) stack.push('group');
      else if (!(not || binop === '-' || binop === '+')) return `expects an operand before "${tok}"`;
    } else if (binop) expectOperand = true;
    else if (close) {
      if (stack.length === 0) return 'has an unbalanced ")"';
      stack.pop();
    } else if (comma && stack[stack.length - 1] === 'call') expectOperand = true;
    else if (ident || num) return `is not one expression ("${prev} ${tok}" reads as prose)`;
    else return `has an unexpected "${tok}"`;
    prev = tok;
  }
  if (expectOperand) return 'ends without an operand';
  if (stack.length > 0) return 'has an unbalanced "("';
  return null;
}

function finding(
  kind: ValidationWarning['kind'],
  severity: ValidationWarning['severity'],
  stateIds: string[],
  transitionIds: string[],
  message: string,
): ValidationWarning {
  return { kind, severity, stateIds, transitionIds, message };
}

function stateDiagnostics<S extends CompileStateLike>(states: readonly S[], cascadeIds: Set<string>): ValidationWarning[] {
  const out: ValidationWarning[] = [];
  for (const s of states) {
    // Every name is emitted verbatim as EARPGAnimState::<name> and into bCan<From>To<To>.
    const name = s.name.trim();
    if (!CPP_IDENTIFIER.test(name)) {
      out.push(finding('invalid-state-name', 'error', [s.id], [], name.length === 0
        ? 'A state has an empty name — generated C++ would emit a bare enumerator and fail to compile.'
        : `State name "${name}" is not a valid C++ identifier (letters/digits/underscore, no leading digit, no spaces) — EARPGAnimState::${name} would fail to compile.`));
    }
    const flag = s.flag.trim();
    if (flag === DEFAULT_FLAG_SENTINEL) {
      if (!s.isDefault) {
        out.push(finding('default-sentinel-mismatch', 'error', [s.id], [],
          `"${name || s.id}" has the "(default)" flag but is not marked Default — codegen keys on the Default box, so tick it or give the state a real flag.`));
      } else if (cascadeIds.has(s.id)) {
        out.push(finding('default-sentinel-mismatch', 'error', [s.id], [],
          `"${name || s.id}" carries the "(default)" flag but another Default state is the fallback — it would be emitted as if ((default)).`));
      }
    } else if (cascadeIds.has(s.id) && !CPP_IDENTIFIER.test(flag)) {
      // A cascade flag is emitted verbatim inside `if (<flag>)`.
      out.push(finding('invalid-state-flag', 'error', [s.id], [], flag.length === 0
        ? `State "${name || s.id}" has no flag — the generated if () would fail to compile.`
        : `State "${name || s.id}" has flag "${flag}", which is not a valid C++ identifier — the generated if (${flag}) would fail to compile.`));
    }
  }
  return out;
}

export function compileMachine<S extends CompileStateLike, T extends CompileTransitionLike>(
  states: readonly S[],
  transitions: readonly T[],
): CompiledMachine<S> {
  const ordered = [...states].sort((a, b) => a.priority - b.priority);
  const defaults = states.filter((s) => s.isDefault);
  const lowestOf = (list: readonly S[]) => [...list].sort((a, b) => a.priority - b.priority).pop() ?? null;
  const fallback = defaults.length > 0 ? lowestOf(defaults) : lowestOf(states);
  const entrySource = states.length === 0 ? 'none' : defaults.length > 0 ? 'declared' : 'implicit';
  const cascade = ordered.filter((s) => s !== fallback);
  const cascadeIds = new Set(cascade.map((s) => s.id));

  const diagnostics = stateDiagnostics(states, cascadeIds);
  if (defaults.length > 1 && fallback) {
    diagnostics.push(finding('multiple-defaults', 'error', defaults.map((s) => s.id), [],
      `${defaults.length} states are marked Default (${defaults.map((s) => s.name).join(', ')}) — ComputeAnimState() falls back to "${fallback.name}" (lowest priority) and emits the others as flagged branches. Keep one Default.`));
  }
  if (entrySource === 'implicit' && fallback) {
    diagnostics.push(finding('implicit-fallback', 'warning', [fallback.id], [],
      `No state is marked Default — ComputeAnimState() falls back to "${fallback.name}", the lowest-priority state. Reachability and dead-end checks run from it; mark the intended fallback Default.`));
  }

  const byId = new Map(states.map((s) => [s.id, s]));
  const derivedFlags: DerivedFlag[] = [];
  const seen = new Set<string>();
  for (const t of transitions) {
    const from = byId.get(t.from);
    const to = byId.get(t.to);
    if (!from || !to) continue;
    // Compound rules (or annotated ones) become derived transition flags.
    if (!t.rule.includes('&&') && !t.description) continue;
    const name = `bCan${from.name}To${to.name}`;
    if (seen.has(name)) continue;
    seen.add(name);
    derivedFlags.push({ name, rule: t.rule, transitionId: t.id, fromName: from.name, toName: to.name, description: t.description });
    const reason = checkRuleExpression(t.rule);
    if (reason) {
      diagnostics.push(finding('invalid-rule-expression', 'error', [from.id, to.id], [t.id],
        `Rule for ${from.name} → ${to.name} ${reason} — it is emitted as C++ (${name} = …;) and would not compile.`));
    }
  }

  return {
    entryId: fallback?.id ?? null,
    fallback,
    entrySource,
    ordered,
    cascade,
    enumMembers: ordered.map((s) => s.name),
    derivedFlags,
    diagnostics,
  };
}
