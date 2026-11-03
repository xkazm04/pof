/**
 * Parse the runtime's quest vocabulary (`quest_rules.json`, `gtai.quest-rules/2`) into `QuestRules`.
 * Pure: the caller reads the file. A table that is not the expected schema or shape is an error, never a
 * partial vocabulary (a guard that read half a table would pass what the runtime refuses).
 */
import { err, ok, type Result } from '@/types/result';
import { QUEST_RULES_SCHEMA } from '@/lib/games/gtai-quest/types';
import type { QuestRules, RuleCondition, RuleFailRule, RuleVerb } from '@/lib/games/gtai-quest/types';

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const rows = (v: unknown): Record<string, unknown>[] | null => (Array.isArray(v) && v.every(isObject) ? (v as Record<string, unknown>[]) : null);
const strings = (v: unknown): string[] | null => (Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : null);

export function parseQuestRules(raw: unknown): Result<QuestRules> {
  if (!isObject(raw)) return err('quest_rules.json is not an object');
  if (raw.schema !== QUEST_RULES_SCHEMA) return err(`schema is ${JSON.stringify(raw.schema)}, expected ${QUEST_RULES_SCHEMA}`);
  const verbRows = rows(raw.verbs);
  const condRows = rows(raw.conditions);
  const tagRows = rows(raw.event_tags);
  const failRows = rows(raw.fail_rules);
  if (!verbRows || !condRows || !tagRows || !failRows) return err('verbs, conditions, event_tags and fail_rules must each be an array of objects');

  const verbs: RuleVerb[] = [];
  for (const v of verbRows) {
    if (typeof v.id !== 'string' || !v.id) return err('a verb row has no id');
    verbs.push({ id: v.id, needsTarget: v.needs_target === true, needsLocation: v.needs_location === true, needsEncounter: v.needs_encounter === true, targetIsVehicle: v.handler === 'enter_vehicle' });
  }
  const conditions: RuleCondition[] = [];
  for (const c of condRows) {
    if (typeof c.id !== 'string' || !c.id) return err('a condition row has no id');
    const values = c.values === undefined ? undefined : strings(c.values);
    if (values === null) return err(`condition ${c.id}: values must be strings`);
    if (c.pattern !== undefined && typeof c.pattern !== 'string') return err(`condition ${c.id}: pattern must be a string`);
    if (values === undefined && c.pattern === undefined) return err(`condition ${c.id} has neither values nor pattern`);
    conditions.push({ id: c.id, ...(values ? { values } : {}), ...(typeof c.pattern === 'string' ? { pattern: c.pattern } : {}) });
  }
  const eventTags: string[] = [];
  for (const t of tagRows) {
    if (typeof t.id !== 'string' || !t.id) return err('an event tag row has no id');
    eventTags.push(t.id);
  }
  const failRules: RuleFailRule[] = [];
  for (const f of failRows) {
    if (typeof f.id !== 'string' || !f.id) return err('a fail rule has no id');
    const groups = Array.isArray(f.groups) ? f.groups.map(strings) : null;
    if (!groups || groups.some((g) => g === null)) return err(`fail rule ${f.id}: groups must be arrays of strings`);
    failRules.push({ id: f.id, groups: groups as string[][] });
  }
  return ok({ schema: QUEST_RULES_SCHEMA, verbs, conditions, eventTags, failRules });
}
